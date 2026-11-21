import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/server';
import { seedDatabase } from '../src/db/seed';
import { queryOne } from '../src/db';
import { getTestAuthHeader } from './helpers';
import { authService } from '../src/services/authService';

// Regression tests for the C1–C7 findings in docs/security-audit-2026-11-21.md.
const S1 = 'store_sharma_01', M1 = 'merchant_sharma_01';
const S2 = 'store_chaipoint_02', M2 = 'merchant_chaipoint_02';

describe('Security: critical audit findings stay fixed', () => {
  let app: ReturnType<typeof createServer>;
  beforeEach(async () => {
    await seedDatabase();
    app = createServer(); // fresh rate-limit counters per test
  });

  async function upiPaymentInStore1() {
    const h = getTestAuthHeader(M1, S1);
    const p = await queryOne('SELECT id FROM products WHERE store_id = $1 LIMIT 1', [S1]);
    const o = await request(app).post('/api/orders').set(h).send({ items: [{ productId: p.id, quantity: 1 }] });
    const pay = await request(app).post('/api/payments').set(h).send({ orderId: o.body.order.id, method: 'UPI', amount: o.body.order.total });
    expect(pay.status).toBe(201);
    return { order: o.body.order, paymentId: pay.body.payment.id as string };
  }

  it('C1: no unauthenticated webhook can mark a payment paid', async () => {
    const { paymentId } = await upiPaymentInStore1();
    const r = await request(app).post('/api/payments/webhook').send({ paymentId, status: 'SUCCESS' });
    expect(r.status).toBe(401);
    expect((await queryOne('SELECT status FROM payments WHERE id = $1', [paymentId])).status).toBe('PENDING');
  });

  it("C2: another merchant cannot read, confirm or refund this store's payments", async () => {
    const { order, paymentId } = await upiPaymentInStore1();
    const other = getTestAuthHeader(M2, S2);
    expect((await request(app).get(`/api/payments/${paymentId}`).set(other)).status).toBe(404);
    expect((await request(app).post(`/api/payments/${paymentId}/confirm`).set(other)).status).toBe(404);
    expect((await request(app).post(`/api/payments/${paymentId}/refund`).set(other)).status).toBe(404);
    const create = await request(app).post('/api/payments').set(other).send({ orderId: order.id, method: 'CASH', amount: 1 });
    expect(create.status).toBe(404);
    expect((await queryOne('SELECT status FROM payments WHERE id = $1', [paymentId])).status).toBe('PENDING');
  });

  it("C3: the realtime stream refuses another merchant's store", async () => {
    const token = getTestAuthHeader(M1, S1).Authorization.slice(7);
    const r = await request(app).get(`/api/realtime?storeId=${S2}&token=${token}`);
    expect(r.status).toBe(403);
  });

  it('C4: staff cannot change UPI, prices or the team; managers cannot change UPI', async () => {
    const staff = getTestAuthHeader(M1, S1, 'STAFF');
    const manager = getTestAuthHeader(M1, S1, 'MANAGER');
    expect((await request(app).patch('/api/stores/settings').set(staff).send({ upiId: 'x@upi' })).status).toBe(403);
    expect((await request(app).patch('/api/stores/settings').set(manager).send({ upiId: 'x@upi' })).status).toBe(403);
    expect((await request(app).patch('/api/stores/settings').set(manager).send({ voiceEnabled: false })).status).toBe(200);
    expect((await request(app).post('/api/stores/apply-template').set(manager).send({ templateKey: 'TEA_STALL' })).status).toBe(403);

    const p = await queryOne('SELECT id FROM products WHERE store_id = $1 LIMIT 1', [S1]);
    expect((await request(app).patch(`/api/products/${p.id}`).set(staff).send({ price: 1 })).status).toBe(403);
    expect((await request(app).delete(`/api/products/${p.id}`).set(staff)).status).toBe(403);
    expect((await request(app).patch(`/api/products/${p.id}/availability`).set(staff).send({ isAvailable: false })).status).toBe(200);

    expect((await request(app).post('/api/team/invites').set(staff).send({ phone: '9811111111' })).status).toBe(403);
    expect((await request(app).post('/api/team/invites').set(manager).send({ phone: '9811111111', role: 'MANAGER' })).status).toBe(403);

    const { paymentId } = await upiPaymentInStore1();
    expect((await request(app).post(`/api/payments/${paymentId}/refund`).set(staff)).status).toBe(403);
    expect((await request(app).post(`/api/payments/${paymentId}/confirm`).set(staff)).status).toBe(200);

    const sale = await request(app).post('/api/orders').set(staff).send({ items: [{ productId: p.id, quantity: 1 }], paymentMethod: 'CREDIT', creditCustomerId: 'x' });
    expect(sale.status).toBe(403);
  });

  it('C5: QR customers cannot set their own price', async () => {
    const p = await queryOne('SELECT id, price FROM products WHERE store_id = $1 LIMIT 1', [S1]);
    const url = '/api/public/stores/sharma-breakfast-corner/orders';
    const withMod = await request(app).post(url).send({ items: [{ productId: p.id, quantity: 1, modifiers: [{ name: 'x', priceDelta: -Number(p.price) + 1 }] }] });
    expect(withMod.status).toBe(400);
    const adHoc = await request(app).post(url).send({ items: [{ name: 'anything', unitPrice: 1, quantity: 1 }] });
    expect(adHoc.status).toBe(400);
    const ok = await request(app).post(url).send({ items: [{ productId: p.id, quantity: 2 }] });
    expect(ok.status).toBe(201);
    expect(ok.body.order.total).toBe(Number(p.price) * 2);
  });

  it("C6: reusing another store's order id is a conflict, not a leak", async () => {
    const { order } = await upiPaymentInStore1();
    const r = await request(app).post('/api/orders').set(getTestAuthHeader(M2, S2)).send({ id: order.id, items: [{ name: 'x', unitPrice: 1, quantity: 1 }] });
    expect(r.status).toBe(409);
    expect(r.body.order).toBeUndefined();
    // Same store retrying with its own id still gets its order back (idempotent).
    const again = await request(app).post('/api/orders').set(getTestAuthHeader(M1, S1)).send({ id: order.id, items: [{ name: 'x', unitPrice: 1, quantity: 1 }] });
    expect(again.status).toBe(201);
    expect(again.body.order.id).toBe(order.id);
  });

  it('C7: parallel wrong PINs cannot get past the lockout', async () => {
    const user = await queryOne('SELECT id, phone FROM users LIMIT 1');
    await authService.setUserPin(user.id, '4826');
    const guesses = await Promise.all(
      Array.from({ length: 8 }, (_, i) => request(app).post('/api/auth/login').send({ phone: user.phone, pin: String(1000 + i) }))
    );
    expect(guesses.every((g) => g.status === 401)).toBe(true);
    const row = await queryOne('SELECT pin_attempts, pin_locked_until FROM users WHERE id = $1', [user.id]);
    expect(Number(row.pin_attempts)).toBe(8);
    expect(row.pin_locked_until).toBeTruthy();
    // Even the right PIN is refused while locked.
    const right = await request(app).post('/api/auth/login').send({ phone: user.phone, pin: '4826' });
    expect(right.status).toBe(401);
  });

  it('C7: login is rate-limited per phone number', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      statuses.push((await request(app).post('/api/auth/login').send({ phone: '9000000001', pin: '1234' })).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });
});
