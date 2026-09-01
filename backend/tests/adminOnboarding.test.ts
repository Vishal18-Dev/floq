import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/server';
import { runMigrations } from '../src/db/migrate';
import { seedDatabase } from '../src/db/seed';

describe('White-Glove Merchant Onboarding & Self-Service Menu Workflow (PostgreSQL)', () => {
  let app: any;

  beforeAll(async () => {
    app = createServer();
    await runMigrations();
  });

  beforeEach(async () => {
    await seedDatabase(true);
  });

  it('1. Rejects onboarding request without valid ADMIN_KEY (Returns 403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/admin/onboard-merchant')
      .send({
        merchantName: 'Test Vendor',
        phone: '9988776655',
        storeName: 'Test Stall',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('2. Successfully onboards a new merchant, provisions store, user & category, and enables login', async () => {
    // 1. Onboard Merchant via Admin API
    const onboardRes = await request(app)
      .post('/api/admin/onboard-merchant?key=floq_admin_seed_secret')
      .send({
        merchantName: 'Vikram Singh',
        phone: '9123456789',
        storeName: 'Singh Refreshment',
        storeType: 'BREAKFAST',
        address: 'MG Road, Pune',
        upiId: 'vikram.singh@icici',
        upiName: 'Vikram Singh Store',
        initialCategoryName: 'Hot Snacks',
      });

    expect(onboardRes.status).toBe(201);
    expect(onboardRes.body.success).toBe(true);
    expect(onboardRes.body.merchantId).toContain('merchant_singh_refreshment');
    expect(onboardRes.body.storeId).toContain('store_singh_refreshment');
    expect(onboardRes.body.userId).toBe('user_9123456789');

    // 2. Newly onboarded merchant requests OTP
    const otpReqRes = await request(app)
      .post('/api/auth/otp/request')
      .send({ phone: '9123456789' });

    expect(otpReqRes.status).toBe(200);
    expect(otpReqRes.body.success).toBe(true);

    // 3. Newly onboarded merchant verifies OTP and gets JWT token
    const otpVerifyRes = await request(app)
      .post('/api/auth/otp/verify')
      .send({ phone: '9123456789', otp: '123456' });

    expect(otpVerifyRes.status).toBe(200);
    expect(otpVerifyRes.body.name).toBe('Vikram Singh');
    expect(otpVerifyRes.body.merchantId).toBe(onboardRes.body.merchantId);
    expect(otpVerifyRes.body.storeIds).toContain(onboardRes.body.storeId);
    expect(otpVerifyRes.body.token).toBeDefined();

    const token = otpVerifyRes.body.token;

    // 4. Merchant adds a custom product under their store
    const createProductRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .set('x-store-id', onboardRes.body.storeId)
      .send({
        name: 'Vada Pav Special',
        categoryId: onboardRes.body.initialCategoryId,
        price: 25,
        description: 'Authentic Maharashtrian Vada Pav',
        station: 'HOT_FOOD',
        isAvailable: true,
      });

    expect(createProductRes.status).toBe(201);
    expect(createProductRes.body.product.name).toBe('Vada Pav Special');
    expect(createProductRes.body.product.price).toBe(25);

    // 5. Verify product listing under store
    const getProductsRes = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .set('x-store-id', onboardRes.body.storeId);

    expect(getProductsRes.status).toBe(200);
    expect(getProductsRes.body.products).toHaveLength(1);
    expect(getProductsRes.body.products[0].name).toBe('Vada Pav Special');
  });

  it('3. Idempotent onboarding for existing phone number returns existing merchant details without errors', async () => {
    const res = await request(app)
      .post('/api/admin/onboard-merchant?key=floq_admin_seed_secret')
      .send({
        merchantName: 'Ramesh Sharma',
        phone: '9876543210',
        storeName: 'Sharma Corner',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.alreadyExisted).toBe(true);
    expect(res.body.phone).toBe('9876543210');
  });
});
