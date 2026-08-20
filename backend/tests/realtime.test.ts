import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/server';
import { seedDatabase } from '../src/db/seed';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';

describe('P0-3 Authenticated Realtime SSE Server Tests (PostgreSQL)', () => {
  const app = createServer();

  beforeEach(async () => {
    await seedDatabase();
  });

  it('1. Unauthenticated /api/realtime connection returns 401 Unauthorized', async () => {
    const res = await request(app).get('/api/realtime?storeId=store_sharma_01');
    expect(res.status).toBe(401);
  });

  it('2. Authenticated /api/realtime connection connects and emits CONNECTED event with eventId', async () => {
    const token = jwt.sign(
      { userId: 'user_sharma_01', merchantId: 'merchant_sharma_01', storeIds: ['store_sharma_01'], role: 'OWNER' },
      config.jwtSecret
    );

    const req = request(app)
      .get(`/api/realtime?storeId=store_sharma_01&token=${token}`)
      .set('Accept', 'text/event-stream');

    const res = await new Promise<any>((resolve, reject) => {
      req.parse((res, callback) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk.toString();
          if (data.includes('CONNECTED')) {
            resolve({ status: res.statusCode, headers: res.headers, text: data });
            (res as any).destroy();
          }
        });
      }).end((err) => {
        if (err && !err.message.includes('aborted') && !err.message.includes('socket hang up')) {
          reject(err);
        }
      });
    });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('type":"CONNECTED"');
    expect(res.text).toContain('eventId":');
  });
});
