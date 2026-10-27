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
    productId?: string;
    packId?: string;
    sellUnit?: 'UNIT' | 'GRAM';
    name?: string;
    unitPrice?: number;
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
  // Retail: wholesale shop order, which account carries a credit bill, and
  // cash handed over (for change). Wholesale lines price at wholesale_price.
  isWholesale?: boolean;
  creditCustomerId?: string | null;
  cashTendered?: number;
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
    const wholesale = !!params.isWholesale;
    let subtotal = 0;
    const computedItems: {
      id: string;
      productId: string;
      packId: string | null;
      sellUnit: 'UNIT' | 'GRAM';
      productName: string;
      unitPrice: number;
      costSnapshot: number | null;
      quantity: number;
      modifiersJson: any;
      itemSubtotal: number;
      // How this line reduces stock inside the transaction.
      stock?: { kind: 'pack'; packId: string; units: number } | { kind: 'loose'; productId: string; grams: number };
    }[] = [];

    for (const itemInput of params.items) {
      let productId: string;
      let packId: string | null = null;
      let sellUnit: 'UNIT' | 'GRAM' = (itemInput.sellUnit as any) || 'UNIT';
      let productName: string;
      let basePrice: number;
      let costSnapshot: number | null = null;
      let itemSubtotal: number;
      let stock: (typeof computedItems)[number]['stock'];

      if (itemInput.packId) {
        // Retail pack SKU: price at wholesale for shop orders, else counter price.
        const pack = await queryOne('SELECT * FROM product_packs WHERE id = $1 AND store_id = $2', [
          itemInput.packId,
          params.storeId,
        ]);
        if (!pack) {
          throw new Error(`Pack not found with id: ${itemInput.packId} in store ${params.storeId}`);
        }
        const prod = await queryOne('SELECT name FROM products WHERE id = $1', [pack.product_id]);
        productId = pack.product_id;
        packId = pack.id;
        sellUnit = 'UNIT';
        const ws = pack.wholesale_price != null ? Number(pack.wholesale_price) : Number(pack.price);
        basePrice = wholesale ? ws : Number(pack.price);
        costSnapshot = pack.cost_price != null ? Number(pack.cost_price) : null;
        productName = `${prod?.name || 'Item'} ${pack.size}`;
        itemSubtotal = basePrice * itemInput.quantity;
        stock = { kind: 'pack', packId: pack.id, units: itemInput.quantity };
      } else if (itemInput.productId && sellUnit === 'GRAM') {
        // Loose goods sold by weight; quantity is grams.
        const product = await queryOne('SELECT * FROM products WHERE id = $1 AND store_id = $2', [
          itemInput.productId,
          params.storeId,
        ]);
        if (!product) {
          throw new Error(`Product not found with id: ${itemInput.productId} in store ${params.storeId}`);
        }
        productId = product.id;
        const perKg = Number(product.per_kg || product.price);
        basePrice = perKg; // per-kg reference price; subtotal is the rounded amount
        productName = (product.name as string).replace(' (loose)', '');
        itemSubtotal = Math.round((perKg * itemInput.quantity) / 1000);
        // No per-gram cost in the model; assume a 30% margin on loose goods.
        // ponytail: flat 30% loose margin; add a per-product cost field if it matters.
        costSnapshot = Math.round(itemSubtotal * 0.7);
        stock = { kind: 'loose', productId: product.id, grams: itemInput.quantity };
      } else if (itemInput.productId) {
        const product = await queryOne('SELECT * FROM products WHERE id = $1 AND store_id = $2', [
          itemInput.productId,
          params.storeId,
        ]);
        if (!product) {
          throw new Error(`Product not found with id: ${itemInput.productId} in store ${params.storeId}`);
        }
        productId = product.id;
        productName = product.name;
        basePrice = Number(product.price);
        itemSubtotal = basePrice * itemInput.quantity;
      } else {
        // Ad-hoc line (quick-charge amount pad): no catalogue product.
        if (itemInput.unitPrice === undefined || itemInput.unitPrice === null) {
          throw new Error('Ad-hoc item requires a unitPrice');
        }
        productId = 'CUSTOM';
        productName = itemInput.name || 'Quick sale';
        basePrice = Number(itemInput.unitPrice);
        itemSubtotal = basePrice * itemInput.quantity;
      }

      if (itemInput.modifiers && itemInput.modifiers.length > 0 && sellUnit === 'UNIT' && !packId) {
        let unitPrice = basePrice;
        for (const mod of itemInput.modifiers) unitPrice += mod.priceDelta;
        itemSubtotal = unitPrice * itemInput.quantity;
      }

      subtotal += itemSubtotal;

      computedItems.push({
        id: crypto.randomUUID(),
        productId,
        packId,
        sellUnit,
        productName,
        unitPrice: basePrice,
        costSnapshot,
        quantity: itemInput.quantity,
        modifiersJson: itemInput.modifiers ? JSON.stringify(itemInput.modifiers) : null,
        itemSubtotal,
        stock,
      });
    }

    const discount = params.discount || 0;
    const total = Math.max(0, subtotal - discount);

    // 4. Determine initial order status & payment status.
    // RETAIL stores have no kitchen queue: a counter sale is COMPLETED at charge
    // time. FOOD stores enter the queue as ACCEPTED and advance through prep.
    const isRetail = (store.mode || 'FOOD') === 'RETAIL';
    let initialStatus: OrderStatus = params.status || 'NEW';
    let paymentStatus: PaymentStatus = 'PENDING';

    if (params.source === 'STAFF_POS') {
      paymentStatus = params.immediatePayment ? 'SUCCESS' : 'PENDING';
      if (!params.status) {
        initialStatus = isRetail ? 'COMPLETED' : 'ACCEPTED';
      }
    }

    const acceptedAt =
      initialStatus === 'ACCEPTED' || initialStatus === 'PREPARING' || initialStatus === 'READY' || initialStatus === 'COMPLETED'
        ? now
        : null;
    const preparingAt = initialStatus === 'PREPARING' || initialStatus === 'READY' || initialStatus === 'COMPLETED' ? now : null;
    const readyAt = initialStatus === 'READY' || initialStatus === 'COMPLETED' ? now : null;
    const completedAt = initialStatus === 'COMPLETED' ? now : null;

    // Execute order creation in PostgreSQL transaction
    return transaction(async (client) => {
      // 5. Generate ticket number inside transaction
      let ticketNumber = params.ticketNumber;
      if (!ticketNumber) {
        const ticketRes = await queueEngine.generateNextTicketNumber(params.storeId, businessDate, client);
        ticketNumber = ticketRes.ticketNumber;
      }

      // 5b. Shop orders get a sequential invoice number (FL-0231 ...).
      let invoiceNumber: string | null = null;
      if (params.isWholesale) {
        const srow = await client.query('SELECT last_invoice_number FROM stores WHERE id = $1', [params.storeId]);
        const nextNo = Number(srow.rows?.[0]?.last_invoice_number ?? 230) + 1;
        await client.query('UPDATE stores SET last_invoice_number = $1 WHERE id = $2', [nextNo, params.storeId]);
        invoiceNumber = 'FL-0' + nextNo;
      }

      // 6. Insert Order
      await client.query(
        `INSERT INTO orders (
          id, client_order_id, store_id, business_date, customer_id, source,
          status, payment_status, ticket_number, subtotal, discount, total,
          notes, created_at, accepted_at, preparing_at, ready_at, completed_at, actor_id,
          pay_method, is_wholesale, credit_customer_id, invoice_number, cash_tendered
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24
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
          readyAt,
          completedAt,
          params.actorId || null,
          params.paymentMethod || null,
          !!params.isWholesale,
          params.creditCustomerId || null,
          invoiceNumber,
          params.cashTendered ?? null,
        ]
      );

      // 7. Insert Order Items (with pack, unit and cost snapshot for retail)
      for (const item of computedItems) {
        await client.query(
          `INSERT INTO order_items (
            id, order_id, product_id, pack_id, sell_unit, product_name_snapshot,
            unit_price_snapshot, cost_snapshot, quantity, modifiers_json, subtotal
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            item.id,
            orderId,
            item.productId,
            item.packId,
            item.sellUnit,
            item.productName,
            item.unitPrice,
            item.costSnapshot,
            item.quantity,
            item.modifiersJson,
            item.itemSubtotal,
          ]
        );

        // 7b. Reduce live stock for this line (clamp at zero — the goods already
        // left the shelf, never block or oversell-error a completed sale).
        if (item.stock?.kind === 'pack') {
          const cur = await client.query('SELECT stock FROM product_packs WHERE id = $1', [item.stock.packId]);
          const left = Math.max(0, Number(cur.rows?.[0]?.stock ?? 0) - item.stock.units);
          await client.query('UPDATE product_packs SET stock = $1 WHERE id = $2', [left, item.stock.packId]);
        } else if (item.stock?.kind === 'loose') {
          const cur = await client.query('SELECT stock_grams FROM products WHERE id = $1', [item.stock.productId]);
          const left = Math.max(0, Number(cur.rows?.[0]?.stock_grams ?? 0) - item.stock.grams);
          await client.query('UPDATE products SET stock_grams = $1 WHERE id = $2', [left, item.stock.productId]);
        }
      }

      // 7c. Credit sale: record the charge in the dues ledger and bump the
      // account balance (ageing from the first unpaid charge).
      if (params.paymentMethod === 'CREDIT' && params.creditCustomerId && total > 0) {
        await client.query(
          `INSERT INTO dues_entries (id, store_id, customer_id, order_id, kind, amount, note, business_date, created_at)
           VALUES ($1, $2, $3, $4, 'CHARGE', $5, $6, $7, $8)`,
          [crypto.randomUUID(), params.storeId, params.creditCustomerId, orderId, total, invoiceNumber || null, businessDate, now]
        );
        await client.query(
          'UPDATE credit_customers SET owes = owes + $1 WHERE id = $2 AND store_id = $3',
          [total, params.creditCustomerId, params.storeId]
        );
        // Start ageing only if the account was previously clear.
        await client.query(
          'UPDATE credit_customers SET oldest_due_at = $1 WHERE id = $2 AND oldest_due_at IS NULL',
          [now, params.creditCustomerId]
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
        payMethod: params.paymentMethod,
        isWholesale: !!params.isWholesale,
        creditCustomerId: params.creditCustomerId || undefined,
        invoiceNumber: invoiceNumber || undefined,
        cashTendered: params.cashTendered,
        ticketNumber,
        subtotal,
        discount,
        total,
        notes: params.notes || undefined,
        createdAt: now,
        acceptedAt: acceptedAt || undefined,
        preparingAt: preparingAt || undefined,
        readyAt: readyAt || undefined,
        completedAt: completedAt || undefined,
        items: computedItems.map((i) => ({
          id: i.id,
          orderId,
          productId: i.productId,
          packId: i.packId || undefined,
          sellUnit: i.sellUnit,
          productNameSnapshot: i.productName,
          unitPriceSnapshot: i.unitPrice,
          costSnapshot: i.costSnapshot ?? undefined,
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
      payMethod: (row.pay_method as PaymentMethod) || undefined,
      isWholesale: Boolean(row.is_wholesale),
      creditCustomerId: row.credit_customer_id || undefined,
      invoiceNumber: row.invoice_number || undefined,
      cashTendered: row.cash_tendered != null ? Number(row.cash_tendered) : undefined,
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
        packId: i.pack_id || undefined,
        sellUnit: (i.sell_unit as any) || undefined,
        productNameSnapshot: i.product_name_snapshot,
        unitPriceSnapshot: Number(i.unit_price_snapshot),
        costSnapshot: i.cost_snapshot != null ? Number(i.cost_snapshot) : undefined,
        quantity: Number(i.quantity),
        modifiers: i.modifiers_json ? (typeof i.modifiers_json === 'string' ? JSON.parse(i.modifiers_json) : i.modifiers_json) : undefined,
        subtotal: Number(i.subtotal),
      })),
    };
  }
}

export const orderEngine = new OrderEngine();
