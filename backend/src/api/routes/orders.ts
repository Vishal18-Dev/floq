import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { orderEngine } from '../../services/orderEngine';
import { CreateOrderSchema, UpdateOrderStatusSchema } from '@floq/validation';

const router = Router();

// GET /api/orders - List orders for authenticated store
router.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const status = req.query.status as any;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const orders = await orderEngine.listOrders(req.storeId!, { status, limit });
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id - Get specific order details
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const order = await orderEngine.getOrderById(req.params.id);
    if (!order || order.storeId !== req.storeId) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders - Create staff or digital order
router.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const input = CreateOrderSchema.parse({
      ...req.body,
      storeId: req.storeId,
    });

    const order = await orderEngine.createOrder({
      id: input.id,
      storeId: req.storeId!,
      customerId: input.customerId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      source: input.source,
      items: input.items,
      discount: input.discount,
      notes: input.notes,
      paymentMethod: input.paymentMethod,
      immediatePayment: input.immediatePayment,
      status: input.status,
      actorId: req.userId,
    });

    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/orders/:id/status - Transition order status (state machine protected)
router.patch('/:id/status', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const input = UpdateOrderStatusSchema.parse(req.body);
    const updated = await orderEngine.updateOrderStatus(
      req.params.id,
      req.storeId!,
      input.status,
      input.reason
    );
    res.json({ order: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
