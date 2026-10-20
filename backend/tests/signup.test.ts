import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// Stub the Firebase token verification so the route runs without a real OTP.
vi.mock('../src/services/firebaseAuth', () => ({
  verifyFirebaseIdToken: vi.fn(async () => ({ uid: 'test-uid', phoneNumber: '+919555500001' })),
}));

import request from 'supertest';
import { createServer } from '../src/server';
import { runMigrations } from '../src/db/migrate';
import { seedDatabase } from '../src/db/seed';

describe('Self-serve signup', () => {
  let app: any;
  beforeAll(async () => {
    app = createServer();
    await runMigrations();
  });
  beforeEach(async () => {
    await seedDatabase(true);
  });

  it('creates an account from the verified phone with an empty catalogue', async () => {
    const res = await request(app).post('/api/signup').send({
      idToken: 'fake',
      storeName: 'New Shop',
      mode: 'RETAIL',
      storeType: 'GROCERY',
      secondaryLanguage: 'hi',
      city: 'Chennai',
      upiId: 'someone@okaxis',
      imageUrl: 'https://res.cloudinary.com/ojpc628z/image/upload/x.jpg',
      pin: '4455',
    });
    expect(res.status).toBe(201);
    expect(res.body.token.length).toBeGreaterThan(20);
    expect(res.body.storeIds.length).toBe(1);

    const token = res.body.token;
    const storeId = res.body.storeIds[0];
    const store = await request(app).get('/api/stores/current').set('Authorization', `Bearer ${token}`).set('x-store-id', storeId);
    expect(store.body.store.name).toBe('New Shop');
    expect(store.body.store.city).toBe('Chennai');
    expect(store.body.store.imageUrl).toContain('cloudinary');
    expect(store.body.settings.upiName).toBe('New Shop'); // org name, not a person

    const products = await request(app).get('/api/products').set('Authorization', `Bearer ${token}`).set('x-store-id', storeId);
    expect(products.body.products.length).toBe(0);
    expect(products.body.categories.length).toBe(1);
  });

  it('rejects a second signup for the same number (account exists)', async () => {
    const body = { idToken: 'fake', storeName: 'Dup', mode: 'RETAIL', storeType: 'GROCERY', pin: '4455' };
    const first = await request(app).post('/api/signup').send(body);
    expect(first.status).toBe(201);
    const second = await request(app).post('/api/signup').send(body);
    expect(second.status).toBe(409);
  });
});
