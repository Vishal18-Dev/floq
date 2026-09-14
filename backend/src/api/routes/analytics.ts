import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { analyticsService } from '../../services/analyticsService';
import { query, queryOne, execute } from '../../db';
import crypto from 'crypto';

const router = Router();

// GET /api/analytics/daily - Get daily sales summary
router.get('/daily', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const dateStr = req.query.date as string | undefined;
    const summary = await analyticsService.getDailySummary(req.storeId!, dateStr);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/day-status - open tokens carried over from previous days + close state
router.get('/day-status', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const carriedRow = await queryOne(
      `SELECT COUNT(*) as count FROM orders
       WHERE store_id = $1 AND business_date < $2
         AND status IN ('NEW','ACCEPTED','PREPARING','READY')`,
      [req.storeId, today]
    );
    const closure = await queryOne('SELECT id FROM day_closures WHERE store_id = $1 AND business_date = $2', [
      req.storeId,
      today,
    ]);
    res.json({
      businessDate: today,
      carriedOverTokens: Number(carriedRow?.count || 0),
      closed: Boolean(closure),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/history - past closed days (most recent first)
router.get('/history', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const rows = await query(
      `SELECT business_date, closed_at, total_revenue, total_orders, cash_revenue, upi_revenue
       FROM day_closures WHERE store_id = $1 ORDER BY business_date DESC LIMIT 60`,
      [req.storeId]
    );
    res.json({
      days: rows.map((r: any) => ({
        businessDate: r.business_date,
        closedAt: r.closed_at,
        revenue: Number(r.total_revenue || 0),
        orders: Number(r.total_orders || 0),
        cashRevenue: Number(r.cash_revenue || 0),
        upiRevenue: Number(r.upi_revenue || 0),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/analytics/close-day - snapshot today's totals; open tokens carry over
router.post('/close-day', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const summary = await analyticsService.getDailySummary(req.storeId!, today);

    const existing = await queryOne('SELECT id FROM day_closures WHERE store_id = $1 AND business_date = $2', [
      req.storeId,
      today,
    ]);
    const carriedRow = await queryOne(
      `SELECT COUNT(*) as count FROM orders
       WHERE store_id = $1 AND business_date <= $2
         AND status IN ('NEW','ACCEPTED','PREPARING','READY')`,
      [req.storeId, today]
    );
    const carried = Number(carriedRow?.count || 0);
    const nowIso = new Date().toISOString();

    if (existing) {
      await execute(
        `UPDATE day_closures SET closed_at=$1, total_revenue=$2, total_orders=$3, cash_revenue=$4, upi_revenue=$5, carried_over_tokens=$6
         WHERE id=$7`,
        [nowIso, summary.revenue, summary.orders, summary.cashRevenue, summary.upiRevenue, carried, existing.id]
      );
    } else {
      await query(
        `INSERT INTO day_closures (id, store_id, business_date, closed_at, total_revenue, total_orders, cash_revenue, upi_revenue, carried_over_tokens)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [crypto.randomUUID(), req.storeId, today, nowIso, summary.revenue, summary.orders, summary.cashRevenue, summary.upiRevenue, carried]
      );
    }

    res.json({ success: true, summary });
  } catch (err) {
    next(err);
  }
});

export default router;
