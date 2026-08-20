import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { queryOne } from '../../db';
import { orderEngine } from '../../services/orderEngine';
import { SyncPayloadSchema } from '@floq/validation';

const router = Router();

// POST /api/sync - Reconcile offline created orders and payments (Idempotent, preserves ticket numbers & clientOrderId)
router.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const input = SyncPayloadSchema.parse(req.body);
    const syncedOrderIds: string[] = [];
    const failedOrderIds: { id: string; reason: string }[] = [];

    for (const record of input.records) {
      try {
        const storeId = req.storeId || record.storeId || input.storeId;
        const clientOrderId = record.clientOrderId || record.order?.clientOrderId || record.order?.id || record.id;
        const existing = await queryOne(
          'SELECT id FROM orders WHERE id = $1 OR (store_id = $2 AND client_order_id = $3)',
          [record.order.id, storeId, clientOrderId]
        );

        if (existing) {
          // Idempotent: Order already processed by server
          syncedOrderIds.push(record.order.id);
          continue;
        }

        // Insert new order via order engine preserving offline ticket number and clientOrderId
        const items = (record.order.items || []).map((it: any) => ({
          productId: it.productId || it.product_id,
          quantity: it.quantity,
          modifiers: it.modifiers,
        }));

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
