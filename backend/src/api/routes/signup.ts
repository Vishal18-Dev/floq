import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { SelfSignupSchema } from '@floq/validation';
import { transaction, queryOne } from '../../db';
import { hashPin, authService } from '../../services/authService';
import { verifyFirebaseIdToken } from '../../services/firebaseAuth';

const router = Router();

function slugify(input: string, fallback: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || fallback;
}

// POST /api/signup — self-serve merchant signup after a Firebase phone-OTP
// verification. The phone is taken from the verified token (never the body).
// Creates the account with an empty catalogue and returns a session; the trial
// subscription auto-provisions on first access.
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = SelfSignupSchema.parse(req.body);

    let identity;
    try {
      identity = await verifyFirebaseIdToken(input.idToken);
    } catch (e: any) {
      res.status(401).json({ error: 'INVALID_TOKEN', message: e?.message || 'Could not verify OTP' });
      return;
    }
    if (!identity.phoneNumber) {
      res.status(400).json({ error: 'NO_PHONE', message: 'OTP token has no phone number' });
      return;
    }
    const cleanPhone = identity.phoneNumber.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length < 10) {
      res.status(400).json({ error: 'INVALID_PHONE', message: 'Verified number is not a valid 10-digit mobile' });
      return;
    }

    const existing = await queryOne('SELECT id FROM users WHERE phone = $1 OR phone = $2 OR phone LIKE $3', [
      cleanPhone,
      `+91${cleanPhone}`,
      `%${cleanPhone}`,
    ]);
    if (existing) {
      res.status(409).json({ error: 'ACCOUNT_EXISTS', message: 'An account already exists for this number. Please log in.' });
      return;
    }

    const ownerName = input.ownerName || input.storeName;
    const now = new Date().toISOString();
    const slug = slugify(input.storeName, `store-${cleanPhone}`);
    const merchantId = `merchant_${slug.replace(/-/g, '_')}_${cleanPhone.slice(-4)}`;
    const storeId = `store_${slug.replace(/-/g, '_')}_${cleanPhone.slice(-4)}`;
    const userId = `user_${cleanPhone}`;

    await transaction(async (client) => {
      await client.query(
        `INSERT INTO merchants (id, name, phone, email, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $6)`,
        [merchantId, ownerName, cleanPhone, null, now, now]
      );
      await client.query(
        `INSERT INTO stores (id, merchant_id, name, slug, store_type, mode, phone, city, image_url, opening_time, closing_time, timezone, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, '07:00', '23:00', 'Asia/Kolkata', 'ACTIVE', $10, $11)`,
        [storeId, merchantId, input.storeName, slug, input.storeType, input.mode, cleanPhone, input.city || null, input.imageUrl || null, now, now]
      );
      await client.query(
        `INSERT INTO store_settings (id, store_id, secondary_language, voice_enabled, voice_language, voice_verbosity, typical_prep_time_minutes, ticket_prefix, auto_accept_qr_orders, upi_id, upi_name)
         VALUES ($1, $2, $3, $4, $5, 'BRIEF', $6, '#', false, $7, $8)`,
        [
          crypto.randomUUID(),
          storeId,
          input.secondaryLanguage,
          input.mode === 'FOOD',
          input.secondaryLanguage === 'none' ? 'en-IN' : `${input.secondaryLanguage}-IN`,
          input.mode === 'FOOD' ? 6 : 1,
          input.upiId || null,
          input.storeName,
        ]
      );
      await client.query(
        `INSERT INTO users (id, phone, name, role, merchant_id, store_ids_json, pin_hash, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'OWNER', $4, $5, $6, 'ACTIVE', $7, $8)`,
        [userId, cleanPhone, ownerName, merchantId, JSON.stringify([storeId]), hashPin(input.pin), now, now]
      );
      // One empty starter category so the merchant can add items immediately.
      await client.query(
        `INSERT INTO categories (id, store_id, name, sort_order, is_active, created_at)
         VALUES ($1, $2, $3, 0, true, $4)`,
        [`cat_${slug.replace(/-/g, '_')}_0`, storeId, input.mode === 'FOOD' ? 'Menu' : 'Products', now]
      );
    });

    const session = await authService.loginWithVerifiedPhone(cleanPhone);
    res.status(201).json({ ...session, mode: input.mode });
  } catch (err: any) {
    if (err?.name === 'ZodError') return next(err);
    next(err);
  }
});

export default router;
