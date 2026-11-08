import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';

// Mock Firebase token verification: an idToken of the form "otp:<10 digits>"
// resolves to that phone number. The real token check runs against Google
// certs on-device; here we exercise the account branches it feeds.
vi.mock('../src/services/firebaseAuth', () => ({
  verifyFirebaseIdToken: async (token: string) => ({ phoneNumber: `+91${String(token).replace('otp:', '')}` }),
}));

import { createServer } from '../src/server';
import { runMigrations } from '../src/db/migrate';

const OWNER = '9811100001';
const CLERK = '9822200002';
const STRANGER = '9800000000';

function auth(session: any) {
  return { Authorization: `Bearer ${session.token}`, 'x-store-id': session.storeIds[0] };
}

describe('Self-serve onboarding + team invites', () => {
  const app = createServer();
  beforeAll(async () => {
    await runMigrations();
  });

  it('signs up without a PIN, seeds the store, invites and accepts a clerk', async () => {
    // 1. Sign up (no PIN — set later as the device unlock).
    const signup = await request(app)
      .post('/api/signup')
      .send({ idToken: `otp:${OWNER}`, storeName: 'Test Kirana', mode: 'RETAIL', secondaryLanguage: 'ta' });
    expect(signup.status).toBe(201);
    expect(signup.body.token.length).toBeGreaterThan(20);
    const session = signup.body;

    // 2. Seed the catalogue, credit book and store answers.
    const seed = await request(app)
      .post('/api/stores/seed')
      .set(auth(session))
      .send({
        gstin: '29ABCDE1234F1Z5',
        openingTime: '08:00',
        closingTime: '22:00',
        creditEnabled: false,
        servicePrefs: { closedDays: ['Sun'] },
        items: [
          { name: 'Virgin coconut oil', isLoose: true, perKg: 320, stockKg: 12 },
          { name: 'Parle-G', packs: [{ size: '100 g', price: 10, stock: 40 }] },
        ],
        customers: [{ name: 'Ravi Stores', kind: 'SHOP', creditLimit: 5000, owes: 1200, oldestDueDays: 10 }],
      });
    expect(seed.status).toBe(201);
    expect(seed.body.itemsCreated).toBe(2);
    expect(seed.body.packsCreated).toBe(1);
    expect(seed.body.customersCreated).toBe(1);

    // Store answers persisted; credit turned off reflects in settings.
    const current = await request(app).get('/api/stores/current').set(auth(session));
    expect(current.status).toBe(200);
    expect(current.body.store.gstin).toBe('29ABCDE1234F1Z5');
    expect(current.body.store.openingTime).toBe('08:00');
    expect(current.body.settings.creditEnabled).toBe(false);

    const catalog = await request(app).get('/api/products').set(auth(session));
    expect(catalog.body.products.length).toBe(2);

    // 3. Invite a clerk.
    const invite = await request(app)
      .post('/api/team/invites')
      .set(auth(session))
      .send({ phone: CLERK, role: 'STAFF', title: 'Clerk' });
    expect(invite.status).toBe(201);
    const code = invite.body.invite.code;
    expect(code).toMatch(/^FLQ[A-Z0-9]{3}$/);

    // Owner can't invite their own number.
    const self = await request(app).post('/api/team/invites').set(auth(session)).send({ phone: OWNER, role: 'STAFF' });
    expect(self.status).toBe(400);
    expect(self.body.error).toBe('OWN_NUMBER');

    // 4. Public lookup shows the store + role.
    const lookup = await request(app).get(`/api/invites/${code}`);
    expect(lookup.status).toBe(200);
    expect(lookup.body.valid).toBe(true);
    expect(lookup.body.storeName).toBe('Test Kirana');
    expect(lookup.body.role).toBe('STAFF');

    // 5. Accepting from the wrong number is rejected.
    const wrong = await request(app).post(`/api/invites/${code}/accept`).send({ idToken: `otp:${STRANGER}` });
    expect(wrong.status).toBe(403);
    expect(wrong.body.error).toBe('WRONG_NUMBER');

    // 6. The invited number joins and lands in the same store as STAFF.
    const accept = await request(app).post(`/api/invites/${code}/accept`).send({ idToken: `otp:${CLERK}`, name: 'Suresh' });
    expect(accept.status).toBe(201);
    expect(accept.body.role).toBe('STAFF');
    expect(accept.body.storeIds).toEqual(session.storeIds);

    // The code is now spent.
    const reuse = await request(app).get(`/api/invites/${code}`);
    expect(reuse.status).toBe(410);
    expect(reuse.body.reason).toBe('ACCEPTED');
  });

  it('rejects an unknown invite code', async () => {
    const res = await request(app).get('/api/invites/FLQZZZ');
    expect(res.status).toBe(404);
    expect(res.body.valid).toBe(false);
  });
});
