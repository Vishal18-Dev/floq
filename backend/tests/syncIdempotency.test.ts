import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/server';
import { seedDatabase } from '../src/db/seed';
import { queryOne } from '../src/db';
import { getTestAuthHeader } from './helpers';

describe('P0-5 Idempotent Offline Sync & Ticket Stability Tests (PostgreSQL)', () => {
  const app = createServer();

  beforeEach(async () => {
    await seedDatabase();
  });

  it('1. Offline order preserves clientOrderId and ticketNumber during sync', async () => {
    const storeId = 'store_sharma_01';
    const headers = getTestAuthHeader('merchant_sharma_01', storeId);
    const product = await queryOne('SELECT id FROM products WHERE store_id = $1 LIMIT 1', [storeId]);

    const offlineOrderId = `client_uuid_1001`;
    const offlineTicketNumber = `#145`;

    const syncPayload = {
      storeId,
      records: [
        {
          id: offlineOrderId,
          clientOrderId: offlineOrderId,
          storeId,
          order: {
            id: offlineOrderId,
            clientOrderId: offlineOrderId,
            storeId,
            source: 'STAFF_POS',
            status: 'COMPLETED',
            ticketNumber: offlineTicketNumber,
            items: [{ productId: product!.id, quantity: 2 }],
          },
          clientTimestamp: new Date().toISOString(),
        },
      ],
    };

    const res = await request(app)
      .post('/api/sync')
      .set(headers)
      .send(syncPayload);

    expect(res.status).toBe(200);
    expect(res.body.syncedOrderIds).toContain(offlineOrderId);

    const savedOrder = await queryOne('SELECT * FROM orders WHERE id = $1', [offlineOrderId]);
    expect(savedOrder).toBeDefined();
    expect(savedOrder!.ticket_number).toBe(offlineTicketNumber);
    expect(savedOrder!.client_order_id).toBe(offlineOrderId);
  });

  it('2. Duplicate sync requests are 100% idempotent and do not duplicate orders or tickets', async () => {
    const storeId = 'store_sharma_01';
    const headers = getTestAuthHeader('merchant_sharma_01', storeId);
    const product = await queryOne('SELECT id FROM products WHERE store_id = $1 LIMIT 1', [storeId]);

    const offlineOrderId = `client_uuid_2002`;

    const syncPayload = {
      storeId,
      records: [
        {
          id: offlineOrderId,
          clientOrderId: offlineOrderId,
          storeId,
          order: {
            id: offlineOrderId,
            clientOrderId: offlineOrderId,
            storeId,
            source: 'STAFF_POS',
            status: 'COMPLETED',
            ticketNumber: '#200',
            items: [{ productId: product!.id, quantity: 1 }],
          },
          clientTimestamp: new Date().toISOString(),
        },
      ],
    };

    const res1 = await request(app).post('/api/sync').set(headers).send(syncPayload);
    expect(res1.status).toBe(200);

    const res2 = await request(app).post('/api/sync').set(headers).send(syncPayload);
    expect(res2.status).toBe(200);
    expect(res2.body.syncedOrderIds).toContain(offlineOrderId);
    expect(res2.body.failedOrderIds.length).toBe(0);

    const orderRows = await queryOne('SELECT COUNT(*) as c FROM orders WHERE client_order_id = $1', [offlineOrderId]);
    expect(Number(orderRows.c)).toBe(1);
  });
});
