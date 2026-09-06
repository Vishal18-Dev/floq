import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/server';
import { runMigrations } from '../src/db/migrate';
import { seedDatabase } from '../src/db/seed';
import { config } from '../src/config';

const ADMIN = config.adminKey;

async function onboard(app: any, body: any) {
  return request(app).post(`/api/admin/onboard-merchant?key=${ADMIN}`).send(body);
}
async function login(app: any, phone: string, pin: string) {
  const res = await request(app).post('/api/auth/login').send({ phone, pin });
  return res.body.token as string;
}

describe('Beta redesign features', () => {
  let app: any;
  beforeAll(async () => {
    app = createServer();
    await runMigrations();
  });
  beforeEach(async () => {
    await seedDatabase(true);
  });

  it('RETAIL store completes a counter sale immediately (no queue)', async () => {
    const ob = await onboard(app, {
      merchantName: 'Keramruth Store',
      phone: '9111100000',
      pin: '2468',
      storeName: 'Keramruth Store',
      mode: 'RETAIL',
      secondaryLanguage: 'hi',
      items: [{ name: 'A2 Ghee', nameLocal: 'घी', price: 750, category: 'Dairy' }],
    });
    expect(ob.status).toBe(201);
    expect(ob.body.mode).toBe('RETAIL');
    const storeId = ob.body.storeId;
    const token = await login(app, '9111100000', '2468');

    const catalog = await request(app).get('/api/products').set('Authorization', `Bearer ${token}`).set('x-store-id', storeId);
    const productId = catalog.body.products[0].id;

    const order = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('x-store-id', storeId)
      .send({ items: [{ productId, quantity: 2 }], paymentMethod: 'CASH', immediatePayment: true });

    expect(order.status).toBe(201);
    expect(order.body.order.status).toBe('COMPLETED');
    expect(order.body.order.paymentStatus).toBe('SUCCESS');
    expect(order.body.order.total).toBe(1500);
  });

  it('FOOD store keeps a counter sale in the queue as ACCEPTED', async () => {
    const token = await login(app, '9876543210', '1234');
    const catalog = await request(app).get('/api/products').set('Authorization', `Bearer ${token}`).set('x-store-id', 'store_sharma_01');
    const productId = catalog.body.products[0].id;

    const order = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('x-store-id', 'store_sharma_01')
      .send({ items: [{ productId, quantity: 1 }], paymentMethod: 'CASH', immediatePayment: true });

    expect(order.status).toBe(201);
    expect(order.body.order.status).toBe('ACCEPTED');
    expect(order.body.order.paymentStatus).toBe('SUCCESS');
  });

  it('Quick-charge ad-hoc line (no productId) works', async () => {
    const token = await login(app, '9876543210', '1234');
    const order = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('x-store-id', 'store_sharma_01')
      .send({ items: [{ name: 'Quick sale', unitPrice: 45, quantity: 1 }], paymentMethod: 'CASH', immediatePayment: true });
    expect(order.status).toBe(201);
    expect(order.body.order.total).toBe(45);
  });

  it('Sold-out toggle flips availability (store-scoped)', async () => {
    const token = await login(app, '9876543210', '1234');
    const catalog = await request(app).get('/api/products').set('Authorization', `Bearer ${token}`).set('x-store-id', 'store_sharma_01');
    const productId = catalog.body.products[0].id;

    const off = await request(app)
      .patch(`/api/products/${productId}/availability`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-store-id', 'store_sharma_01')
      .send({ isAvailable: false });
    expect(off.status).toBe(200);
    expect(off.body.product.isAvailable).toBe(false);
  });

  it('Close-day records a snapshot', async () => {
    const token = await login(app, '9876543210', '1234');
    const res = await request(app)
      .post('/api/analytics/close-day')
      .set('Authorization', `Bearer ${token}`)
      .set('x-store-id', 'store_sharma_01')
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.summary).toBeDefined();
  });

  it('Onboarding is bilingual: item nameLocal is stored', async () => {
    const ob = await onboard(app, {
      merchantName: 'Hotel TamilNadu',
      phone: '9222200000',
      pin: '1357',
      storeName: 'Hotel TamilNadu',
      mode: 'FOOD',
      secondaryLanguage: 'ta',
      items: [{ name: 'Idly', nameLocal: 'இட்லி', price: 30, category: 'Tiffin' }],
    });
    const storeId = ob.body.storeId;
    const token = await login(app, '9222200000', '1357');
    const catalog = await request(app).get('/api/products').set('Authorization', `Bearer ${token}`).set('x-store-id', storeId);
    expect(catalog.body.products[0].nameLocal).toBe('இட்லி');
  });
});
