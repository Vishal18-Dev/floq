import { describe, it, expect, beforeAll, vi } from 'vitest';

// End-to-end journeys using the payloads the vendor app actually sends.
// Firebase is stubbed, but tokens are full length (~1KB) like real ones: a
// 4-char 'fake' token is how the 500-char cap slipped through before.
let otpPhone = '+919555511111';
vi.mock('../src/services/firebaseAuth', () => ({
  verifyFirebaseIdToken: vi.fn(async () => ({ uid: `uid-${otpPhone}`, phoneNumber: otpPhone })),
}));

import request from 'supertest';
import { createServer } from '../src/server';
import { runMigrations } from '../src/db/migrate';
import { seedDatabase } from '../src/db/seed';
// The app's own onboarding mappers, so seed payloads can't drift from the app.
import { catalogToSeedItems, menuToSeedItems } from '../../apps/vendor/src/components/auth/onboardingData';

const TOKEN = 'eyJhbGciOiJSUzI1NiJ9.' + 'x'.repeat(1100);

describe('Vendor app end-to-end journeys', () => {
  let app: any;
  beforeAll(async () => {
    app = createServer();
    await runMigrations();
    await seedDatabase(true);
  });

  const authed = (s: { token: string; storeIds: string[] }) => ({
    get: (p: string) => request(app).get(`/api${p}`).set('Authorization', `Bearer ${s.token}`).set('x-store-id', s.storeIds[0]),
    post: (p: string, b: any = {}) => request(app).post(`/api${p}`).set('Authorization', `Bearer ${s.token}`).set('x-store-id', s.storeIds[0]).send(b),
    patch: (p: string, b: any = {}) => request(app).patch(`/api${p}`).set('Authorization', `Bearer ${s.token}`).set('x-store-id', s.storeIds[0]).send(b),
    del: (p: string, b: any = {}) => request(app).delete(`/api${p}`).set('Authorization', `Bearer ${s.token}`).set('x-store-id', s.storeIds[0]).send(b),
  });
  const ok = (res: any, _status?: number) => {
    if (res.status < 200 || res.status > 299) throw new Error(`${res.req?.method} ${res.req?.path} → ${res.status} ${JSON.stringify(res.body)}`);
    return res.body;
  };

  it('shop: signup → seed → sell (pack, loose, credit, wholesale) → stock → items → day close → team → PIN → delete', async () => {
    otpPhone = '+919555511111';
    // New number: OTP login says NEEDS_ONBOARDING, then the wizard signs up.
    const pre = await request(app).post('/api/auth/firebase').send({ idToken: TOKEN });
    expect(pre.status).toBe(404);
    const session = ok(await request(app).post('/api/signup').send({
      idToken: TOKEN, storeName: 'Ravi Kirana', ownerName: 'Ravi', mode: 'RETAIL', storeType: 'GROCERY', secondaryLanguage: 'none',
    }), 201);
    const a = authed(session);

    const items = catalogToSeedItems('kirana', ['tdal', 'pg', 'sfo', 'salt'], { tdal: 12, pg: 40, sfo: 6, salt: 10 });
    ok(await a.post('/stores/seed', { items, creditEnabled: true, defaultCreditLimit: 2000, initialCategoryName: 'Products' }));
    ok(await a.patch('/stores/settings', { upiId: 'ravi@okaxis', upiName: 'Ravi Kirana' }));

    const store = ok(await a.get('/stores/current'));
    expect(store.settings.upiId).toBe('ravi@okaxis');
    const cat = ok(await a.get('/products'));
    const parle = cat.products.find((p: any) => p.name === 'Parle-G');
    const dal = cat.products.find((p: any) => p.name === 'Toor dal');
    expect(parle.packs[0].stock).toBe(40);
    expect(dal.isLoose).toBe(true);

    // Counter bill: one pack + 500 g loose, cash with change.
    const storeId = session.storeIds[0];
    const cash = ok(await a.post('/orders', {
      storeId, source: 'STAFF_POS', paymentMethod: 'CASH', immediatePayment: true, cashTendered: 200,
      items: [{ packId: parle.packs[0].id, sellUnit: 'UNIT', quantity: 2 }, { productId: dal.id, sellUnit: 'GRAM', quantity: 500 }],
    }), 201);
    expect(cash.order.total).toBe(2 * 10 + 75);

    // A bill retried after a timeout carries the same id: one sale, one stock deduction.
    const retryBill = { id: 'sale_retry_1', storeId, source: 'STAFF_POS', paymentMethod: 'CASH', immediatePayment: true,
      items: [{ packId: parle.packs[0].id, sellUnit: 'UNIT', quantity: 1 }] };
    const first = ok(await a.post('/orders', retryBill)).order;
    const second = ok(await a.post('/orders', retryBill)).order;
    expect(second.id).toBe(first.id);

    // Credit sale to a new khata customer, then they pay.
    const cust = ok(await a.post('/retail/customers', { name: 'Lakshmi', kind: 'REGULAR', phone: '9000000001' }), 201).customer;
    expect(cust.creditLimit).toBe(2000);
    ok(await a.post('/orders', {
      storeId, source: 'STAFF_POS', paymentMethod: 'CREDIT', immediatePayment: false, creditCustomerId: cust.id,
      items: [{ packId: parle.packs[0].id, sellUnit: 'UNIT', quantity: 3 }],
    }), 201);
    const owing = ok(await a.get('/retail/customers')).customers.find((c: any) => c.id === cust.id);
    expect(owing.owes).toBe(30);
    expect(ok(await a.post(`/retail/customers/${cust.id}/paid`, {})).customer.owes).toBe(0);

    // Wholesale + UPI.
    ok(await a.post('/orders', {
      storeId, source: 'STAFF_POS', paymentMethod: 'UPI', immediatePayment: true, isWholesale: true,
      items: [{ packId: parle.packs[0].id, sellUnit: 'UNIT', quantity: 1 }],
    }), 201);

    // Stock: receive with a decimal typed on the numeric keypad, and loose in grams.
    ok(await a.post('/retail/stock/receive', { lines: [{ packId: parle.packs[0].id, qty: 2.5 }, { productId: dal.id, qty: 1500 }] }));
    // New product from the Stock screen (pack, decimal stock), and a loose one.
    const catId = cat.categories[0].id;
    ok(await a.post('/retail/products', {
      name: 'Good Day', categoryId: catId, isLoose: false,
      pack: { size: '75 g', price: 20, wholesalePrice: 18, costPrice: 15, stock: 7.5, caseQty: 24 },
    }), 201);
    ok(await a.post('/retail/products', { name: 'Jaggery', categoryId: catId, isLoose: true, perKg: 80, stockGrams: 2000 }), 201);

    // Items & prices: pack price, per-kg, rename via the whole-object save.
    ok(await a.patch(`/retail/packs/${parle.packs[0].id}`, { price: 12, wholesalePrice: null }));
    ok(await a.patch(`/retail/products/${dal.id}/per-kg`, { perKg: 160 }));
    const { packs, isLoose, perKg, stockGrams, dailyGrams, price, ...rest } = parle; // ItemsManager sends `rest` for retail
    ok(await a.patch(`/products/${parle.id}`, { ...rest, name: 'Parle-G Gold' }));
    ok(await a.patch(`/products/${parle.id}/availability`, { isAvailable: false }));
    ok(await a.patch(`/products/${parle.id}/availability`, { isAvailable: true }));

    const after = ok(await a.get('/products')).products;
    expect(after.find((p: any) => p.id === parle.id).packs[0].stock).toBe(40 - 2 - 1 - 3 - 1 + 3); // retry counted once; 2.5 rounds to 3
    expect(after.find((p: any) => p.name === 'Good Day').packs[0].stock).toBe(8);

    // Settings toggles exactly as SettingsScreen sends them.
    ok(await a.patch('/stores/settings', { servicePrefs: { ...store.settings.servicePrefs, lowStockDays: 5, creditTermDays: 15 } }));
    ok(await a.patch('/stores/settings', { secondaryLanguage: 'ta' }));
    ok(await a.patch('/stores/settings', { creditEnabled: false }));

    // Day: analytics, close, history.
    const daily = ok(await a.get('/analytics/daily'));
    expect(daily.totalRevenue ?? daily.revenue ?? daily.total).toBeGreaterThan(0);
    ok(await a.get('/analytics/day-status'));
    ok(await a.post('/analytics/close-day', {}));
    expect(ok(await a.get('/analytics/history')).days.length).toBeGreaterThan(0);

    // Subscription: trial status and a manual UPI submission.
    ok(await a.get('/subscription'));
    ok(await a.post('/subscription/submit', { plan: 'monthly', upiReference: '412345678901' }), 201);

    // Team: invite a staff number, they accept with their own OTP, owner removes them.
    const invite = ok(await a.post('/team/invites', { phone: '9555522222', role: 'STAFF', title: 'Counter' }), 201).invite;
    expect(ok(await request(app).get(`/api/invites/${invite.code}`)).valid).toBe(true);
    otpPhone = '+919555522222';
    const staff = ok(await request(app).post(`/api/invites/${invite.code}/accept`).send({ idToken: TOKEN }), 201);
    expect(staff.storeIds[0]).toBe(storeId);
    const members = ok(await a.get('/team/members')).members;
    const member = members.find((m: any) => m.role === 'STAFF');
    ok(await a.del(`/team/members/${member.id}`));
    expect((await authed(staff).get('/auth/me')).status).toBe(401);

    // Unlock PIN, PIN login, OTP login for the existing owner.
    ok(await a.post('/auth/set-pin', { pin: '4321' }));
    ok(await request(app).post('/api/auth/login').send({ phone: '9555511111', pin: '4321' }));
    otpPhone = '+919555511111';
    ok(await request(app).post('/api/auth/firebase').send({ idToken: TOKEN }));

    // Account deletion (Play/PhonePe requirement).
    ok(await a.del('/auth/me', { confirm: 'DELETE' }));
    expect((await request(app).post('/api/auth/firebase').send({ idToken: TOKEN })).status).toBe(404);
  });

  it('food counter: signup → menu seed → quick charge + menu sale → token flow → offline sync incl. quick charge', async () => {
    otpPhone = '+919555533333';
    const session = ok(await request(app).post('/api/signup').send({
      idToken: TOKEN, storeName: 'Anna Tea Stall', ownerName: 'Anna', mode: 'FOOD', storeType: 'FOOD_STALL', secondaryLanguage: 'ta',
    }), 201);
    const a = authed(session);
    const storeId = session.storeIds[0];

    const items = menuToSeedItems([{ name: 'Tea', price: 15, on: true }, { name: 'Vada', price: 12, on: true }, { name: 'Off', price: 5, on: false }]);
    ok(await a.post('/stores/seed', {
      items, openingTime: '06:00', closingTime: '22:00', initialCategoryName: 'Menu',
      servicePrefs: { payFirst: true, callBy: 'number', service: ['counter'], closedDays: ['Sun'] },
    }));
    const tea = ok(await a.get('/products')).products.find((p: any) => p.name === 'Tea');

    // Online sale: one menu line + one quick-charge amount line (SellScreen ChargeLine).
    const sale = ok(await a.post('/orders', {
      storeId, source: 'STAFF_POS', paymentMethod: 'CASH', immediatePayment: true,
      items: [{ productId: tea.id, quantity: 2 }, { name: 'Quick sale', unitPrice: 40, quantity: 1 }],
    }), 201).order;
    expect(sale.total).toBe(70);

    // Token queue: walk the order to completion as the Live queue does.
    let status = sale.status;
    const next: Record<string, string> = { NEW: 'ACCEPTED', ACCEPTED: 'PREPARING', PREPARING: 'READY', READY: 'COMPLETED' };
    while (status !== 'COMPLETED') {
      status = ok(await a.patch(`/orders/${sale.id}/status`, { status: next[status] })).order.status;
    }
    ok(await a.get('/orders'));
    ok(await a.get('/queue'));

    // Offline sale, shaped exactly like App.tsx createSale's offline branch.
    const clientOrderId = `offline_${Date.now()}_abcde`;
    const now = new Date().toISOString();
    const offlineOrder = {
      id: clientOrderId, clientOrderId, storeId, ticketNumber: 'OFF-1', source: 'STAFF_POS', status: 'ACCEPTED', paymentStatus: 'SUCCESS',
      subtotal: 65, discount: 0, total: 65, createdAt: now, acceptedAt: now,
      items: [
        { id: 'item_1', orderId: clientOrderId, productId: tea.id, productNameSnapshot: 'Tea', unitPriceSnapshot: 15, quantity: 1, subtotal: 15 },
        { id: 'item_2', orderId: clientOrderId, productId: 'CUSTOM', productNameSnapshot: 'Quick sale', unitPriceSnapshot: 50, quantity: 1, subtotal: 50 },
      ],
    };
    const sync = ok(await a.post('/sync', {
      storeId, records: [{ id: clientOrderId, clientOrderId, storeId, order: offlineOrder, payment: { method: 'CASH', status: 'SUCCESS', amount: 65 }, clientTimestamp: now }],
    }));
    expect(sync.failedOrderIds).toEqual([]);
    expect(sync.syncedOrderIds).toEqual([clientOrderId]);
    const synced = ok(await a.get('/orders')).orders.find((o: any) => o.clientOrderId === clientOrderId || o.id === clientOrderId);
    expect(synced.total).toBe(65);
    // Replaying the same record is a no-op (idempotent).
    const again = ok(await a.post('/sync', {
      storeId, records: [{ id: clientOrderId, clientOrderId, storeId, order: offlineOrder, payment: { method: 'CASH' }, clientTimestamp: now }],
    }));
    expect(again.syncedOrderIds).toEqual([clientOrderId]);
  });
});
