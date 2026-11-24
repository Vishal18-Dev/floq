import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../src/services/firebaseAuth', () => ({
  verifyFirebaseIdToken: async (token: string) => ({ phoneNumber: `+91${String(token).replace('otp:', '')}` }),
}));

import { createServer } from '../src/server';
import { runMigrations } from '../src/db/migrate';
import { query } from '../src/db';
import { config } from '../src/config';

const OWNER = '9833300003';

describe('Account deletion (DELETE /api/auth/me)', () => {
  const app = createServer();
  beforeAll(async () => {
    await runMigrations();
  });

  it('staff deletes only their login; owner deletes the whole shop; old tokens stop working', async () => {
    const signup = await request(app).post('/api/signup').send({ idToken: `otp:${OWNER}`, storeName: 'Delete Me Kirana', mode: 'RETAIL' });
    expect(signup.status).toBe(201);
    const { merchantId, storeIds } = signup.body;
    const storeId = storeIds[0];
    const owner = { Authorization: `Bearer ${signup.body.token}`, 'x-store-id': storeId };

    const seed = await request(app).post('/api/stores/seed').set(owner).send({
      creditEnabled: true,
      items: [{ name: 'Parle-G', packs: [{ size: '100 g', price: 10, stock: 40 }] }],
      customers: [{ name: 'Ravi Stores', kind: 'SHOP', creditLimit: 5000, owes: 1200, oldestDueDays: 10 }],
    });
    expect(seed.status).toBe(201);

    // A staff login on the same shop.
    await query(
      `INSERT INTO users (id, phone, name, role, merchant_id, store_ids_json, status, created_at, updated_at)
       VALUES ('user_del_staff', '9833300004', 'Clerk', 'STAFF', $1, $2, 'ACTIVE', $3, $3)`,
      [merchantId, JSON.stringify([storeId]), new Date().toISOString()]
    );
    const staffToken = jwt.sign({ userId: 'user_del_staff', phone: '9833300004', merchantId, storeIds: [storeId], role: 'STAFF' }, config.jwtSecret);
    const staff = { Authorization: `Bearer ${staffToken}`, 'x-store-id': storeId };

    // Confirmation is required.
    expect((await request(app).delete('/api/auth/me').set(staff).send({})).status).toBe(400);

    const staffDel = await request(app).delete('/api/auth/me').set(staff).send({ confirm: 'DELETE' });
    expect(staffDel.status).toBe(200);
    expect(staffDel.body.scope).toBe('USER');
    expect((await request(app).get('/api/stores/current').set(staff)).status).toBe(401);
    expect((await request(app).get('/api/stores/current').set(owner)).status).toBe(200);

    const ownerDel = await request(app).delete('/api/auth/me').set(owner).send({ confirm: 'DELETE' });
    expect(ownerDel.status).toBe(200);
    expect(ownerDel.body.scope).toBe('MERCHANT');
    expect((await request(app).get('/api/stores/current').set(owner)).status).toBe(401);

    expect(await query('SELECT id FROM merchants WHERE id = $1', [merchantId])).toHaveLength(0);
    expect(await query('SELECT id FROM stores WHERE id = $1', [storeId])).toHaveLength(0);
    expect(await query('SELECT id FROM users WHERE merchant_id = $1', [merchantId])).toHaveLength(0);
    expect(await query('SELECT id FROM products WHERE store_id = $1', [storeId])).toHaveLength(0);
    expect(await query('SELECT id FROM credit_customers WHERE store_id = $1', [storeId])).toHaveLength(0);

    // The phone number can sign up again from scratch.
    const again = await request(app).post('/api/signup').send({ idToken: `otp:${OWNER}`, storeName: 'Fresh Start', mode: 'RETAIL' });
    expect(again.status).toBe(201);
  });
});
