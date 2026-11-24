import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createServer } from '../src/server';
import { seedDatabase } from '../src/db/seed';
import { query } from '../src/db';
import { config } from '../src/config';
import { getTestAuthHeader } from './helpers';

const M1 = 'merchant_sharma_01', S1 = 'store_sharma_01';

describe('HIGH audit fixes (H1–H4)', () => {
  const app = createServer();
  beforeAll(async () => {
    await seedDatabase();
  });

  it('H2: tokens and the admin key are accepted only in headers', async () => {
    const token = getTestAuthHeader(M1, S1).Authorization.slice(7);
    expect((await request(app).get(`/api/stores/current?token=${token}&storeId=${S1}`)).status).toBe(401);
    expect((await request(app).post(`/api/admin/onboard-merchant?key=${config.adminKey}`).send({})).status).toBe(403);
  });

  it('H4: oversized strings and arrays are rejected', async () => {
    const h = getTestAuthHeader(M1, S1);
    const longNote = await request(app).post('/api/orders').set(h).send({ items: [{ name: 'x', unitPrice: 1, quantity: 1 }], notes: 'a'.repeat(501) });
    expect(longNote.status).toBe(400);
    const records = Array.from({ length: 101 }, (_, i) => ({ id: `r${i}`, storeId: S1, clientTimestamp: new Date().toISOString(), order: { id: `o${i}`, items: [] } }));
    expect((await request(app).post('/api/sync').set(h).send({ storeId: S1, records })).status).toBe(400);
    expect((await request(app).post('/api/sync').set(h).send({ storeId: S1, records: [{ id: 'r', storeId: S1, clientTimestamp: 'x', order: 'not-an-object' }] })).status).toBe(400);
  });

  it('H4: sync refuses sales made after the subscription ended', async () => {
    await query("UPDATE subscriptions SET plan = 'trial', trial_ends_at = $2, current_period_end = NULL WHERE store_id = $1", [S1, '2020-01-01T00:00:00.000Z']);
    const h = getTestAuthHeader(M1, S1);
    const r = await request(app).post('/api/sync').set(h).send({
      storeId: S1,
      records: [{ id: 'late', storeId: S1, clientTimestamp: new Date().toISOString(), order: { id: 'order_after_expiry', items: [] } }],
    });
    expect(r.status).toBe(200);
    expect(r.body.failedOrderIds).toEqual([{ id: 'order_after_expiry', reason: 'SUBSCRIPTION_REQUIRED' }]);
    await query('DELETE FROM subscriptions WHERE store_id = $1', [S1]);
  });

  it('H1: owner removes a staff member and their token stops working', async () => {
    const now = new Date().toISOString();
    await query(
      `INSERT INTO users (id, phone, name, role, merchant_id, store_ids_json, status, created_at, updated_at)
       VALUES ('user_h1_staff', '9844400005', 'Leaver', 'STAFF', $1, $2, 'ACTIVE', $3, $3)`,
      [M1, JSON.stringify([S1]), now]
    );
    const staffToken = jwt.sign({ userId: 'user_h1_staff', phone: '9844400005', merchantId: M1, storeIds: [S1], role: 'STAFF' }, config.jwtSecret);
    const staff = { Authorization: `Bearer ${staffToken}`, 'x-store-id': S1 };
    const owner = getTestAuthHeader(M1, S1);

    expect((await request(app).delete('/api/team/members/user_sharma_owner').set(staff)).status).toBe(403);
    expect((await request(app).delete('/api/team/members/user_sharma_owner').set(owner)).status).toBe(400);
    expect((await request(app).get('/api/stores/current').set(staff)).status).toBe(200);

    expect((await request(app).delete('/api/team/members/user_h1_staff').set(owner)).status).toBe(200);
    expect((await request(app).get('/api/stores/current').set(staff)).status).toBe(401);
    expect((await request(app).delete('/api/team/members/user_h1_staff').set(owner)).status).toBe(404);
  });
});
