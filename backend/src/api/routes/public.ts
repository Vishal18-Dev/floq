import { Router, Request, Response } from 'express';
import { query, queryOne } from '../../db';
import { orderEngine } from '../../services/orderEngine';
import { paymentEngine } from '../../services/paymentEngine';
import { CreateOrderSchema } from '@floq/validation';

const router = Router();

// GET /api/public/stores/:slug - Safe public store details
router.get('/stores/:slug', async (req: Request, res: Response, next) => {
  try {
    const store = await queryOne("SELECT * FROM stores WHERE slug = $1 AND status = 'ACTIVE'", [req.params.slug]);
    if (!store) {
      res.status(404).json({ error: 'STORE_NOT_FOUND', message: 'Store not found or inactive.' });
      return;
    }

    const settings = await queryOne('SELECT typical_prep_time_minutes, upi_id, upi_name FROM store_settings WHERE store_id = $1', [
      store.id,
    ]);

    res.json({
      store: {
        id: store.id,
        name: store.name,
        slug: store.slug,
        storeType: store.store_type,
        address: store.address,
        phone: store.phone,
        openingTime: store.opening_time,
        closingTime: store.closing_time,
        typicalPrepTimeMinutes: settings?.typical_prep_time_minutes || 6,
        upiId: settings?.upi_id || undefined,
        upiName: settings?.upi_name || store.name,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/public/stores/:slug/products - Safe public product catalogue
router.get('/stores/:slug/products', async (req: Request, res: Response, next) => {
  try {
    const store = await queryOne("SELECT id FROM stores WHERE slug = $1 AND status = 'ACTIVE'", [req.params.slug]);
    if (!store) {
      res.status(404).json({ error: 'STORE_NOT_FOUND', message: 'Store not found.' });
      return;
    }

    const categories = await query(
      'SELECT id, name, sort_order FROM categories WHERE store_id = $1 AND is_active = true ORDER BY sort_order ASC',
      [store.id]
    );

    const products = await query(
      'SELECT id, category_id, name, description, price, is_available, sort_order, station FROM products WHERE store_id = $1 AND is_available = true ORDER BY sort_order ASC',
      [store.id]
    );

    const productsByCat: Record<string, any[]> = {};
    for (const p of products) {
      if (!productsByCat[p.category_id]) productsByCat[p.category_id] = [];
      productsByCat[p.category_id].push({
        id: p.id,
        name: p.name,
        description: p.description,
        price: Number(p.price),
        station: p.station,
        modifiers: [],
      });
    }

    const menu = categories.map((c) => ({
      category: {
        id: c.id,
        name: c.name,
      },
      products: productsByCat[c.id] || [],
    }));

    res.json({ menu });
  } catch (err) {
    next(err);
  }
});

// POST /api/public/stores/:slug/orders - Customer places an order via QR
router.post('/stores/:slug/orders', async (req: Request, res: Response, next) => {
  try {
    const store = await queryOne("SELECT id FROM stores WHERE slug = $1 AND status = 'ACTIVE'", [req.params.slug]);
    if (!store) {
      res.status(404).json({ error: 'STORE_NOT_FOUND', message: 'Store not found.' });
      return;
    }

    const input = CreateOrderSchema.parse({
      ...req.body,
      storeId: store.id,
      source: 'CUSTOMER_QR',
    });

    const order = await orderEngine.createOrder({
      id: input.id,
      storeId: store.id,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      source: 'CUSTOMER_QR',
      items: input.items,
      notes: input.notes,
      status: 'NEW',
    });

    const paymentResult = await paymentEngine.createPayment(order.id, order.total, 'UPI');

    res.status(201).json({
      order,
      payment: paymentResult,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/public/orders/:id - Customer tracks their order status & ticket
router.get('/orders/:id', async (req: Request, res: Response, next) => {
  try {
    const order = await orderEngine.getOrderById(req.params.id);
    if (!order) {
      res.status(404).json({ error: 'ORDER_NOT_FOUND', message: 'Order not found.' });
      return;
    }

    const store = await queryOne('SELECT name, slug FROM stores WHERE id = $1', [order.storeId]);
    const settings = await queryOne('SELECT typical_prep_time_minutes FROM store_settings WHERE store_id = $1', [order.storeId]);

    res.json({
      order: {
        id: order.id,
        ticketNumber: order.ticketNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.total,
        items: order.items.map((i) => ({
          name: i.productNameSnapshot,
          quantity: i.quantity,
          subtotal: i.subtotal,
        })),
        createdAt: order.createdAt,
        acceptedAt: order.acceptedAt,
        preparingAt: order.preparingAt,
        readyAt: order.readyAt,
        completedAt: order.completedAt,
      },
      store: store
        ? {
            name: store.name,
            slug: store.slug,
            typicalPrepTimeMinutes: settings?.typical_prep_time_minutes || 6,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
