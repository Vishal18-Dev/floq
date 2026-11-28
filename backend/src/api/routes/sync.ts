import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { queryOne } from '../../db';
import { orderEngine } from '../../services/orderEngine';
import { SyncPayloadSchema } from '@floq/validation';
import { subscriptionService } from '../../services/subscriptionService';

const router = Router();

// POST /api/sync - Reconcile offline created orders and payments (Idempotent, preserves ticket numbers & clientOrderId)
router.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const input = SyncPayloadSchema.parse(req.body);
    const syncedOrderIds: string[] = [];
    const failedOrderIds: { id: string; reason: string }[] = [];

    // Paywall: sales made offline while access was still on still sync; sales
    // stamped after the trial or plan ended don't.
    // ponytail: clientTimestamp is phone-supplied, so a backdated clock slips through; fine for a ₹49 plan.
    let accessEnd: string | null = null;
    const canSell = await subscriptionService.canSell(req.storeId!);
    if (!canSell) {
      const sub = await subscriptionService.getStatus(req.storeId!);
      accessEnd = [sub.trialEndsAt, sub.currentPeriodEnd].filter(Boolean).sort().pop() || '';
    }

    for (const record of input.records) {
      if (!canSell && !(record.clientTimestamp <= (accessEnd as string))) {
        failedOrderIds.push({ id: record.order.id, reason: 'SUBSCRIPTION_REQUIRED' });
        continue;
      }
      try {
        const storeId = req.storeId || record.storeId || input.storeId;
        const clientOrderId = record.clientOrderId || record.order?.clientOrderId || record.order?.id || record.id;
        // Only this store's own orders count as already-synced; an id held by
        // another store falls through to createOrder, which rejects the clash.
        const existing = await queryOne(
          'SELECT id FROM orders WHERE store_id = $2 AND (id = $1 OR client_order_id = $3)',
          [record.order.id, storeId, clientOrderId]
        );

        if (existing) {
          // Idempotent: Order already processed by server
          syncedOrderIds.push(record.order.id);
          continue;
        }

        // Insert new order via order engine preserving offline ticket number and clientOrderId
        // Offline quick-charge lines are queued as productId 'CUSTOM'; replay them
        // as ad-hoc lines from their name/price snapshot.
        const items = (record.order.items || []).map((it: any) => {
          const productId = it.productId || it.product_id;
          return !productId || productId === 'CUSTOM'
            ? { name: it.productNameSnapshot || it.name, unitPrice: Number(it.unitPriceSnapshot ?? it.unitPrice), quantity: it.quantity }
            : { productId, quantity: it.quantity, modifiers: it.modifiers };
        });

        await orderEngine.createOrder({
          id: record.order.id,
          clientOrderId,
          storeId,
          source: record.order.source || 'STAFF_POS',
          items,
          discount: record.order.discount || 0,
          notes: record.order.notes,
          paymentMethod: record.payment?.method || 'CASH',
          immediatePayment: true,
          status: record.order.status || 'COMPLETED',
          ticketNumber: record.order.ticketNumber,
          actorId: req.userId || 'system_sync',
        });

        syncedOrderIds.push(record.order.id);
      } catch (err: any) {
        failedOrderIds.push({
          id: record.order.id,
          reason: err.message || 'Unknown sync error',
        });
      }
    }

    res.json({
      syncedOrderIds,
      failedOrderIds,
      serverTimestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
