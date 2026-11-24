import { transaction } from '../db';

// Tables keyed by store_id, children before parents (production FKs don't cascade).
const STORE_TABLES = [
  'dues_entries',
  'credit_customers',
  'product_packs',
  'queue_tickets',
  'orders', // order_items and payments are cleared first, by order
  'products',
  'categories',
  'devices',
  'staff',
  'staff_invites',
  'ticket_sequences',
  'day_closures',
  'subscription_payments',
  'subscriptions',
  'store_settings',
  'audit_logs',
];

/**
 * Delete the caller's account (Play Store / DPDP right to erasure).
 * OWNER: the whole merchant goes: every store, its data and every team login.
 * Anyone else: only their own login; the shop stays.
 * ponytail: hard delete, no grace period; add a soft-delete + 30-day purge if merchants ask for undo.
 */
export async function deleteAccount(userId: string): Promise<{ scope: 'MERCHANT' | 'USER' }> {
  return transaction(async (client) => {
    const { rows } = await client.query('SELECT id, role, merchant_id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const user = rows[0];
    if (!user) throw new Error('User not found');

    if (user.role !== 'OWNER') {
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
      return { scope: 'USER' as const };
    }

    const merchantId = user.merchant_id;
    const stores = await client.query('SELECT id FROM stores WHERE merchant_id = $1', [merchantId]);
    for (const { id: storeId } of stores.rows) {
      await client.query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE store_id = $1)', [storeId]);
      await client.query('DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE store_id = $1)', [storeId]);
      for (const table of STORE_TABLES) {
        await client.query(`DELETE FROM ${table} WHERE store_id = $1`, [storeId]);
      }
    }
    await client.query('DELETE FROM staff_invites WHERE merchant_id = $1', [merchantId]);
    await client.query('DELETE FROM users WHERE merchant_id = $1', [merchantId]);
    await client.query('DELETE FROM stores WHERE merchant_id = $1', [merchantId]);
    await client.query('DELETE FROM merchants WHERE id = $1', [merchantId]);
    return { scope: 'MERCHANT' as const };
  });
}
