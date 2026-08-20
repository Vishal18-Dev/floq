import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/server';
import { seedDatabase } from '../src/db/seed';
import { queryOne } from '../src/db';
import { orderEngine } from '../src/services/orderEngine';
import { getTestAuthHeader } from './helpers';

describe('FLOQ Master Acceptance & Integration Test Suite (PostgreSQL)', () => {
  const app = createServer();

  beforeEach(async () => {
    await seedDatabase();
  });

  // =========================================================================
  // 1. ACCEPTANCE TEST: STAFF-ASSISTED SALE FLOW
  // =========================================================================
  it('Acceptance Test 1: Staff POS Sale -> Cash Payment -> Ticket -> Queue Flow -> Daily Sales Record', async () => {
    const storeId = 'store_sharma_01';
    const merchantId = 'merchant_sharma_01';
    const headers = getTestAuthHeader(merchantId, storeId);

    // 1. Get initial analytics
    const initAnalyticsRes = await request(app)
      .get('/api/analytics/daily')
      .set(headers);

    const initialRevenue = initAnalyticsRes.body.revenue;
    const initialOrders = initAnalyticsRes.body.orders;

    // 2. Fetch catalog to get product IDs
    const catalogRes = await request(app)
      .get('/api/products')
      .set(headers);

    expect(catalogRes.status).toBe(200);
    const chai = catalogRes.body.products.find((p: any) => p.name.includes('Chai'));
    const poha = catalogRes.body.products.find((p: any) => p.name.includes('Poha'));
    expect(chai).toBeDefined();
    expect(poha).toBeDefined();

    // 3. Create Staff POS Cash Sale (2 Chai @ 15 = 30, 1 Poha @ 30 = 30, Total = 60)
    const orderRes = await request(app)
      .post('/api/orders')
      .set(headers)
      .send({
        source: 'STAFF_POS',
        items: [
          { productId: chai.id, quantity: 2 },
          { productId: poha.id, quantity: 1 },
        ],
        paymentMethod: 'CASH',
        immediatePayment: true,
        status: 'ACCEPTED',
      });

    expect(orderRes.status).toBe(201);
    const order = orderRes.body.order;
    expect(order.total).toBe(60);
    expect(order.status).toBe('ACCEPTED');
    expect(order.paymentStatus).toBe('SUCCESS');
    expect(order.ticketNumber).toMatch(/^#[0-9]{3}$/);

    // 4. Verify snapshotting: order_items store snapshot of name and price
    expect(order.items[0].productNameSnapshot).toBe(chai.name);
    expect(order.items[0].unitPriceSnapshot).toBe(chai.price);

    // 5. Verify order is in Live Queue in 'PREPARING' / 'ACCEPTED' stage
    const queueRes = await request(app)
      .get('/api/queue')
      .set(headers);

    expect(queueRes.status).toBe(200);
    const queueItems = queueRes.body.preparingOrders;
    const foundInQueue = queueItems.find((q: any) => q.order.id === order.id);
    expect(foundInQueue).toBeDefined();

    // 6. Transition state: ACCEPTED -> PREPARING
    const prepRes = await request(app)
      .patch(`/api/orders/${order.id}/status`)
      .set(headers)
      .send({ status: 'PREPARING' });
    expect(prepRes.status).toBe(200);
    expect(prepRes.body.order.status).toBe('PREPARING');

    // 7. Transition state: PREPARING -> READY
    const readyRes = await request(app)
      .patch(`/api/orders/${order.id}/status`)
      .set(headers)
      .send({ status: 'READY' });
    expect(readyRes.status).toBe(200);
    expect(readyRes.body.order.status).toBe('READY');

    // 8. Transition state: READY -> COMPLETED
    const completeRes = await request(app)
      .patch(`/api/orders/${order.id}/status`)
      .set(headers)
      .send({ status: 'COMPLETED' });
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.order.status).toBe('COMPLETED');

    // 9. Verify Daily Sales Analytics reflects the new completed transaction
    const finalAnalyticsRes = await request(app)
      .get('/api/analytics/daily')
      .set(headers);

    expect(finalAnalyticsRes.body.revenue).toBe(initialRevenue + 60);
    expect(finalAnalyticsRes.body.orders).toBe(initialOrders + 1);
    expect(finalAnalyticsRes.body.cashRevenue).toBeGreaterThanOrEqual(60);
  });

  // =========================================================================
  // 2. ACCEPTANCE TEST: CUSTOMER QR ORDER SIMULATION
  // =========================================================================
  it('Acceptance Test 2: Customer QR Order Placement -> Public API -> Single Order Engine -> Merchant Acceptance & Fulfillment', async () => {
    const storeSlug = 'sharma-breakfast-corner';
    const storeId = 'store_sharma_01';
    const merchantId = 'merchant_sharma_01';
    const headers = getTestAuthHeader(merchantId, storeId);

    // 1. Customer scans QR code and fetches public menu
    const menuRes = await request(app).get(`/api/public/stores/${storeSlug}/products`);
    expect(menuRes.status).toBe(200);
    expect(menuRes.body.menu.length).toBeGreaterThan(0);

    const firstCategory = menuRes.body.menu[0];
    const item1 = firstCategory.products[0];

    // 2. Customer submits order via Public endpoint
    const publicOrderRes = await request(app)
      .post(`/api/public/stores/${storeSlug}/orders`)
      .send({
        customerName: 'Aman Verma',
        customerPhone: '+919988776655',
        items: [{ productId: item1.id, quantity: 2 }],
      });

    expect(publicOrderRes.status).toBe(201);
    const customerOrder = publicOrderRes.body.order;
    expect(customerOrder.source).toBe('CUSTOMER_QR');
    expect(customerOrder.status).toBe('NEW');
    expect(customerOrder.ticketNumber).toBeDefined();

    // 3. Customer checks live tracking
    const trackingRes = await request(app).get(`/api/public/orders/${customerOrder.id}`);
    expect(trackingRes.status).toBe(200);
    expect(trackingRes.body.order.status).toBe('NEW');
    expect(trackingRes.body.order.ticketNumber).toBe(customerOrder.ticketNumber);

    // 4. Vendor POS sees order in NEW filter
    const vendorOrdersRes = await request(app)
      .get('/api/orders?status=NEW')
      .set(headers);

    expect(vendorOrdersRes.status).toBe(200);
    const foundNewOrder = vendorOrdersRes.body.orders.find((o: any) => o.id === customerOrder.id);
    expect(foundNewOrder).toBeDefined();

    // 5. Merchant Accepts order: NEW -> ACCEPTED
    const acceptRes = await request(app)
      .patch(`/api/orders/${customerOrder.id}/status`)
      .set(headers)
      .send({ status: 'ACCEPTED' });

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.order.status).toBe('ACCEPTED');

    // 6. Customer tracking reflects state change in real time
    const updatedTrackingRes = await request(app).get(`/api/public/orders/${customerOrder.id}`);
    expect(updatedTrackingRes.body.order.status).toBe('ACCEPTED');
  });

  // =========================================================================
  // 3. ACCEPTANCE TEST: MULTI-CLIENT PUBLIC CONTRACT
  // =========================================================================
  it('Acceptance Test 3: Public Endpoints do not leak private merchant credentials or settings', async () => {
    const storeSlug = 'sharma-breakfast-corner';

    const storeRes = await request(app).get(`/api/public/stores/${storeSlug}`);
    expect(storeRes.status).toBe(200);
    expect(storeRes.body.store.name).toBe('Sharma Breakfast Corner');
    expect(storeRes.body.store.merchantId).toBeUndefined();
    expect(storeRes.body.store.jwtSecret).toBeUndefined();
  });

  // =========================================================================
  // 4. ACCEPTANCE TEST: MULTI-TENANT DATA ISOLATION
  // =========================================================================
  it('Acceptance Test 4: Merchant A cannot access Merchant B data, orders, products, or sales', async () => {
    const merchantA = 'merchant_sharma_01';
    const storeA = 'store_sharma_01';

    const merchantB = 'merchant_chaipoint_02';
    const storeB = 'store_chaipoint_02';

    const headersA = getTestAuthHeader(merchantA, storeA);
    const headersB = getTestAuthHeader(merchantB, storeB);

    // 1. Merchant A queries Store A orders -> 200 OK
    const aOrders = await request(app)
      .get('/api/orders')
      .set(headersA);
    expect(aOrders.status).toBe(200);

    // 2. Merchant A attempts to access Store B orders with Merchant A credentials -> 403 Forbidden
    const crossAccess = await request(app)
      .get('/api/orders')
      .set('Authorization', headersA.Authorization)
      .set('x-store-id', storeB);
    expect(crossAccess.status).toBe(403);
    expect(crossAccess.body.error).toBe('FORBIDDEN');

    // 3. Merchant B attempts to access Store A analytics with Merchant B credentials -> 403 Forbidden
    const crossAnalytics = await request(app)
      .get('/api/analytics/daily')
      .set('Authorization', headersB.Authorization)
      .set('x-store-id', storeA);
    expect(crossAnalytics.status).toBe(403);
    expect(crossAnalytics.body.error).toBe('FORBIDDEN');
  });

  // =========================================================================
  // 5. ACCEPTANCE TEST: OFFLINE SYNC & IDEMPOTENCY
  // =========================================================================
  it('Acceptance Test 5: Offline created cash transactions sync idempotently without duplicate records', async () => {
    const storeId = 'store_sharma_01';
    const merchantId = 'merchant_sharma_01';

    const product = await queryOne('SELECT id, name, price FROM products WHERE store_id = $1 LIMIT 1', [storeId]);

    const offlineOrderId = `offline_order_${Date.now()}`;
    const offlineSyncRecord = {
      id: offlineOrderId,
      storeId,
      order: {
        id: offlineOrderId,
        storeId,
        source: 'STAFF_POS',
        status: 'COMPLETED',
        discount: 0,
        items: [
          {
            productId: product!.id,
            quantity: 3,
          },
        ],
      },
      payment: {
        method: 'CASH',
        amount: Number(product!.price) * 3,
      },
      clientTimestamp: new Date().toISOString(),
    };

    const headers = getTestAuthHeader(merchantId, storeId);

    // 1. Send sync batch
    const syncRes1 = await request(app)
      .post('/api/sync')
      .set(headers)
      .send({
        storeId,
        records: [offlineSyncRecord],
      });

    expect(syncRes1.status).toBe(200);
    expect(syncRes1.body.syncedOrderIds).toContain(offlineOrderId);

    // Verify order exists in database
    const savedOrder = await orderEngine.getOrderById(offlineOrderId);
    expect(savedOrder).toBeDefined();
    expect(savedOrder?.total).toBe(Number(product!.price) * 3);

    // 2. Send same batch again
    const syncRes2 = await request(app)
      .post('/api/sync')
      .set(headers)
      .send({
        storeId,
        records: [offlineSyncRecord],
      });

    expect(syncRes2.status).toBe(200);
    expect(syncRes2.body.syncedOrderIds).toContain(offlineOrderId);
    expect(syncRes2.body.failedOrderIds.length).toBe(0);

    const count = await queryOne('SELECT COUNT(*) as c FROM orders WHERE id = $1', [offlineOrderId]);
    expect(Number(count.c)).toBe(1);
  });

  // =========================================================================
  // 6. ACCEPTANCE TEST: STATE MACHINE ENFORCEMENT
  // =========================================================================
  it('Acceptance Test 6: Order State Machine blocks illegal transitions', async () => {
    const storeId = 'store_sharma_01';
    const product = await queryOne('SELECT id FROM products WHERE store_id = $1 LIMIT 1', [storeId]);

    const newOrder = await orderEngine.createOrder({
      storeId,
      source: 'CUSTOMER_QR',
      items: [{ productId: product!.id, quantity: 1 }],
      status: 'NEW',
    });

    expect(newOrder.status).toBe('NEW');

    await expect(async () => {
      await orderEngine.updateOrderStatus(newOrder.id, storeId, 'COMPLETED');
    }).rejects.toThrow('Invalid status transition');

    const accepted = await orderEngine.updateOrderStatus(newOrder.id, storeId, 'ACCEPTED');
    expect(accepted.status).toBe('ACCEPTED');

    const preparing = await orderEngine.updateOrderStatus(newOrder.id, storeId, 'PREPARING');
    expect(preparing.status).toBe('PREPARING');

    const ready = await orderEngine.updateOrderStatus(newOrder.id, storeId, 'READY');
    expect(ready.status).toBe('READY');

    const completed = await orderEngine.updateOrderStatus(newOrder.id, storeId, 'COMPLETED');
    expect(completed.status).toBe('COMPLETED');

    await expect(async () => {
      await orderEngine.updateOrderStatus(newOrder.id, storeId, 'PREPARING');
    }).rejects.toThrow('Invalid status transition');
  });
});
