import { describe, it, expect, beforeEach } from 'vitest';
import { seedDatabase } from '../src/db/seed';
import { getBackupInformation } from '../src/db/backup';
import { orderEngine } from '../src/services/orderEngine';
import { queryOne } from '../src/db';

describe('PostgreSQL Database Backup Strategy Verification Test', () => {
  beforeEach(async () => {
    await seedDatabase();
  });

  it('Verifies PostgreSQL managed database backup strategy metadata and data consistency', async () => {
    const storeId = 'store_sharma_01';
    const product = await queryOne('SELECT id FROM products WHERE store_id = $1 LIMIT 1', [storeId]);

    const testOrder = await orderEngine.createOrder({
      storeId,
      source: 'STAFF_POS',
      items: [{ productId: product!.id, quantity: 3 }],
      paymentMethod: 'CASH',
      immediatePayment: true,
    });

    expect(testOrder).toBeDefined();

    const backupInfo = await getBackupInformation();
    expect(backupInfo.strategy).toContain('Continuous WAL');
    expect(backupInfo.managedProvider).toContain('Managed PostgreSQL');

    const dbOrder = await queryOne('SELECT * FROM orders WHERE id = $1', [testOrder.id]);
    expect(dbOrder).toBeDefined();
    expect(dbOrder!.store_id).toBe(storeId);
  });
});
