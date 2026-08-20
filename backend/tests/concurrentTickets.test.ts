import { describe, it, expect, beforeEach } from 'vitest';
import { seedDatabase } from '../src/db/seed';
import { queryOne } from '../src/db';
import { queueEngine } from '../src/services/queueEngine';
import { orderEngine } from '../src/services/orderEngine';

describe('P0-4 Atomic Ticket Generation & Concurrency Tests (PostgreSQL)', () => {
  beforeEach(async () => {
    await seedDatabase();
  });

  it('1. 10 Concurrent Ticket Generation calls return 10 unique sequential tickets', async () => {
    const storeId = 'store_sharma_01';
    const businessDate = '2026-08-17';

    const promises = Array.from({ length: 10 }).map(async () => {
      return queueEngine.generateNextTicketNumber(storeId, businessDate);
    });

    const results = await Promise.all(promises);
    const seqs = results.map((r) => r.seq);
    const uniqueSeqs = new Set(seqs);

    expect(seqs.length).toBe(10);
    expect(uniqueSeqs.size).toBe(10); // Zero duplicates
  });

  it('2. 50 Concurrent Ticket Generation calls return 50 unique sequential tickets without gaps', async () => {
    const storeId = 'store_sharma_01';
    const businessDate = '2026-08-17';

    const promises = Array.from({ length: 50 }).map(async () => {
      return queueEngine.generateNextTicketNumber(storeId, businessDate);
    });

    const results = await Promise.all(promises);
    const seqs = results.map((r) => r.seq).sort((a, b) => a - b);

    expect(seqs.length).toBe(50);
    expect(new Set(seqs).size).toBe(50);
    expect(seqs[49] - seqs[0]).toBe(49); // Continuous 50 sequence without gaps
  });

  it('3. 100 Concurrent Order Creations create 100 orders with unique tickets and zero DB constraint violations', async () => {
    const storeId = 'store_sharma_01';
    const product = await queryOne('SELECT id FROM products WHERE store_id = $1 LIMIT 1', [storeId]);

    const promises = Array.from({ length: 100 }).map(async (_, idx) => {
      return orderEngine.createOrder({
        clientOrderId: `client_order_concurrent_${idx}`,
        storeId,
        source: 'STAFF_POS',
        items: [{ productId: product!.id, quantity: 1 }],
      });
    });

    const createdOrders = await Promise.all(promises);
    const ticketNumbers = createdOrders.map((o) => o.ticketNumber);
    const uniqueTickets = new Set(ticketNumbers);

    expect(createdOrders.length).toBe(100);
    expect(uniqueTickets.size).toBe(100); // 100% unique ticket numbers

    const dbTickets = await queryOne('SELECT COUNT(*) as count FROM queue_tickets WHERE store_id = $1', [storeId]);
    expect(Number(dbTickets.count)).toBeGreaterThanOrEqual(100);
  });
});
