import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { query, queryOne, execute } from '../../db';
import crypto from 'crypto';

const router = Router();

const DAY_MS = 24 * 60 * 60 * 1000;

function mapCustomer(c: any) {
  const owes = Number(c.owes);
  const oldest = c.oldest_due_at ? new Date(c.oldest_due_at).getTime() : null;
  const days = owes > 0 && oldest ? Math.max(0, Math.floor((Date.now() - oldest) / DAY_MS)) : 0;
  return {
    id: c.id,
    storeId: c.store_id,
    name: c.name,
    kind: c.kind,
    phone: c.phone || undefined,
    creditLimit: Number(c.credit_limit),
    owes,
    oldestDueAt: c.oldest_due_at || undefined,
    days,
    createdAt: c.created_at ? new Date(c.created_at).toISOString() : undefined,
  };
}

// GET /api/retail/customers — credit accounts (shops + regulars) with balances.
router.get('/customers', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const rows = await query(
      'SELECT * FROM credit_customers WHERE store_id = $1 ORDER BY name ASC',
      [req.storeId]
    );
    res.json({ customers: rows.map(mapCustomer) });
  } catch (err) {
    next(err);
  }
});

// POST /api/retail/customers — add a credit account.
router.post('/customers', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { name, kind, phone, creditLimit } = req.body || {};
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await query(
      `INSERT INTO credit_customers (id, store_id, name, kind, phone, credit_limit, owes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 0, $7)`,
      [id, req.storeId, name, kind === 'SHOP' ? 'SHOP' : 'REGULAR', phone || null, Number(creditLimit) || 0, now]
    );
    const created = await queryOne('SELECT * FROM credit_customers WHERE id = $1', [id]);
    res.status(201).json({ customer: mapCustomer(created) });
  } catch (err) {
    next(err);
  }
});

// POST /api/retail/customers/:id/paid — record a repayment. Omit amount to
// settle the whole balance ("Got paid" on the Dues screen).
router.post('/customers/:id/paid', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const cust = await queryOne('SELECT * FROM credit_customers WHERE id = $1 AND store_id = $2', [
      req.params.id,
      req.storeId,
    ]);
    if (!cust) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    const owes = Number(cust.owes);
    const amount = req.body?.amount != null ? Math.min(Number(req.body.amount), owes) : owes;
    if (amount <= 0) {
      res.json({ customer: mapCustomer(cust) });
      return;
    }
    const now = new Date().toISOString();
    const businessDate = now.split('T')[0];
    await query(
      `INSERT INTO dues_entries (id, store_id, customer_id, kind, amount, note, business_date, created_at)
       VALUES ($1, $2, $3, 'PAYMENT', $4, $5, $6, $7)`,
      [crypto.randomUUID(), req.storeId, cust.id, -amount, req.body?.note || null, businessDate, now]
    );
    const newOwes = owes - amount;
    await execute(
      'UPDATE credit_customers SET owes = $1, oldest_due_at = $2 WHERE id = $3',
      [newOwes, newOwes <= 0 ? null : cust.oldest_due_at, cust.id]
    );
    const updated = await queryOne('SELECT * FROM credit_customers WHERE id = $1', [cust.id]);
    res.json({ customer: mapCustomer(updated) });
  } catch (err) {
    next(err);
  }
});

export default router;
