import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/server';
import { runMigrations } from '../src/db/migrate';
import { seedDatabase } from '../src/db/seed';
import { config } from '../src/config';

const ADMIN = config.adminKey;

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
    // 1. Onboard Merchant via Admin API (mode + language + PIN + UPI + catalogue)
    const onboardRes = await request(app)
      .post(`/api/admin/onboard-merchant?key=${ADMIN}`)
      .send({
        merchantName: 'Vikram Singh',
        phone: '9123456789',
        pin: '4321',
        storeName: 'Singh Refreshment',
        storeType: 'BREAKFAST',
        mode: 'FOOD',
        secondaryLanguage: 'hi',
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

    // 2. Newly onboarded merchant logs in with phone + PIN
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ phone: '9123456789', pin: '4321' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.name).toBe('Vikram Singh');
    expect(loginRes.body.merchantId).toBe(onboardRes.body.merchantId);
    expect(loginRes.body.storeIds).toContain(onboardRes.body.storeId);
    expect(loginRes.body.token).toBeDefined();

    const token = loginRes.body.token;

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
      .post(`/api/admin/onboard-merchant?key=${ADMIN}`)
      .send({
        merchantName: 'Ramesh Sharma',
        phone: '9876543210',
        pin: '1234',
        storeName: 'Sharma Corner',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.alreadyExisted).toBe(true);
    expect(res.body.phone).toBe('9876543210');
  });

  it('4. Onboards a RETAIL merchant with packs, a loose good, a supplier and an opening khata', async () => {
    const onboardRes = await request(app)
      .post(`/api/admin/onboard-merchant?key=${ADMIN}`)
      .send({
        phone: '9000011122',
        pin: '2468',
        storeName: 'Anbu Naturals',
        mode: 'RETAIL',
        storeType: 'GROCERY',
        secondaryLanguage: 'ta',
        upiId: 'anbu@okaxis',
        initialCategoryName: 'Oils',
        suppliers: { Oils: 'Kerala Coco Farms', Loose: 'Erode Traders' },
        items: [
          {
            name: 'Coconut oil',
            category: 'Oils',
            packs: [{ size: '1 L', price: 590, wholesalePrice: 520, costPrice: 450, stock: 20, caseQty: 12 }],
          },
          { name: 'Turmeric (loose)', category: 'Loose', isLoose: true, perKg: 280, stockKg: 7.5 },
        ],
        customers: [{ name: 'Selvi Provisions', kind: 'SHOP', creditLimit: 15000, owes: 12400, oldestDueDays: 41 }],
      });

    expect(onboardRes.status).toBe(201);
    expect(onboardRes.body.itemsCreated).toBe(2);
    expect(onboardRes.body.packsCreated).toBe(1);
    expect(onboardRes.body.customersCreated).toBe(1);

    const login = await request(app).post('/api/auth/login').send({ phone: '9000011122', pin: '2468' });
    expect(login.status).toBe(200);
    const token = login.body.token;
    const storeId = login.body.storeIds[0];
    const headers = { Authorization: `Bearer ${token}`, 'x-store-id': storeId };

    // Catalogue carries the pack, the loose good and the category supplier.
    const cat = await request(app).get('/api/products').set(headers);
    expect(cat.status).toBe(200);
    const oil = cat.body.products.find((p: any) => p.name === 'Coconut oil');
    expect(oil.packs).toHaveLength(1);
    expect(oil.packs[0].wholesalePrice).toBe(520);
    const turmeric = cat.body.products.find((p: any) => p.name === 'Turmeric (loose)');
    expect(turmeric.isLoose).toBe(true);
    expect(turmeric.stockGrams).toBe(7500);
    const oilsCat = cat.body.categories.find((c: any) => c.name === 'Oils');
    expect(oilsCat.supplier).toBe('Kerala Coco Farms');

    // Opening khata shows up, aged.
    const dues = await request(app).get('/api/retail/customers').set(headers);
    expect(dues.status).toBe(200);
    const selvi = dues.body.customers.find((c: any) => c.name === 'Selvi Provisions');
    expect(selvi.owes).toBe(12400);
    expect(selvi.days).toBeGreaterThanOrEqual(40);
  });
});
