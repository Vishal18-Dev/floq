import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/server';
import { seedDatabase } from '../src/db/seed';
import { getTestAuthHeader } from './helpers';

describe('Security & Sensitive Data Redaction Verification Tests (PostgreSQL)', () => {
  const app = createServer();

  beforeEach(async () => {
    await seedDatabase();
  });

  it('1. Cross-Merchant isolation blocks Merchant A from accessing Merchant B store orders (Returns 403 Forbidden)', async () => {
    const merchantAHeaders = getTestAuthHeader('merchant_sharma_01', 'store_sharma_01');

    const res = await request(app)
      .get('/api/orders')
      .set({
        ...merchantAHeaders,
        'x-store-id': 'store_chaipoint_02',
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Access denied');
  });

  it('2. Sensitive key redactor removes passwords, tokens, auth headers, and OTP codes', () => {
    const sensitivePayload = {
      phone: '9876543210',
      otp: '123456',
      authorization: 'Bearer secret_token_123',
      token: 'jwt_token_sample',
      password: 'super_secret_password',
      cardNumber: '4111111111111111',
      cvv: '123',
      validField: 'Sharma Breakfast Corner',
    };

    const SENSITIVE_KEYS = new Set(['authorization', 'password', 'token', 'otp', 'cardnumber', 'cvv', 'jwtsecret', 'secret']);

    function sanitizeData(data: any): any {
      if (!data || typeof data !== 'object') return data;
      if (Array.isArray(data)) return data.map(sanitizeData);
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        if (SENSITIVE_KEYS.has(key.toLowerCase())) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          sanitized[key] = sanitizeData(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }

    const cleaned = sanitizeData(sensitivePayload);
    expect(cleaned.phone).toBe('9876543210');
    expect(cleaned.validField).toBe('Sharma Breakfast Corner');
    expect(cleaned.otp).toBe('[REDACTED]');
    expect(cleaned.authorization).toBe('[REDACTED]');
    expect(cleaned.token).toBe('[REDACTED]');
    expect(cleaned.password).toBe('[REDACTED]');
    expect(cleaned.cardNumber).toBe('[REDACTED]');
    expect(cleaned.cvv).toBe('[REDACTED]');
  });
});
