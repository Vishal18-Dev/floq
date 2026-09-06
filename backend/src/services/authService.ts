import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query, queryOne } from '../db';
import { config } from '../config';
import { JWTPayload, StaffRole, UserSession } from '@floq/types';

/**
 * PIN authentication. Merchants are provisioned by FLOQ (white-glove) with a
 * phone number and a fixed numeric PIN; there is no SMS OTP. PINs are stored
 * only as salted scrypt hashes. Repeated wrong PINs lock the account for a
 * cooldown window to blunt brute-forcing of a short numeric PIN.
 */

const SCRYPT_KEYLEN = 32;

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(pin, salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPinHash(pin: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expected] = parts;
  const derived = crypto.scryptSync(pin, salt, SCRYPT_KEYLEN).toString('hex');
  const a = Buffer.from(derived, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '').slice(-10);
}

export class AuthService {
  /** Set or reset a user's PIN (used by the admin onboarding flow). */
  public async setUserPin(userId: string, pin: string): Promise<void> {
    await query('UPDATE users SET pin_hash = $1, pin_attempts = 0, pin_locked_until = NULL, updated_at = $2 WHERE id = $3', [
      hashPin(pin),
      new Date().toISOString(),
      userId,
    ]);
  }

  public async login(rawPhone: string, pin: string): Promise<UserSession> {
    const phone = normalizePhone(rawPhone);
    if (phone.length < 10) {
      throw new Error('Enter a valid 10-digit mobile number');
    }

    const user = await queryOne(
      'SELECT * FROM users WHERE phone = $1 OR phone = $2 OR phone LIKE $3',
      [phone, `+91${phone}`, `%${phone}`]
    );

    // Uniform message: do not reveal whether the number is registered.
    const GENERIC = 'Phone number or PIN is incorrect';

    if (!user) {
      throw new Error(GENERIC);
    }

    if (user.status && user.status !== 'ACTIVE') {
      throw new Error('This account is not active. Please contact FLOQ support.');
    }

    // Lockout check
    if (user.pin_locked_until) {
      const until = new Date(user.pin_locked_until).getTime();
      if (Date.now() < until) {
        const mins = Math.ceil((until - Date.now()) / 60000);
        throw new Error(`Too many wrong attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`);
      }
    }

    if (!user.pin_hash) {
      throw new Error('No PIN set for this account. Please contact FLOQ to complete setup.');
    }

    if (!verifyPinHash(pin, user.pin_hash)) {
      const attempts = Number(user.pin_attempts || 0) + 1;
      if (attempts >= config.pinMaxAttempts) {
        const lockUntil = new Date(Date.now() + config.pinLockoutMinutes * 60000).toISOString();
        await query('UPDATE users SET pin_attempts = $1, pin_locked_until = $2 WHERE id = $3', [attempts, lockUntil, user.id]);
        throw new Error(`Too many wrong attempts. Try again in ${config.pinLockoutMinutes} minutes.`);
      }
      await query('UPDATE users SET pin_attempts = $1 WHERE id = $2', [attempts, user.id]);
      throw new Error(GENERIC);
    }

    // Success — reset counters
    await query('UPDATE users SET pin_attempts = 0, pin_locked_until = NULL WHERE id = $1', [user.id]);

    const storeIds: string[] =
      typeof user.store_ids_json === 'string' ? JSON.parse(user.store_ids_json) : user.store_ids_json || [];

    const payload: JWTPayload = {
      userId: user.id,
      phone: user.phone,
      merchantId: user.merchant_id,
      storeIds,
      role: user.role as StaffRole,
    };

    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '180d' });
    const expiresAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

    return {
      userId: user.id,
      phone: user.phone,
      name: user.name,
      merchantId: user.merchant_id,
      storeIds,
      role: user.role as StaffRole,
      token,
      expiresAt,
    };
  }

  public verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, config.jwtSecret) as JWTPayload;
    } catch {
      throw new Error('Invalid or expired authentication token');
    }
  }
}

export const authService = new AuthService();
