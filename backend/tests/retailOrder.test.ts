import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createServer } from '../src/server';
import { seedDatabase } from '../src/db/seed';
import { queryOne } from '../src/db';
import { getTestAuthHeader } from './helpers';

// Nila Naturals — the seeded RETAIL store with packs, loose goods and a credit book.
const MERCHANT = 'merchant_nila_03';
const STORE = 'store_nila_03';
const headers = getTestAuthHeader(MERCHANT, STORE);

describe('Retail order path — stock, credit dues and wholesale invoices', () => {
  const app = createServer();
  beforeEach(async () => {
    await seedDatabase();
  });

  it('cash pack sale reduces that pack\'s stock and snapshots cost', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(headers)
      .send({
        source: 'STAFF_POS',
        paymentMethod: 'CASH',
        immediatePayment: true,
        cashTendered: 700,
        items: [{ packId: 'nprod_vco_0', sellUnit: 'UNIT', quantity: 2 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe('COMPLETED');
    expect(res.body.order.payMethod).toBe('CASH');
    expect(res.body.order.total).toBe(640); // 320 × 2 counter price
    expect(res.body.order.items[0].costSnapshot).toBe(240);

    const pack = await queryOne('SELECT stock FROM product_packs WHERE id = $1', ['nprod_vco_0']);
    expect(Number(pack.stock)).toBe(32); // 34 − 2
  });

  it('credit sale charges the account and writes a dues ledger entry', async () => {
    const before = await queryOne('SELECT owes FROM credit_customers WHERE id = $1', ['ncust_4']); // Ravi Stores, owes 4200
    const res = await request(app)
      .post('/api/orders')
      .set(headers)
      .send({
        source: 'STAFF_POS',
        paymentMethod: 'CREDIT',
        creditCustomerId: 'ncust_4',
        items: [{ packId: 'nprod_bch_0', sellUnit: 'UNIT', quantity: 1 }], // 90
      });
    expect(res.status).toBe(201);
    expect(res.body.order.payMethod).toBe('CREDIT');

    const after = await queryOne('SELECT owes FROM credit_customers WHERE id = $1', ['ncust_4']);
    expect(Number(after.owes)).toBe(Number(before.owes) + 90);

    const due = await queryOne(
      "SELECT * FROM dues_entries WHERE customer_id = $1 AND kind = 'CHARGE'",
      ['ncust_4']
    );
    expect(due).toBeTruthy();
    expect(Number(due.amount)).toBe(90);
  });

  it('wholesale shop order prices at wholesale and stamps an invoice number', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(headers)
      .send({
        source: 'STAFF_POS',
        isWholesale: true,
        paymentMethod: 'CREDIT',
        creditCustomerId: 'ncust_1',
        items: [{ packId: 'nprod_vco_0', sellUnit: 'UNIT', quantity: 12 }], // one case
      });
    expect(res.status).toBe(201);
    expect(res.body.order.isWholesale).toBe(true);
    expect(res.body.order.invoiceNumber).toMatch(/^FL-0\d+$/);
    expect(res.body.order.total).toBe(280 * 12); // wholesale price, not 320
  });

  it('loose sale reduces stock by grams', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(headers)
      .send({
        source: 'STAFF_POS',
        paymentMethod: 'CASH',
        immediatePayment: true,
        items: [{ productId: 'nprod_tur', sellUnit: 'GRAM', quantity: 500 }], // turmeric ₹280/kg → ₹140
      });
    expect(res.status).toBe(201);
    expect(res.body.order.total).toBe(140);

    const prod = await queryOne('SELECT stock_grams FROM products WHERE id = $1', ['nprod_tur']);
    expect(Number(prod.stock_grams)).toBe(7000); // 7500 − 500
  });
});
