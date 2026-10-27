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

// POST /api/retail/products — add a product with one pack, or a loose good.
router.post('/products', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const b = req.body || {};
    if (!b.name || !b.categoryId) {
      res.status(400).json({ error: 'name and categoryId are required' });
      return;
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const isLoose = !!b.isLoose;
    await query(
      `INSERT INTO products (id, store_id, category_id, name, name_local, price, is_available, sort_order, station, is_loose, per_kg, stock_grams, daily_grams, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, 0, 'PACKAGED', $7, $8, $9, $10, $11, $11)`,
      [
        id, req.storeId, b.categoryId, b.name, b.nameLocal || null,
        isLoose ? Number(b.perKg) || 0 : 0,
        isLoose,
        isLoose ? Number(b.perKg) || 0 : null,
        isLoose ? Number(b.stockGrams) || 0 : null,
        isLoose ? Number(b.dailyGrams) || 0 : null,
        now,
      ]
    );
    if (!isLoose && b.pack) {
      const k = b.pack;
      await query(
        `INSERT INTO product_packs (id, product_id, store_id, size, price, wholesale_price, cost_price, stock, case_qty, daily_rate, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0)`,
        [`${id}_0`, id, req.storeId, k.size || '1 unit', Number(k.price) || 0, Number(k.wholesalePrice) || null, Number(k.costPrice) || null, Number(k.stock) || 0, Number(k.caseQty) || null, Number(k.dailyRate) || 0]
      );
    }
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
});

// POST /api/retail/stock/receive — add received stock to packs / loose goods,
// updating the cost price when the supplier bill gives a new one.
router.post('/stock/receive', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const lines: { packId?: string; productId?: string; qty: number; cost?: number }[] = req.body?.lines || [];
    for (const l of lines) {
      if (!l.qty || l.qty <= 0) continue;
      if (l.packId) {
        const cur = await queryOne('SELECT stock FROM product_packs WHERE id = $1 AND store_id = $2', [l.packId, req.storeId]);
        if (!cur) continue;
        const next = Number(cur.stock) + Number(l.qty);
        if (l.cost != null) {
          await execute('UPDATE product_packs SET stock = $1, cost_price = $2 WHERE id = $3', [next, Number(l.cost), l.packId]);
        } else {
          await execute('UPDATE product_packs SET stock = $1 WHERE id = $2', [next, l.packId]);
        }
      } else if (l.productId) {
        const cur = await queryOne('SELECT stock_grams FROM products WHERE id = $1 AND store_id = $2', [l.productId, req.storeId]);
        if (!cur) continue;
        const next = Number(cur.stock_grams || 0) + Number(l.qty);
        await execute('UPDATE products SET stock_grams = $1 WHERE id = $2', [next, l.productId]);
      }
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
