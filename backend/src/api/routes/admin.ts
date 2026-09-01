import { Router, Request, Response, NextFunction } from 'express';
import { OnboardMerchantSchema } from '@floq/validation';
import { queryOne, transaction } from '../../db';
import crypto from 'crypto';

const router = Router();

// Middleware to protect admin routes using ADMIN_KEY
export function adminAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const key = (req.headers['x-admin-key'] as string) || (req.query.key as string);
  const expectedKey = process.env.ADMIN_KEY || 'floq_admin_seed_secret';

  if (!key || key !== expectedKey) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Invalid or missing admin security key' });
    return;
  }
  next();
}

router.use(adminAuthMiddleware);

// POST /api/admin/onboard-merchant - White-glove onboarding for pilot merchants
router.post('/onboard-merchant', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = OnboardMerchantSchema.parse(req.body);
    const cleanPhone = input.phone.replace(/\D/g, '').slice(-10);

    if (cleanPhone.length < 10) {
      res.status(400).json({ error: 'INVALID_PHONE', message: 'Mobile number must be a valid 10-digit number' });
      return;
    }

    const now = new Date().toISOString();
    const slug =
      input.storeName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || `store-${cleanPhone}`;

    const existingUser = await queryOne(
      'SELECT id, merchant_id FROM users WHERE phone = $1 OR phone = $2 OR phone LIKE $3',
      [cleanPhone, `+91${cleanPhone}`, `%${cleanPhone}`]
    );

    if (existingUser) {
      const store = await queryOne('SELECT id, name FROM stores WHERE merchant_id = $1 LIMIT 1', [
        existingUser.merchant_id,
      ]);
      res.status(200).json({
        success: true,
        alreadyExisted: true,
        message: `Merchant with phone ${cleanPhone} is already onboarded.`,
        merchantId: existingUser.merchant_id,
        storeId: store?.id || null,
        storeName: store?.name || input.storeName,
        userId: existingUser.id,
        phone: cleanPhone,
        mockOtp: '123456',
      });
      return;
    }

    const merchantId = `merchant_${slug.replace(/-/g, '_')}_${cleanPhone.slice(-4)}`;
    const storeId = `store_${slug.replace(/-/g, '_')}_${cleanPhone.slice(-4)}`;
    const userId = `user_${cleanPhone}`;
    const categoryId = `cat_${slug.replace(/-/g, '_')}_general`;

    await transaction(async (client) => {
      // 1. Create Merchant
      await client.query(
        `INSERT INTO merchants (id, name, phone, email, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [merchantId, input.merchantName, cleanPhone, input.email || null, 'ACTIVE', now, now]
      );

      // 2. Create Store
      await client.query(
        `INSERT INTO stores (id, merchant_id, name, slug, store_type, address, phone, opening_time, closing_time, timezone, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          storeId,
          merchantId,
          input.storeName,
          slug,
          input.storeType,
          input.address || 'India',
          cleanPhone,
          '07:00',
          '23:00',
          'Asia/Kolkata',
          'ACTIVE',
          now,
          now,
        ]
      );

      // 3. Create Store Settings (with Paytm soundbox static UPI)
      await client.query(
        `INSERT INTO store_settings (id, store_id, voice_enabled, voice_language, voice_verbosity, typical_prep_time_minutes, ticket_prefix, upi_id, upi_name)
         VALUES ($1, $2, true, 'en-IN', 'BRIEF', 5, '#', $3, $4)`,
        [
          crypto.randomUUID(),
          storeId,
          input.upiId || `${cleanPhone}@okhdfcbank`,
          input.upiName || input.merchantName,
        ]
      );

      // 4. Create User (Role: OWNER)
      await client.query(
        `INSERT INTO users (id, phone, name, role, merchant_id, store_ids_json, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          userId,
          cleanPhone,
          input.merchantName,
          'OWNER',
          merchantId,
          JSON.stringify([storeId]),
          'ACTIVE',
          now,
          now,
        ]
      );

      // 5. Create Default Initial Category
      await client.query(
        `INSERT INTO categories (id, store_id, name, sort_order, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [categoryId, storeId, input.initialCategoryName || 'General', 0, true, now]
      );
    });

    res.status(201).json({
      success: true,
      alreadyExisted: false,
      message: `Merchant "${input.merchantName}" (${input.storeName}) onboarded successfully!`,
      merchantId,
      storeId,
      userId,
      phone: cleanPhone,
      mockOtp: '123456',
      initialCategoryId: categoryId,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
