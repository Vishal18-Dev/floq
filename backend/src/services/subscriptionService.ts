import crypto from 'crypto';
import { query, queryOne, execute } from '../db';
import { config } from '../config';

export type Plan = 'monthly' | 'annual';

export interface SubStatus {
  status: 'trial' | 'active' | 'expired';
  plan: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  daysLeft: number; // until trial/period end, 0 if expired
  canSell: boolean;
  prices: { monthly: number; annual: number };
  collectionUpiId: string;
  collectionUpiName: string;
}

const DAY = 86400000;
// ponytail: month=30d, year=365d. Calendar-exact periods not worth it for a
// manual-UPI subscription; swap to date-fns addMonths if billing precision matters.

function daysUntil(target: string): number {
  return Math.max(0, Math.ceil((new Date(target).getTime() - Date.now()) / DAY));
}

/** Create a 7-day trial row if the store has none, so no store is ever un-gated
 *  by accident. Covers white-glove onboard and self-serve signup alike. */
async function ensureRow(storeId: string): Promise<any> {
  const existing = await queryOne('SELECT * FROM subscriptions WHERE store_id=$1', [storeId]);
  if (existing) return existing;
  const now = new Date();
  const trialEnds = new Date(now.getTime() + config.subscription.trialDays * DAY).toISOString();
  await execute(
    `INSERT INTO subscriptions (store_id, plan, status, trial_ends_at, current_period_end, updated_at)
     VALUES ($1, NULL, 'trial', $2, NULL, $3) ON CONFLICT (store_id) DO NOTHING`,
    [storeId, trialEnds, now.toISOString()]
  );
  return await queryOne('SELECT * FROM subscriptions WHERE store_id=$1', [storeId]);
}

/** Resolve the stored row to an effective status using the clock. */
function effective(row: any): { status: SubStatus['status']; end: string | null } {
  const now = Date.now();
  if (row.status === 'active') {
    const end = row.current_period_end;
    return end && new Date(end).getTime() > now ? { status: 'active', end } : { status: 'expired', end };
  }
  if (row.status === 'trial') {
    const end = row.trial_ends_at;
    return end && new Date(end).getTime() > now ? { status: 'trial', end } : { status: 'expired', end };
  }
  return { status: 'expired', end: row.current_period_end || row.trial_ends_at || null };
}

export const subscriptionService = {
  async getStatus(storeId: string): Promise<SubStatus> {
    const row = await ensureRow(storeId);
    const eff = effective(row);
    return {
      status: eff.status,
      plan: row.plan || null,
      trialEndsAt: row.trial_ends_at || null,
      currentPeriodEnd: row.current_period_end || null,
      daysLeft: eff.end ? daysUntil(eff.end) : 0,
      canSell: eff.status !== 'expired',
      prices: { monthly: config.subscription.monthlyPrice, annual: config.subscription.annualPrice },
      collectionUpiId: config.subscription.collectionUpiId,
      collectionUpiName: config.subscription.collectionUpiName,
    };
  },

  async canSell(storeId: string): Promise<boolean> {
    const row = await ensureRow(storeId);
    return effective(row).status !== 'expired';
  },

  async submitPayment(storeId: string, plan: Plan, upiReference?: string) {
    const amount = plan === 'annual' ? config.subscription.annualPrice : config.subscription.monthlyPrice;
    const id = crypto.randomUUID();
    await execute(
      `INSERT INTO subscription_payments (id, store_id, plan, amount, upi_reference, status, submitted_at)
       VALUES ($1,$2,$3,$4,$5,'pending',$6)`,
      [id, storeId, plan, amount, upiReference || null, new Date().toISOString()]
    );
    return { id, storeId, plan, amount, status: 'pending' as const };
  },

  async listPending() {
    return query(
      `SELECT p.*, s.name AS store_name, s.phone AS store_phone
       FROM subscription_payments p JOIN stores s ON s.id = p.store_id
       WHERE p.status='pending' ORDER BY p.submitted_at ASC`
    );
  },

  /** Admin: verify a pending payment, activate the sub, extend the period.
   *  Renewals stack onto an unexpired period rather than resetting it. */
  async verifyPayment(paymentId: string) {
    const pay = await queryOne('SELECT * FROM subscription_payments WHERE id=$1', [paymentId]);
    if (!pay) return { ok: false as const, error: 'PAYMENT_NOT_FOUND' };
    if (pay.status === 'verified') return { ok: true as const, alreadyVerified: true, storeId: pay.store_id };
    const plan = pay.plan as Plan;
    const sub = await queryOne('SELECT * FROM subscriptions WHERE store_id=$1', [pay.store_id]);
    const unexpired = sub?.current_period_end && new Date(sub.current_period_end).getTime() > Date.now();
    const base = unexpired ? new Date(sub.current_period_end).getTime() : Date.now();
    const periodEnd = new Date(base + (plan === 'annual' ? 365 * DAY : 30 * DAY)).toISOString();
    const now = new Date().toISOString();
    await ensureRow(pay.store_id);
    await execute(
      `UPDATE subscriptions SET plan=$1, status='active', current_period_end=$2, updated_at=$3 WHERE store_id=$4`,
      [plan, periodEnd, now, pay.store_id]
    );
    await execute(
      `UPDATE subscription_payments SET status='verified', verified_at=$1, period_end=$2 WHERE id=$3`,
      [now, periodEnd, paymentId]
    );
    return { ok: true as const, storeId: pay.store_id, plan, periodEnd };
  },
};
