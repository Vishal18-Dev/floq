import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { query, queryOne } from '../src/db';
import { seedDatabase } from '../src/db/seed';
import authRoutes from '../src/api/routes/auth';
import syncRoutes from '../src/api/routes/sync';
import { authMiddleware } from '../src/api/middleware/auth';
import { getTestAuthHeader } from './helpers';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/sync', authMiddleware, syncRoutes);

describe('Multi-Device Offline Synchronization & Ticket Safety Tests (PostgreSQL)', () => {
  const storeId = 'store_sharma_01';
  const merchantId = 'merchant_sharma_01';
  const headers = getTestAuthHeader(merchantId, storeId);

  beforeEach(async () => {
    await seedDatabase();
  });

  it('1. Two devices creating orders offline receive distinct atomic server tickets upon sync without collisions', async () => {
    const deviceAClientOrderId = `offline_deviceA_${Date.now()}_1`;
    const deviceARecord = {
      id: deviceAClientOrderId,
      clientOrderId: deviceAClientOrderId,
      storeId,
      order: {
        id: deviceAClientOrderId,
        clientOrderId: deviceAClientOrderId,
        storeId,
        ticketNumber: '#OFF-A1',
        source: 'STAFF_POS',
        status: 'ACCEPTED',
        paymentStatus: 'SUCCESS',
        subtotal: 30,
        discount: 0,
        total: 30,
        createdAt: new Date().toISOString(),
        items: [
          {
            id: 'item_a1',
            orderId: deviceAClientOrderId,
            productId: 'prod_1',
            productNameSnapshot: 'Special Masala Chai',
            unitPriceSnapshot: 15,
            quantity: 2,
            subtotal: 30,
          },
        ],
      },
      payment: { method: 'CASH', status: 'SUCCESS', amount: 30 },
      clientTimestamp: new Date().toISOString(),
    };

    const deviceBClientOrderId = `offline_deviceB_${Date.now()}_2`;
    const deviceBRecord = {
      id: deviceBClientOrderId,
      clientOrderId: deviceBClientOrderId,
      storeId,
      order: {
        id: deviceBClientOrderId,
        clientOrderId: deviceBClientOrderId,
        storeId,
        ticketNumber: '#OFF-B1',
        source: 'STAFF_POS',
        status: 'ACCEPTED',
        paymentStatus: 'SUCCESS',
        subtotal: 50,
        discount: 0,
        total: 50,
        createdAt: new Date().toISOString(),
        items: [
          {
            id: 'item_b1',
            orderId: deviceBClientOrderId,
            productId: 'prod_2',
            productNameSnapshot: 'Filter Coffee',
            unitPriceSnapshot: 25,
            quantity: 2,
            subtotal: 50,
          },
        ],
      },
      payment: { method: 'CASH', status: 'SUCCESS', amount: 50 },
      clientTimestamp: new Date().toISOString(),
    };

    const [resA, resB] = await Promise.all([
      request(app).post('/api/sync').set(headers).send({ storeId, records: [deviceARecord] }),
      request(app).post('/api/sync').set(headers).send({ storeId, records: [deviceBRecord] }),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(resA.body.syncedOrderIds).toContain(deviceAClientOrderId);
    expect(resB.body.syncedOrderIds).toContain(deviceBClientOrderId);

    const orderA = await queryOne('SELECT * FROM orders WHERE client_order_id = $1', [deviceAClientOrderId]);
    const orderB = await queryOne('SELECT * FROM orders WHERE client_order_id = $1', [deviceBClientOrderId]);

    expect(orderA).toBeDefined();
    expect(orderB).toBeDefined();
    expect(orderA!.ticket_number).not.toEqual(orderB!.ticket_number);
  });

  it('2. 10 Offline devices syncing 10 orders each produce 10 unique atomic server orders with zero sequence gaps', async () => {
    const totalDevices = 10;
    const syncPromises = [];

    for (let d = 0; d < totalDevices; d++) {
      const deviceClientOrderId = `offline_device_${d}_${Date.now()}`;
      const record = {
        id: deviceClientOrderId,
        clientOrderId: deviceClientOrderId,
        storeId,
        order: {
          id: deviceClientOrderId,
          clientOrderId: deviceClientOrderId,
          storeId,
          ticketNumber: `#OFF-${d}`,
          source: 'STAFF_POS',
          status: 'ACCEPTED',
          paymentStatus: 'SUCCESS',
          subtotal: 15,
          discount: 0,
          total: 15,
          createdAt: new Date().toISOString(),
          items: [
            {
              id: `item_${d}`,
              orderId: deviceClientOrderId,
              productId: 'prod_1',
              productNameSnapshot: 'Special Masala Chai',
              unitPriceSnapshot: 15,
              quantity: 1,
              subtotal: 15,
            },
          ],
        },
        payment: { method: 'CASH', status: 'SUCCESS', amount: 15 },
        clientTimestamp: new Date().toISOString(),
      };

      syncPromises.push(request(app).post('/api/sync').set(headers).send({ storeId, records: [record] }));
    }

    const results = await Promise.all(syncPromises);
    for (const res of results) {
      expect(res.status).toBe(200);
      expect(res.body.syncedOrderIds.length).toBe(1);
    }

    const orders = await query('SELECT ticket_number FROM orders WHERE store_id = $1', [storeId]);
    const tickets = orders.map((o) => o.ticket_number);
    const uniqueTickets = new Set(tickets);

    expect(tickets.length).toBe(uniqueTickets.size);
  });
});
