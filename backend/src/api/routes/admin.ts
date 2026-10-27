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
    // The app displays only the store/org name, so the owner record and the UPI
    // payee default to storeName — a person name is never required or shown.
    const ownerName = input.merchantName || input.storeName;
    const payeeName = input.upiName || input.storeName;

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
        [merchantId, ownerName, cleanPhone, input.email || null, 'ACTIVE', now, now]
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
          payeeName,
        ]
      );

      // 4. Owner user with hashed PIN
      await client.query(
        `INSERT INTO users (id, phone, name, role, merchant_id, store_ids_json, pin_hash, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          userId,
          cleanPhone,
          ownerName,
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

      const suppliers = input.suppliers || {};
      const catIdByName: Record<string, string> = {};
      let catSort = 0;
      for (const catName of categoryNames) {
        const catId = `cat_${slug.replace(/-/g, '_')}_${catSort}`;
        catIdByName[catName] = catId;
        await client.query(
          `INSERT INTO categories (id, store_id, name, supplier, sort_order, is_active, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [catId, storeId, catName, suppliers[catName] || null, catSort, true, now]
        );
        catSort++;
      }
      initialCategoryId = catIdByName[input.initialCategoryName] || Object.values(catIdByName)[0] || '';

      let itemSort = 0;
      for (const it of items) {
        const catName = it.category || input.initialCategoryName;
        const productId = crypto.randomUUID();
        const loose = !!it.isLoose;
        await client.query(
          `INSERT INTO products (id, store_id, category_id, name, name_local, price, is_available, sort_order, station, is_loose, per_kg, stock_grams, daily_grams, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            productId,
            storeId,
            catIdByName[catName],
            it.name,
            it.nameLocal || null,
            loose ? it.perKg ?? 0 : it.price ?? 0,
            true,
            itemSort,
            it.station || (input.mode === 'FOOD' ? 'HOT_FOOD' : 'PACKAGED'),
            loose,
            loose ? it.perKg ?? 0 : null,
            loose ? Math.round((it.stockKg ?? 0) * 1000) : null,
            loose ? Math.round((it.dailyKg ?? 0) * 1000) : null,
            now,
            now,
          ]
        );
        // Retail pack sizes, if any.
        const packs = it.packs || [];
        for (let j = 0; j < packs.length; j++) {
          const k = packs[j];
          await client.query(
            `INSERT INTO product_packs (id, product_id, store_id, size, price, wholesale_price, cost_price, stock, case_qty, daily_rate, expiry_note, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              `${productId}_${j}`,
              productId,
              storeId,
              k.size,
              k.price,
              k.wholesalePrice ?? null,
              k.costPrice ?? null,
              k.stock ?? 0,
              k.caseQty ?? null,
              k.dailyRate ?? 0,
              k.expiryNote ?? null,
              j,
            ]
          );
        }
        itemSort++;
      }

      // 6. Opening credit book (existing khata accounts), if provided.
      const DAY_MS = 24 * 60 * 60 * 1000;
      for (const c of input.customers || []) {
        const owes = c.owes ?? 0;
        const oldest = owes > 0 ? new Date(Date.now() - (c.oldestDueDays ?? 0) * DAY_MS).toISOString() : null;
        await client.query(
          `INSERT INTO credit_customers (id, store_id, name, kind, phone, credit_limit, owes, oldest_due_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [crypto.randomUUID(), storeId, c.name, c.kind || 'REGULAR', c.phone || null, c.creditLimit ?? 0, owes, oldest, now]
        );
      }
    });

    res.status(201).json({
      success: true,
      alreadyExisted: false,
      message: `Merchant "${input.storeName}" onboarded in ${input.mode} mode.`,
      merchantId,
      storeId,
      userId,
      phone: cleanPhone,
      mode: input.mode,
      secondaryLanguage: input.secondaryLanguage,
      initialCategoryId,
      itemsCreated: (input.items || []).length,
      packsCreated: (input.items || []).reduce((n, it) => n + (it.packs?.length || 0), 0),
      customersCreated: (input.customers || []).length,
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

// GET /api/admin/pending-subscriptions — manual-UPI payments awaiting verification.
router.get('/pending-subscriptions', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { subscriptionService } = await import('../../services/subscriptionService');
    res.json({ pending: await subscriptionService.listPending() });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/verify-subscription — confirm a UPI payment, activate + extend.
router.post('/verify-subscription', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paymentId = String(req.body?.paymentId || '');
    if (!paymentId) {
      res.status(400).json({ error: 'INVALID_INPUT', message: 'paymentId is required' });
      return;
    }
    const { subscriptionService } = await import('../../services/subscriptionService');
    const result = await subscriptionService.verifyPayment(paymentId);
    if (!result.ok) {
      res.status(404).json({ error: result.error });
      return;
    }
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

export default router;
