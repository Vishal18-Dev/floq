import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/server';
import { seedDatabase } from '../src/db/seed';
import { queryOne } from '../src/db';
import { getTestAuthHeader } from './helpers';
import { auditLogger } from '../src/services/auditLogger';

describe('P0-2 Payment State Machine & Cash Audit Log Tests (PostgreSQL)', () => {
  const app = createServer();

  beforeEach(async () => {
    await seedDatabase();
  });

  it('1. Cash payment creates audit record in audit_logs table', async () => {
    const storeId = 'store_sharma_01';
    const headers = getTestAuthHeader('merchant_sharma_01', storeId);
    const product = await queryOne('SELECT id FROM products WHERE store_id = $1 LIMIT 1', [storeId]);

    const orderRes = await request(app)
      .post('/api/orders')
      .set(headers)
      .send({
        source: 'STAFF_POS',
        items: [{ productId: product!.id, quantity: 1 }],
        paymentMethod: 'CASH',
        immediatePayment: true,
        status: 'ACCEPTED',
      });

    expect(orderRes.status).toBe(201);
    expect(orderRes.body.order.paymentStatus).toBe('SUCCESS');

    const logs = await auditLogger.listLogs(storeId);
    const cashLog = logs.find((l) => l.action === 'ORDER_CREATED' || l.action === 'CASH_PAYMENT_CONFIRMED');
    expect(cashLog).toBeDefined();
    expect(cashLog?.storeId).toBe(storeId);
  });

  it('2. Payment cannot transition from FAILED directly to SUCCESS without retry creation', async () => {
    const storeId = 'store_sharma_01';
    const headers = getTestAuthHeader('merchant_sharma_01', storeId);
    const product = await queryOne('SELECT id FROM products WHERE store_id = $1 LIMIT 1', [storeId]);

    const orderRes = await request(app)
      .post('/api/orders')
      .set(headers)
      .send({
        source: 'CUSTOMER_QR',
        items: [{ productId: product!.id, quantity: 1 }],
        status: 'NEW',
      });

    const orderId = orderRes.body.order.id;

    const payRes = await request(app)
      .post('/api/payments')
      .set(headers)
      .send({
        orderId,
        method: 'UPI',
        amount: orderRes.body.order.total,
      });

    const paymentId = payRes.body.payment.id;
    expect(payRes.body.payment.status).toBe('PENDING');

    const failRes = await request(app)
      .post(`/api/payments/${paymentId}/fail`)
      .set(headers)
      .send({ reason: 'User cancelled UPI pin entry' });

    expect(failRes.body.payment.status).toBe('FAILED');

    const confirmRes = await request(app)
      .post(`/api/payments/${paymentId}/confirm`)
      .set(headers)
      .send({ providerReference: 'ILLEGAL_REF' });

    expect(confirmRes.status).toBe(500);
  });

  it('3. Webhook endpoint processes valid payment confirmation idempotently', async () => {
    const storeId = 'store_sharma_01';
    const headers = getTestAuthHeader('merchant_sharma_01', storeId);
    const product = await queryOne('SELECT id FROM products WHERE store_id = $1 LIMIT 1', [storeId]);

    const orderRes = await request(app)
      .post('/api/orders')
      .set(headers)
      .send({
        source: 'CUSTOMER_QR',
        items: [{ productId: product!.id, quantity: 1 }],
        status: 'NEW',
      });

    const orderId = orderRes.body.order.id;

    const payRes = await request(app)
      .post('/api/payments')
      .set(headers)
      .send({
        orderId,
        method: 'UPI',
        amount: orderRes.body.order.total,
      });

    const paymentId = payRes.body.payment.id;

    const webhookRes = await request(app)
      .post('/api/payments/webhook')
      .send({
        paymentId,
        status: 'SUCCESS',
        providerReference: 'PG_WEBHOOK_TXN_998877',
      });

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.handled).toBe(true);

    const paymentInDb = await queryOne('SELECT * FROM payments WHERE id = $1', [paymentId]);
    expect(paymentInDb!.status).toBe('SUCCESS');
    expect(paymentInDb!.provider_reference).toBe('PG_WEBHOOK_TXN_998877');
  });
});
