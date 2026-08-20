import { query, queryOne } from '../db';
import { Order, QueueTicket } from '@floq/types';
import { formatTicketNumber, getElapsedMinutes } from '@floq/utils';

export interface QueueItem {
  ticket: QueueTicket;
  order: Order;
  waitingMinutes: number;
  isDelayed: boolean;
  typicalPrepMinutes: number;
}

export interface LiveQueueSummary {
  newOrders: QueueItem[];
  preparingOrders: QueueItem[];
  readyOrders: QueueItem[];
  completedOrders: QueueItem[];
  delayedOrders: QueueItem[];
  counts: {
    new: number;
    preparing: number;
    ready: number;
    completed: number;
    delayed: number;
    totalActive: number;
  };
}

export class QueueEngine {
  /**
   * Generate next sequential ticket number atomically for today for a given store.
   * Uses ON CONFLICT RETURNING with atomic update fallback.
   */
  public async generateNextTicketNumber(
    storeId: string,
    customBusinessDate?: string,
    client?: any
  ): Promise<{ ticketNumber: string; seq: number; businessDate: string }> {
    const businessDate = customBusinessDate || new Date().toISOString().split('T')[0];

    const execQuery = async (sql: string, params: any[]) => {
      if (client) {
        const res = await client.query(sql, params);
        return res.rows;
      }
      return query(sql, params);
    };

    const storeSettings = await execQuery('SELECT ticket_prefix FROM store_settings WHERE store_id = $1', [storeId]);
    const prefix = storeSettings.length > 0 ? storeSettings[0].ticket_prefix || '#' : '#';

    let nextSeq = 1;

    try {
      const rows = await execQuery(
        `INSERT INTO ticket_sequences (store_id, business_date, last_ticket_number)
         VALUES ($1, $2, 1)
         ON CONFLICT (store_id, business_date)
         DO UPDATE SET last_ticket_number = ticket_sequences.last_ticket_number + 1
         RETURNING last_ticket_number`,
        [storeId, businessDate]
      );
      nextSeq = Number(rows[0].last_ticket_number);
    } catch {
      const rows = await execQuery(
        'SELECT last_ticket_number FROM ticket_sequences WHERE store_id = $1 AND business_date = $2',
        [storeId, businessDate]
      );
      if (rows && rows.length > 0) {
        nextSeq = Number(rows[0].last_ticket_number) + 1;
        await execQuery(
          'UPDATE ticket_sequences SET last_ticket_number = $1 WHERE store_id = $2 AND business_date = $3',
          [nextSeq, storeId, businessDate]
        );
      } else {
        try {
          await execQuery(
            'INSERT INTO ticket_sequences (store_id, business_date, last_ticket_number) VALUES ($1, $2, 1)',
            [storeId, businessDate]
          );
        } catch {
          const retryRows = await execQuery(
            'SELECT last_ticket_number FROM ticket_sequences WHERE store_id = $1 AND business_date = $2',
            [storeId, businessDate]
          );
          nextSeq = Number(retryRows[0].last_ticket_number) + 1;
          await execQuery(
            'UPDATE ticket_sequences SET last_ticket_number = $1 WHERE store_id = $2 AND business_date = $3',
            [nextSeq, storeId, businessDate]
          );
        }
      }
    }

    return {
      ticketNumber: formatTicketNumber(nextSeq, prefix),
      seq: nextSeq,
      businessDate,
    };
  }

  /**
   * Get complete live queue structured into columns with delay calculations
   */
  public async getLiveQueue(storeId: string): Promise<LiveQueueSummary> {
    const storeSettings = await queryOne('SELECT typical_prep_time_minutes FROM store_settings WHERE store_id = $1', [storeId]);
    const typicalPrepMinutes = storeSettings?.typical_prep_time_minutes || 6;

    // Fetch active and recently completed orders
    const orderRows = await query(
      `SELECT o.*, qt.id as ticket_id, qt.called_at, qt.completed_at as ticket_completed_at
       FROM orders o
       LEFT JOIN queue_tickets qt ON o.id = qt.order_id
       WHERE o.store_id = $1 AND o.status != 'CANCELLED'
       ORDER BY o.created_at ASC`,
      [storeId]
    );

    if (orderRows.length === 0) {
      return {
        newOrders: [],
        preparingOrders: [],
        readyOrders: [],
        completedOrders: [],
        delayedOrders: [],
        counts: { new: 0, preparing: 0, ready: 0, completed: 0, delayed: 0, totalActive: 0 },
      };
    }

    const orderIds = orderRows.map((r) => r.id);
    const allItems = await query('SELECT * FROM order_items WHERE order_id = ANY($1::varchar[])', [orderIds]);

    const itemsByOrderId: Record<string, any[]> = {};
    for (const it of allItems) {
      if (!itemsByOrderId[it.order_id]) itemsByOrderId[it.order_id] = [];
      itemsByOrderId[it.order_id].push(it);
    }

    const newOrders: QueueItem[] = [];
    const preparingOrders: QueueItem[] = [];
    const readyOrders: QueueItem[] = [];
    const completedOrders: QueueItem[] = [];
    const delayedOrders: QueueItem[] = [];

    const now = Date.now();

    for (const row of orderRows) {
      const items = (itemsByOrderId[row.id] || []).map((i) => ({
        id: i.id,
        orderId: i.order_id,
        productId: i.product_id,
        productNameSnapshot: i.product_name_snapshot,
        unitPriceSnapshot: Number(i.unit_price_snapshot),
        quantity: i.quantity,
        modifiers: i.modifiers_json ? (typeof i.modifiers_json === 'string' ? JSON.parse(i.modifiers_json) : i.modifiers_json) : undefined,
        subtotal: Number(i.subtotal),
      }));

      const order: Order = {
        id: row.id,
        storeId: row.store_id,
        customerId: row.customer_id,
        customerName: row.customer_name || undefined,
        customerPhone: row.customer_phone || undefined,
        source: row.source,
        status: row.status,
        paymentStatus: row.payment_status,
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
        items,
      };

      const ticket: QueueTicket = {
        id: row.ticket_id || row.id,
        orderId: row.id,
        storeId: row.store_id,
        ticketNumber: row.ticket_number,
        createdAt: new Date(row.created_at).toISOString(),
        calledAt: row.called_at ? new Date(row.called_at).toISOString() : undefined,
        readyAt: row.ready_at ? new Date(row.ready_at).toISOString() : undefined,
        completedAt: row.ticket_completed_at ? new Date(row.ticket_completed_at).toISOString() : undefined,
      };

      const waitingMinutes = getElapsedMinutes(row.preparing_at || row.created_at);
      const isDelayed =
        (row.status === 'NEW' || row.status === 'ACCEPTED' || row.status === 'PREPARING') &&
        waitingMinutes >= typicalPrepMinutes;

      const queueItem: QueueItem = {
        ticket,
        order,
        waitingMinutes,
        isDelayed,
        typicalPrepMinutes,
      };

      if (isDelayed) {
        delayedOrders.push(queueItem);
      }

      if (row.status === 'NEW') {
        newOrders.push(queueItem);
      } else if (row.status === 'ACCEPTED' || row.status === 'PREPARING') {
        preparingOrders.push(queueItem);
      } else if (row.status === 'READY') {
        readyOrders.push(queueItem);
      } else if (row.status === 'COMPLETED') {
        const completedTime = row.completed_at ? new Date(row.completed_at).getTime() : 0;
        if (now - completedTime <= 60 * 60 * 1000) {
          completedOrders.push(queueItem);
        }
      }
    }

    completedOrders.sort(
      (a, b) =>
        new Date(b.order.completedAt || b.order.createdAt).getTime() -
        new Date(a.order.createdAt || a.order.createdAt).getTime()
    );

    return {
      newOrders,
      preparingOrders,
      readyOrders,
      completedOrders,
      delayedOrders,
      counts: {
        new: newOrders.length,
        preparing: preparingOrders.length,
        ready: readyOrders.length,
        completed: completedOrders.length,
        delayed: delayedOrders.length,
        totalActive: newOrders.length + preparingOrders.length + readyOrders.length,
      },
    };
  }
}

export const queueEngine = new QueueEngine();
