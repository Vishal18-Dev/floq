import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/server';
import { seedDatabase } from '../src/db/seed';
import { getTestAuthHeader } from './helpers';

describe('P0-1 Authentication & Authorization Security Tests', () => {
  const app = createServer();

  beforeEach(async () => {
    await seedDatabase();
  });

  it('1. Unauthenticated request without Bearer token returns 401 Unauthorized', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('2. Request with invalid Bearer token returns 401 Invalid Token', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', 'Bearer invalid_bogus_token_123');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_TOKEN');
  });

  it('3. Valid merchant user can access their own store resources', async () => {
    const headers = getTestAuthHeader('merchant_sharma_01', 'store_sharma_01');
    const res = await request(app)
      .get('/api/orders')
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.orders).toBeDefined();
  });

  it('4. Merchant A cannot access Merchant B store resources (403 Forbidden)', async () => {
    const headersA = getTestAuthHeader('merchant_sharma_01', 'store_sharma_01');

    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', headersA.Authorization)
      .set('x-store-id', 'store_chaipoint_02');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('5. PIN login issues a valid JWT session token', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ phone: '9876543210', pin: '1234' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();
    expect(loginRes.body.merchantId).toBe('merchant_sharma_01');

    const profileRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .set('x-store-id', 'store_sharma_01');

    expect(profileRes.status).toBe(200);
    expect(profileRes.body.phone).toBe('9876543210');
  });

  it('6. Wrong PIN is rejected with 401 and no token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: '9876543210', pin: '9999' });
    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  it('7. Unregistered phone cannot log in (no auto-provisioning)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: '9000000000', pin: '1234' });
    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });
});
