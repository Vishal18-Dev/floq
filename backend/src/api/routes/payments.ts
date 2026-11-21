import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest, requireRole } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { paymentEngine } from '../../services/paymentEngine';
import { CreatePaymentSchema } from '@floq/validation';
import { queryOne } from '../../db';

const router = Router();

// Every payment route acts only on payments/orders of the caller's store.
async function assertOrderInStore(orderId: string, storeId: string) {
  const row = await queryOne('SELECT id FROM orders WHERE id = $1 AND store_id = $2', [orderId, storeId]);
  if (!row) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found');
}

async function paymentInStore(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    const row = await queryOne(
      'SELECT p.id FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.id = $1 AND o.store_id = $2',
      [req.params.id, req.storeId]
    );
    if (!row) throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
    next();
  } catch (err) {
    next(err);
  }
}

// POST /api/payments - Initiate payment for an order
router.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const input = CreatePaymentSchema.parse(req.body);
    await assertOrderInStore(input.orderId, req.storeId!);
    const result = await paymentEngine.createPayment(
      input.orderId,
      input.amount,
      input.method,
      { providerReference: input.providerReference, actorId: req.userId }
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/payments/:id - Get payment status
router.get('/:id', paymentInStore, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const status = await paymentEngine.getPaymentStatus(req.params.id);
    res.json({ paymentId: req.params.id, status });
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/:id/confirm - Cashier confirms a manual UPI payment was received
router.post('/:id/confirm', paymentInStore, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { providerReference } = req.body;
    const result = await paymentEngine.confirmPayment(req.params.id, providerReference, req.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/:id/fail - Mark a payment failed
router.post('/:id/fail', requireRole('OWNER', 'MANAGER'), paymentInStore, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { reason } = req.body;
    const result = await paymentEngine.failPayment(req.params.id, reason);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/:id/refund - Refund payment
router.post('/:id/refund', requireRole('OWNER', 'MANAGER'), paymentInStore, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const result = await paymentEngine.refundPayment(req.params.id, req.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
