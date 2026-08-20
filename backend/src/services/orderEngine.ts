import crypto from 'crypto';
import { query, queryOne, transaction } from '../db';
import {
  Order,
  OrderStatus,
  OrderSource,
  PaymentStatus,
  PaymentMethod,
} from '@floq/types';
import { ALLOWED_ORDER_TRANSITIONS } from '@floq/constants';
import { queueEngine } from './queueEngine';
import { realtimeService } from './realtimeService';
import { auditLogger } from './auditLogger';

export interface CreateOrderParams {
  id?: string;
  clientOrderId?: string;
  storeId: string;
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  source: OrderSource;
  items: {
    productId: string;
    quantity: number;
    modifiers?: { name: string; priceDelta: number }[];
  }[];
  discount?: number;
  notes?: string;
  paymentMethod?: PaymentMethod;
  immediatePayment?: boolean;
  status?: OrderStatus;
  ticketNumber?: string;
  actorId?: string;
}

export class OrderEngine {
  /**
   * Create a new order (Unified for Staff POS and Customer QR)
   * Enforces idempotency via clientOrderId / orderId and atomic ticket generation.
   */
  public async createOrder(params: CreateOrderParams): Promise<Order> {
    const orderId = params.id || crypto.randomUUID();
    const clientOrderId = params.clientOrderId || orderId;
    const now = new Date().toISOString();
    const businessDate = now.split('T')[0];

    // 1. Check idempotency: If order with clientOrderId or orderId exists, return existing order
    const existing = await queryOne(
      'SELECT id FROM orders WHERE id = $1 OR (store_id = $2 AND client_order_id = $3)',
      [orderId, params.storeId, clientOrderId]
    );

    if (existing) {
      const found = await this.getOrderById(existing.id);
      return found!;
    }

    // 2. Fetch store
    const store = await queryOne('SELECT * FROM stores WHERE id = $1', [params.storeId]);
    if (!store) {
      throw new Error(`Store not found with id: ${params.storeId}`);
    }

    // 3. Fetch product snapshots
    let subtotal = 0;
    const computedItems: {
      id: string;
      productId: string;
      productName: string;
      unitPrice: number;
      quantity: number;
      modifiersJson: any;
      itemSubtotal: number;
    }[] = [];

    for (const itemInput of params.items) {
      const product = await queryOne('SELECT * FROM products WHERE id = $1 AND store_id = $2', [
        itemInput.productId,
        params.storeId,
      ]);
      if (!product) {
        throw new Error(`Product not found with id: ${itemInput.productId} in store ${params.storeId}`);
      }

      let unitPrice = Number(product.price);
      if (itemInput.modifiers && itemInput.modifiers.length > 0) {
        for (const mod of itemInput.modifiers) {
          unitPrice += mod.priceDelta;
        }
      }

      const itemSubtotal = unitPrice * itemInput.quantity;
      subtotal += itemSubtotal;

      computedItems.push({
        id: crypto.randomUUID(),
        productId: product.id,
        productName: product.name,
        unitPrice: Number(product.price),
        quantity: itemInput.quantity,
        modifiersJson: itemInput.modifiers ? JSON.stringify(itemInput.modifiers) : null,
        itemSubtotal,
      });
    }

    const discount = params.discount || 0;
    const total = Math.max(0, subtotal - discount);

    // 4. Determine initial order status & payment status
    let initialStatus: OrderStatus = params.status || 'NEW';
    let paymentStatus: PaymentStatus = 'PENDING';

    if (params.source === 'STAFF_POS') {
      if (params.immediatePayment) {
        paymentStatus = 'SUCCESS';
        initialStatus = 'ACCEPTED';
      } else {
        initialStatus = 'ACCEPTED';
      }
    }

    const acceptedAt = initialStatus === 'ACCEPTED' || initialStatus === 'PREPARING' ? now : null;
    const preparingAt = initialStatus === 'PREPARING' ? now : null;

    // Execute order creation in PostgreSQL transaction
    return transaction(async (client) => {
      // 5. Generate ticket number inside transaction
      let ticketNumber = params.ticketNumber;
      if (!ticketNumber) {
        const ticketRes = await queueEngine.generateNextTicketNumber(params.storeId, businessDate, client);
        ticketNumber = ticketRes.ticketNumber;
      }

      // 6. Insert Order
      await client.query(
        `INSERT INTO orders (
          id, client_order_id, store_id, business_date, customer_id, source,
          status, payment_status, ticket_number, subtotal, discount, total,
          notes, created_at, accepted_at, preparing_at, actor_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17
        )`,
        [
          orderId,
          clientOrderId,
          params.storeId,
          businessDate,
          params.customerId || null,
          params.source,
          initialStatus,
          paymentStatus,
          ticketNumber,
          subtotal,
          discount,
          total,
          params.notes || null,
          now,
          acceptedAt,
          preparingAt,
          params.actorId || null,
        ]
      );

      // 7. Insert Order Items
      for (const item of computedItems) {
        await client.query(
          `INSERT INTO order_items (
            id, order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, modifiers_json, subtotal
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            item.id,
            orderId,
            item.productId,
            item.productName,
            item.unitPrice,
            item.quantity,
            item.modifiersJson,
            item.itemSubtotal,
          ]
        );
      }

      // 8. Insert Payment Record
      if (params.paymentMethod) {
        await client.query(
          `INSERT INTO payments (id, order_id, method, status, amount, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [crypto.randomUUID(), orderId, params.paymentMethod, paymentStatus, total, now, now]
        );
      }

      // 9. Insert Queue Ticket Record
      await client.query(
        `INSERT INTO queue_tickets (id, order_id, store_id, business_date, ticket_number, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [crypto.randomUUID(), orderId, params.storeId, businessDate, ticketNumber, now]
      );

      // 10. Log Audit Trail
      await auditLogger.log({
        actorId: params.actorId || 'CUSTOMER',
        actorRole: params.source === 'STAFF_POS' ? 'STAFF' : undefined,
        storeId: params.storeId,
        action: 'ORDER_CREATED',
        entityType: 'ORDER',
        entityId: orderId,
        amount: total,
        details: { ticketNumber, source: params.source, paymentStatus },
      });

      // Construct Order object
      const createdOrder: Order = {
        id: orderId,
        clientOrderId,
        storeId: params.storeId,
        customerId: params.customerId || undefined,
        source: params.source,
        status: initialStatus,
        paymentStatus,
        ticketNumber,
        subtotal,
        discount,
        total,
        notes: params.notes || undefined,
        createdAt: now,
        acceptedAt: acceptedAt || undefined,
        preparingAt: preparingAt || undefined,
        items: computedItems.map((i) => ({
          id: i.id,
          orderId,
          productId: i.productId,
          productNameSnapshot: i.productName,
          unitPriceSnapshot: i.unitPrice,
          quantity: i.quantity,
          modifiers: i.modifiersJson ? JSON.parse(i.modifiersJson) : undefined,
          subtotal: i.itemSubtotal,
        })),
      };

      realtimeService.emit(params.storeId, {
        type: 'ORDER_CREATED',
        order: createdOrder,
      });

      return createdOrder;
    });
  }

  /**
   * Transition order to a new state with strict state machine validation
   */
  public async updateOrderStatus(orderId: string, storeId: string, newStatus: OrderStatus, reason?: string): Promise<Order> {
    const existing = await this.getOrderById(orderId);
    if (!existing) {
      throw new Error(`Order not found: ${orderId}`);
    }

    if (existing.storeId !== storeId) {
      throw new Error(`Unauthorized: Order does not belong to store ${storeId}`);
    }

    const allowedTransitions = ALLOWED_ORDER_TRANSITIONS[existing.status];
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(
        `Invalid status transition: Cannot transition order from ${existing.status} to ${newStatus}. Allowed transitions: [${allowedTransitions.join(
          ', '
        )}]`
      );
    }

    const now = new Date().toISOString();
    const updates: string[] = ['status = $1'];
    const values: any[] = [newStatus];
    let idx = 2;

    if (newStatus === 'ACCEPTED' && !existing.acceptedAt) {
      updates.push(`accepted_at = $${idx++}`);
      values.push(now);
    } else if (newStatus === 'PREPARING') {
      if (!existing.acceptedAt) {
        updates.push(`accepted_at = $${idx++}`);
        values.push(now);
      }
      updates.push(`preparing_at = $${idx++}`);
      values.push(now);
    } else if (newStatus === 'READY') {
      updates.push(`ready_at = $${idx++}`);
      values.push(now);
      await query('UPDATE queue_tickets SET called_at = $1 WHERE order_id = $2', [now, orderId]);
    } else if (newStatus === 'COMPLETED') {
      updates.push(`completed_at = $${idx++}`);
      values.push(now);
      await query('UPDATE queue_tickets SET completed_at = $1 WHERE order_id = $2', [now, orderId]);
    } else if (newStatus === 'CANCELLED') {
      updates.push(`cancelled_at = $${idx++}`);
      values.push(now);
      if (reason) {
        updates.push(`cancellation_reason = $${idx++}`);
        values.push(reason);
      }
    }

    values.push(orderId, storeId);
    const orderIdParamIdx = idx++;
    const storeIdParamIdx = idx++;

    await query(
      `UPDATE orders SET ${updates.join(', ')} WHERE id = $${orderIdParamIdx} AND store_id = $${storeIdParamIdx}`,
      values
    );

    const updatedOrder = (await this.getOrderById(orderId))!;

    await auditLogger.log({
      actorId: 'STAFF',
      actorRole: 'STAFF',
      storeId,
      action: 'ORDER_STATUS_CHANGED',
      entityType: 'ORDER',
      entityId: orderId,
      details: { previousStatus: existing.status, newStatus, reason },
    });

    realtimeService.emit(storeId, {
      type: 'ORDER_UPDATED',
      order: updatedOrder,
      previousStatus: existing.status,
    });

    return updatedOrder;
  }

  /**
   * Fetch single order by ID with its snapshotted items
   */
  public async getOrderById(orderId: string): Promise<Order | null> {
    const row = await queryOne('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (!row) return null;

    const items = await query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
    return this.mapOrderRow(row, items);
  }

  /**
   * List orders for a store with optional status filters
   */
  public async listOrders(storeId: string, options?: { status?: OrderStatus; limit?: number }): Promise<Order[]> {
    let sql = 'SELECT * FROM orders WHERE store_id = $1';
    const params: any[] = [storeId];
    let idx = 2;

    if (options?.status) {
      sql += ` AND status = $${idx++}`;
      params.push(options.status);
    }

    sql += ' ORDER BY created_at DESC';

    if (options?.limit) {
      sql += ` LIMIT $${idx++}`;
      params.push(options.limit);
    }

    const rows = await query(sql, params);
    if (rows.length === 0) return [];

    const orderIds = rows.map((r) => r.id);
    const allItems = await query('SELECT * FROM order_items WHERE order_id = ANY($1::varchar[])', [orderIds]);

    const itemsByOrderId: Record<string, any[]> = {};
    for (const it of allItems) {
      if (!itemsByOrderId[it.order_id]) {
        itemsByOrderId[it.order_id] = [];
      }
      itemsByOrderId[it.order_id].push(it);
    }

    return rows.map((r) => this.mapOrderRow(r, itemsByOrderId[r.id] || []));
  }

  private mapOrderRow(row: any, items: any[]): Order {
    return {
      id: row.id,
      clientOrderId: row.client_order_id || undefined,
      storeId: row.store_id,
      customerId: row.customer_id,
      customerName: row.customer_name || undefined,
      customerPhone: row.customer_phone || undefined,
      source: row.source as OrderSource,
      status: row.status as OrderStatus,
      paymentStatus: row.payment_status as PaymentStatus,
      ticketNumber: row.ticket_number,
      subtotal: Number(row.subtotal),
      discount: Number(row.discount || 0),
      total: Number(row.total),
      notes: row.notes || undefined,
      createdAt: new Date(row.created_at).toISOString(),
      acceptedAt: row.accepted_at ? new Date(row.accepted_at).toISOString() : undefined,
      preparingAt: row.preparing_at ? new Date(row.preparing_at).toISOString() : undefined,
      readyAt: row.ready_at ? new Date(row.ready_at).toISOString() : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
      cancelledAt: row.cancelled_at ? new Date(row.cancelled_at).toISOString() : undefined,
      items: items.map((i) => ({
        id: i.id,
        orderId: i.order_id,
        productId: i.product_id,
        productNameSnapshot: i.product_name_snapshot,
        unitPriceSnapshot: Number(i.unit_price_snapshot),
        quantity: i.quantity,
        modifiers: i.modifiers_json ? (typeof i.modifiers_json === 'string' ? JSON.parse(i.modifiers_json) : i.modifiers_json) : undefined,
        subtotal: Number(i.subtotal),
      })),
    };
  }
}

export const orderEngine = new OrderEngine();
