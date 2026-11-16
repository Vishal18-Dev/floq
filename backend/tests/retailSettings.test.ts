import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/services/firebaseAuth', () => ({
  verifyFirebaseIdToken: async (token: string) => ({ phoneNumber: `+91${String(token).replace('otp:', '')}` }),
}));

import { createServer } from '../src/server';
import { runMigrations } from '../src/db/migrate';

// Settings (design 5g): retail thresholds persist, and a new credit customer
// starts with the store's "Limit for new customers".
describe('Retail settings', () => {
  const app = createServer();
  beforeAll(async () => {
    await runMigrations();
  });

  it('saves low-stock/credit-term prefs and applies the default credit limit', async () => {
    const signup = await request(app)
      .post('/api/signup')
      .send({ idToken: 'otp:9833300003', storeName: 'Settings Kirana', mode: 'RETAIL' });
    expect(signup.status).toBe(201);
    const h = { Authorization: `Bearer ${signup.body.token}`, 'x-store-id': signup.body.storeIds[0] };

    const patch = await request(app)
      .patch('/api/stores/settings')
      .set(h)
      .send({ defaultCreditLimit: 5000, servicePrefs: { lowStockDays: 7, creditTermDays: 15 } });
    expect(patch.status).toBe(200);
    expect(patch.body.settings.defaultCreditLimit).toBe(5000);
    expect(patch.body.settings.servicePrefs).toMatchObject({ lowStockDays: 7, creditTermDays: 15 });

    const bad = await request(app).patch('/api/stores/settings').set(h).send({ servicePrefs: { creditTermDays: 9 } });
    expect(bad.status).toBe(400);

    const cust = await request(app).post('/api/retail/customers').set(h).send({ name: 'Meena', kind: 'REGULAR' });
    expect(cust.status).toBe(201);
    expect(cust.body.customer.creditLimit).toBe(5000);
  });
});
