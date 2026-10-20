import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/server';
import { runMigrations } from '../src/db/migrate';
import { seedDatabase } from '../src/db/seed';
import { execute } from '../src/db';
import { config } from '../src/config';

const ADMIN = config.adminKey;

async function newStore(app: any) {
  const ob = await request(app).post(`/api/admin/onboard-merchant?key=${ADMIN}`).send({
    phone: '9333300000',
    pin: '4321',
    storeName: 'Paywall Test Store',
    mode: 'RETAIL',
    secondaryLanguage: 'hi',
    items: [{ name: 'Honey', nameLocal: 'शहद', price: 100, category: 'Products' }],
  });
  const token = (await request(app).post('/api/auth/login').send({ phone: '9333300000', pin: '4321' })).body.token;
  return { storeId: ob.body.storeId as string, token: token as string };
}

const auth = (app: any, method: 'get' | 'post', path: string, token: string, storeId: string) =>
  (request(app) as any)[method](path).set('Authorization', `Bearer ${token}`).set('x-store-id', storeId);

describe('Subscription paywall', () => {
  let app: any;
  beforeAll(async () => {
    app = createServer();
    await runMigrations();
  });
  beforeEach(async () => {
    await seedDatabase(true);
  });

  it('gates new sales on subscription status across the full lifecycle', async () => {
    const { storeId, token } = await newStore(app);
    const productId = (await auth(app, 'get', '/api/products', token, storeId)).body.products[0].id;
    const makeSale = () =>
      auth(app, 'post', '/api/orders', token, storeId).send({
        items: [{ productId, quantity: 1 }],
        paymentMethod: 'CASH',
        immediatePayment: true,
      });

    // New store starts on a trial and can sell.
    let status = await auth(app, 'get', '/api/subscription', token, storeId);
    expect(status.body.status).toBe('trial');
    expect(status.body.canSell).toBe(true);
    expect(status.body.prices.monthly).toBe(49);
    expect((await makeSale()).status).toBe(201);

    // Force the trial to have ended → sales blocked, reads still work.
    await execute('UPDATE subscriptions SET trial_ends_at = $1 WHERE store_id = $2', [
      new Date(Date.now() - 86400000).toISOString(),
      storeId,
    ]);
    status = await auth(app, 'get', '/api/subscription', token, storeId);
    expect(status.body.status).toBe('expired');
    expect(status.body.canSell).toBe(false);
    expect((await auth(app, 'get', '/api/products', token, storeId)).status).toBe(200); // reads open
    const blocked = await makeSale();
    expect(blocked.status).toBe(402);
    expect(blocked.body.error).toBe('SUBSCRIPTION_REQUIRED');

    // Merchant submits a manual UPI payment; admin verifies it → active again.
    const submit = await auth(app, 'post', '/api/subscription/submit', token, storeId).send({
      plan: 'monthly',
      upiReference: 'UTR123456',
    });
    expect(submit.status).toBe(201);
    const paymentId = submit.body.payment.id;

    const verify = await request(app)
      .post(`/api/admin/verify-subscription?key=${ADMIN}`)
      .send({ paymentId });
    expect(verify.status).toBe(200);
    expect(verify.body.success).toBe(true);

    status = await auth(app, 'get', '/api/subscription', token, storeId);
    expect(status.body.status).toBe('active');
    expect(status.body.plan).toBe('monthly');
    expect(status.body.daysLeft).toBeGreaterThan(27);
    expect((await makeSale()).status).toBe(201);
  });
});
