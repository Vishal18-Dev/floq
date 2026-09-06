import { Router, Request, Response, NextFunction } from 'express';
import { OnboardMerchantSchema } from '@floq/validation';
import { queryOne, transaction } from '../../db';
import { hashPin } from '../../services/authService';
import { config } from '../../config';
import crypto from 'crypto';

const router = Router();

// Middleware to protect admin routes using the configured ADMIN_KEY.
export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const key = (req.headers['x-admin-key'] as string) || (req.query.key as string);

  if (!key || key !== config.adminKey) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Invalid or missing admin security key' });
    return;
  }
  next();
}

router.use(adminAuthMiddleware);

function slugify(input: string, fallback: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback
  );
}

// POST /api/admin/onboard-merchant — white-glove onboarding for pilot merchants.
// Creates merchant + store (mode, language) + settings (UPI) + owner user with
// a hashed PIN + catalogue (bilingual). Idempotent on phone number.
router.post('/onboard-merchant', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = OnboardMerchantSchema.parse(req.body);
    const cleanPhone = input.phone.replace(/\D/g, '').slice(-10);

    if (cleanPhone.length < 10) {
      res.status(400).json({ error: 'INVALID_PHONE', message: 'Mobile number must be a valid 10-digit number' });
      return;
    }

    const now = new Date().toISOString();
    const slug = slugify(input.storeName, `store-${cleanPhone}`);

    const existingUser = await queryOne(
      'SELECT id, merchant_id FROM users WHERE phone = $1 OR phone = $2 OR phone LIKE $3',
      [cleanPhone, `+91${cleanPhone}`, `%${cleanPhone}`]
    );

    if (existingUser) {
      const store = await queryOne('SELECT id, name FROM stores WHERE merchant_id = $1 LIMIT 1', [existingUser.merchant_id]);
      res.status(200).json({
        success: true,
        alreadyExisted: true,
        message: `A merchant with phone ${cleanPhone} is already onboarded. Use the reset-pin endpoint to change the PIN.`,
        merchantId: existingUser.merchant_id,
        storeId: store?.id || null,
        storeName: store?.name || input.storeName,
        userId: existingUser.id,
        phone: cleanPhone,
      });
      return;
    }

    const merchantId = `merchant_${slug.replace(/-/g, '_')}_${cleanPhone.slice(-4)}`;
    const storeId = `store_${slug.replace(/-/g, '_')}_${cleanPhone.slice(-4)}`;
    const userId = `user_${cleanPhone}`;
    const pinHash = hashPin(input.pin);
    let initialCategoryId = '';

    await transaction(async (client) => {
      // 1. Merchant
      await client.query(
        `INSERT INTO merchants (id, name, phone, email, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [merchantId, input.merchantName, cleanPhone, input.email || null, 'ACTIVE', now, now]
      );

      // 2. Store (with operating mode + bilingual name)
      await client.query(
        `INSERT INTO stores (id, merchant_id, name, name_local, slug, store_type, mode, address, phone, opening_time, closing_time, timezone, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          storeId,
          merchantId,
          input.storeName,
          input.storeNameLocal || null,
          slug,
          input.storeType,
          input.mode,
          input.address || null,
          cleanPhone,
          '07:00',
          '23:00',
          'Asia/Kolkata',
          'ACTIVE',
          now,
          now,
        ]
      );

      // 3. Store settings (secondary language + UPI). No demo defaults.
      await client.query(
        `INSERT INTO store_settings (id, store_id, secondary_language, voice_enabled, voice_language, voice_verbosity, typical_prep_time_minutes, ticket_prefix, auto_accept_qr_orders, upi_id, upi_name)
         VALUES ($1, $2, $3, $4, $5, 'BRIEF', $6, '#', false, $7, $8)`,
        [
          crypto.randomUUID(),
          storeId,
          input.secondaryLanguage,
          input.mode === 'FOOD',
          input.secondaryLanguage === 'none' ? 'en-IN' : `${input.secondaryLanguage}-IN`,
          input.typicalPrepTimeMinutes || (input.mode === 'FOOD' ? 6 : 1),
          input.upiId || null,
          input.upiName || input.merchantName,
        ]
      );

      // 4. Owner user with hashed PIN
      await client.query(
        `INSERT INTO users (id, phone, name, role, merchant_id, store_ids_json, pin_hash, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          userId,
          cleanPhone,
          input.merchantName,
          'OWNER',
          merchantId,
          JSON.stringify([storeId]),
          pinHash,
          'ACTIVE',
          now,
          now,
        ]
      );

      // 5. Catalogue. Group provided items by category; always ensure one category.
      const items = input.items || [];
      const categoryNames = Array.from(new Set(items.map((it) => it.category || input.initialCategoryName)));
      if (categoryNames.length === 0) categoryNames.push(input.initialCategoryName);

      const catIdByName: Record<string, string> = {};
      let catSort = 0;
      for (const catName of categoryNames) {
        const catId = `cat_${slug.replace(/-/g, '_')}_${catSort}`;
        catIdByName[catName] = catId;
        await client.query(
          `INSERT INTO categories (id, store_id, name, sort_order, is_active, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [catId, storeId, catName, catSort, true, now]
        );
        catSort++;
      }
      initialCategoryId = catIdByName[input.initialCategoryName] || Object.values(catIdByName)[0] || '';

      let itemSort = 0;
      for (const it of items) {
        const catName = it.category || input.initialCategoryName;
        await client.query(
          `INSERT INTO products (id, store_id, category_id, name, name_local, price, is_available, sort_order, station, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            crypto.randomUUID(),
            storeId,
            catIdByName[catName],
            it.name,
            it.nameLocal || null,
            it.price,
            true,
            itemSort,
            it.station || (input.mode === 'FOOD' ? 'HOT_FOOD' : 'PACKAGED'),
            now,
            now,
          ]
        );
        itemSort++;
      }
    });

    res.status(201).json({
      success: true,
      alreadyExisted: false,
      message: `Merchant "${input.merchantName}" (${input.storeName}) onboarded in ${input.mode} mode.`,
      merchantId,
      storeId,
      userId,
      phone: cleanPhone,
      mode: input.mode,
      secondaryLanguage: input.secondaryLanguage,
      initialCategoryId,
      itemsCreated: (input.items || []).length,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/reset-pin — set/rotate a merchant's PIN by phone.
router.post('/reset-pin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const phone = String(req.body?.phone || '').replace(/\D/g, '').slice(-10);
    const pin = String(req.body?.pin || '');
    if (phone.length < 10) {
      res.status(400).json({ error: 'INVALID_PHONE', message: 'Valid 10-digit phone required' });
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      res.status(400).json({ error: 'INVALID_PIN', message: 'PIN must be 4 to 6 digits' });
      return;
    }
    const user = await queryOne('SELECT id FROM users WHERE phone = $1 OR phone = $2 OR phone LIKE $3', [
      phone,
      `+91${phone}`,
      `%${phone}`,
    ]);
    if (!user) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'No merchant with that phone' });
      return;
    }
    const { authService } = await import('../../services/authService');
    await authService.setUserPin(user.id, pin);
    res.json({ success: true, message: `PIN reset for ${phone}` });
  } catch (err) {
    next(err);
  }
});

export default router;
