import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { paymentEngine } from '../../services/paymentEngine';
import { CreatePaymentSchema } from '@floq/validation';

const router = Router();

// POST /api/payments/webhook - Webhook endpoint for payment gateways (Public unauthenticated with signature validation)
router.post('/webhook', async (req, res, next) => {
  try {
    const signature = req.headers['x-webhook-signature'] as string;
    const result = await paymentEngine.handleWebhook(req.body, signature);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/payments - Initiate payment for an order
router.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const input = CreatePaymentSchema.parse(req.body);
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
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const status = await paymentEngine.getPaymentStatus(req.params.id);
    res.json({ paymentId: req.params.id, status });
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/:id/confirm - Confirm payment (simulated webhook / cashier confirm)
router.post('/:id/confirm', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { providerReference } = req.body;
    const result = await paymentEngine.confirmPayment(req.params.id, providerReference, req.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/:id/fail - Simulate payment failure
router.post('/:id/fail', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { reason } = req.body;
    const result = await paymentEngine.failPayment(req.params.id, reason);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/:id/refund - Refund payment
router.post('/:id/refund', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const result = await paymentEngine.refundPayment(req.params.id, req.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
