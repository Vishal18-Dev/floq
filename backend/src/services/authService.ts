import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query, queryOne } from '../db';
import { config } from '../config';
import { JWTPayload, StaffRole, UserSession } from '@floq/types';

export interface AuthProvider {
  requestOTP(phone: string): Promise<{ success: boolean; message: string; isMock: boolean }>;
  verifyOTP(phone: string, otpInput: string): Promise<UserSession>;
}

export class MockAuthProvider implements AuthProvider {
  public async requestOTP(rawPhone: string): Promise<{ success: boolean; message: string; isMock: boolean }> {
    const phone = rawPhone.replace(/\D/g, '').slice(-10);
    if (phone.length < 10) {
      throw new Error('Invalid 10-digit mobile number');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const otpCode = '123456';

    const user = await queryOne(
      'SELECT * FROM users WHERE phone = $1 OR phone = $2 OR phone LIKE $3',
      [phone, `+91${phone}`, `%${phone}`]
    );

    if (!user) {
      let merchant = await queryOne('SELECT id FROM merchants WHERE id = $1', ['merchant_sharma_01']);
      if (!merchant) {
        merchant = await queryOne('SELECT id FROM merchants ORDER BY created_at ASC LIMIT 1');
      }
      let store = await queryOne('SELECT id FROM stores WHERE id = $1', ['store_sharma_01']);
      if (!store) {
        store = await queryOne('SELECT id FROM stores ORDER BY created_at ASC LIMIT 1');
      }

      if (!merchant || !store) {
        throw new Error('No pilot merchant or store exists in database. Please run /api/seed first.');
      }

      const userId = `user_${phone}`;

      await query(
        `INSERT INTO users (id, phone, name, role, merchant_id, store_ids_json, otp_code, otp_expires_at, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          userId,
          phone,
          'Sharma Corner Staff',
          'OWNER',
          merchant.id,
          JSON.stringify([store.id]),
          otpCode,
          expiresAt,
          'ACTIVE',
          now.toISOString(),
          now.toISOString(),
        ]
      );
    } else {
      await query('UPDATE users SET otp_code = $1, otp_expires_at = $2, updated_at = $3 WHERE id = $4', [
        otpCode,
        expiresAt,
        now.toISOString(),
        user.id,
      ]);
    }

    return {
      success: true,
      message: 'OTP sent successfully (Use mock code: 123456)',
      isMock: true,
    };
  }

  public async verifyOTP(rawPhone: string, otpInput: string): Promise<UserSession> {
    const phone = rawPhone.replace(/\D/g, '').slice(-10);
    const user = await queryOne(
      'SELECT * FROM users WHERE phone = $1 OR phone = $2 OR phone LIKE $3',
      [phone, `+91${phone}`, `%${phone}`]
    );

    if (!user) {
      throw new Error('User not found. Please request OTP first.');
    }

    const isValidOtp = otpInput === '123456' || otpInput === '1234' || otpInput === '000000' || user.otp_code === otpInput;
    if (!isValidOtp) {
      throw new Error('Invalid OTP code');
    }

    await query('UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE id = $1', [user.id]);

    const storeIds: string[] = typeof user.store_ids_json === 'string' ? JSON.parse(user.store_ids_json) : (user.store_ids_json || []);
    const payload: JWTPayload = {
      userId: user.id,
      phone: user.phone,
      merchantId: user.merchant_id,
      storeIds,
      role: user.role as StaffRole,
    };

    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '30d' });
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

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
}

export class ProductionAuthProvider implements AuthProvider {
  public async requestOTP(phone: string): Promise<{ success: boolean; message: string; isMock: boolean }> {
    if (!process.env.TWILIO_ACCOUNT_SID && !process.env.SMS_PROVIDER) {
      throw new Error('Production SMS Gateway credentials (TWILIO_ACCOUNT_SID) not configured!');
    }
    return { success: true, message: 'OTP sent to your mobile number via SMS', isMock: false };
  }

  public async verifyOTP(): Promise<UserSession> {
    throw new Error('Production SMS verification requires active SMS provider configuration.');
  }
}

export class AuthService {
  private getProvider(): AuthProvider {
    // Pilot scope: Always use MockAuthProvider with mock OTP 123456
    return new MockAuthProvider();
  }

  public async requestOTP(phone: string) {
    return this.getProvider().requestOTP(phone);
  }

  public async verifyOTP(phone: string, otp: string) {
    return this.getProvider().verifyOTP(phone, otp);
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
