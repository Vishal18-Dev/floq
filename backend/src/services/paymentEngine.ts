import crypto from 'crypto';
import { query, queryOne, transaction } from '../db';
import { Payment, PaymentMethod, PaymentStatus } from '@floq/types';
import { ALLOWED_PAYMENT_TRANSITIONS } from '@floq/constants';
import { realtimeService } from './realtimeService';
import { auditLogger } from './auditLogger';
import { config } from '../config';

export interface PaymentResult {
  payment: Payment;
  qrPayload?: string;
  upiUri?: string;
  isSandbox: boolean;
}

export interface PaymentProvider {
  createPayment(orderId: string, amount: number, method: PaymentMethod, metadata?: any): Promise<PaymentResult>;
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
  confirmPayment(paymentId: string, providerReference?: string, actorId?: string): Promise<PaymentResult>;
  failPayment(paymentId: string, reason?: string): Promise<PaymentResult>;
  refundPayment(paymentId: string, actorId?: string): Promise<PaymentResult>;
  handleWebhook(payload: any, signature?: string): Promise<{ handled: boolean; paymentId?: string }>;
}

export class MockUPIProvider implements PaymentProvider {
  public async createPayment(orderId: string, amount: number, method: PaymentMethod, metadata?: any): Promise<PaymentResult> {
    const paymentId = crypto.randomUUID();
    const now = new Date().toISOString();
    const txnRef = `FLOQ_UPI_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const order = await queryOne(
      'SELECT o.*, ss.upi_id, ss.upi_name FROM orders o LEFT JOIN store_settings ss ON o.store_id = ss.store_id WHERE o.id = $1',
      [orderId]
    );
    if (!order) {
      throw new Error(`Order not found for payment: ${orderId}`);
    }

    const upiId = order.upi_id || 'sharma.stall@okhdfcbank';
    const upiName = order.upi_name || 'Sharma Breakfast Corner';
    const upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${amount.toFixed(2)}&cu=INR&tr=${txnRef}&tn=${encodeURIComponent(`FLOQ-${order.ticket_number}`)}`;

    const initialStatus: PaymentStatus = method === 'CASH' ? 'SUCCESS' : 'PENDING';

    await query(
      `INSERT INTO payments (id, order_id, method, status, amount, provider_reference, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [paymentId, orderId, method, initialStatus, amount, txnRef, now, now]
    );

    if (initialStatus === 'SUCCESS') {
      await query("UPDATE orders SET payment_status = 'SUCCESS' WHERE id = $1", [orderId]);
    }

    if (method === 'CASH') {
      await auditLogger.log({
        actorId: metadata?.actorId || 'STAFF',
        actorRole: 'STAFF',
        storeId: order.store_id,
        action: 'CASH_PAYMENT_CONFIRMED',
        entityType: 'PAYMENT',
        entityId: paymentId,
        details: { orderId, amount, method },
      });
    }

    const payment: Payment = {
      id: paymentId,
      orderId,
      provider: 'FLOQ_SIMULATED_UPI',
      method,
      status: initialStatus,
      amount,
      providerReference: txnRef,
      createdAt: now,
      updatedAt: now,
    };

    realtimeService.emit(order.store_id, {
      type: 'PAYMENT_UPDATED',
      payment,
      orderId,
    });

    return {
      payment,
      upiUri,
      qrPayload: upiUri,
      isSandbox: true,
    };
  }

  public async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    const row = await queryOne('SELECT status FROM payments WHERE id = $1', [paymentId]);
    if (!row) throw new Error(`Payment not found: ${paymentId}`);
    return row.status as PaymentStatus;
  }

  public async confirmPayment(paymentId: string, providerReference?: string, actorId?: string): Promise<PaymentResult> {
    const payment = await queryOne('SELECT * FROM payments WHERE id = $1', [paymentId]);
    if (!payment) throw new Error(`Payment not found: ${paymentId}`);

    const allowedTransitions = ALLOWED_PAYMENT_TRANSITIONS[payment.status as PaymentStatus];
    if (!allowedTransitions.includes('SUCCESS')) {
      throw new Error(`Cannot transition payment from ${payment.status} to SUCCESS`);
    }

    const now = new Date().toISOString();
    const ref = providerReference || payment.provider_reference || `UPI_CONF_${Date.now()}`;

    await query("UPDATE payments SET status = 'SUCCESS', provider_reference = $1, updated_at = $2 WHERE id = $3", [
      ref,
      now,
      paymentId,
    ]);

    await query("UPDATE orders SET payment_status = 'SUCCESS' WHERE id = $1", [payment.order_id]);

    const updatedPayment = await queryOne('SELECT * FROM payments WHERE id = $1', [paymentId]);
    const order = await queryOne('SELECT store_id FROM orders WHERE id = $1', [payment.order_id]);

    const resultPayment: Payment = {
      id: updatedPayment.id,
      orderId: updatedPayment.order_id,
      provider: updatedPayment.provider || 'FLOQ_SIMULATED_UPI',
      method: updatedPayment.method,
      status: updatedPayment.status,
      amount: Number(updatedPayment.amount),
      providerReference: updatedPayment.provider_reference,
      createdAt: new Date(updatedPayment.created_at).toISOString(),
      updatedAt: new Date(updatedPayment.updated_at).toISOString(),
    };

    if (order) {
      await auditLogger.log({
        actorId: actorId || 'SYSTEM',
        actorRole: 'STAFF',
        storeId: order.store_id,
        action: 'PAYMENT_CONFIRMED',
        entityType: 'PAYMENT',
        entityId: paymentId,
        details: { amount: Number(payment.amount), providerReference: ref },
      });

      realtimeService.emit(order.store_id, {
        type: 'PAYMENT_UPDATED',
        payment: resultPayment,
        orderId: payment.order_id,
      });
    }

    return {
      payment: resultPayment,
      isSandbox: true,
    };
  }

  public async failPayment(paymentId: string, reason?: string): Promise<PaymentResult> {
    const payment = await queryOne('SELECT * FROM payments WHERE id = $1', [paymentId]);
    if (!payment) throw new Error(`Payment not found: ${paymentId}`);

    const now = new Date().toISOString();
    await query("UPDATE payments SET status = 'FAILED', updated_at = $1 WHERE id = $2", [now, paymentId]);
    await query("UPDATE orders SET payment_status = 'FAILED' WHERE id = $1", [payment.order_id]);

    const updatedPayment = await queryOne('SELECT * FROM payments WHERE id = $1', [paymentId]);
    const order = await queryOne('SELECT store_id FROM orders WHERE id = $1', [payment.order_id]);

    const resultPayment: Payment = {
      id: updatedPayment.id,
      orderId: updatedPayment.order_id,
      provider: updatedPayment.provider || 'FLOQ_SIMULATED_UPI',
      method: updatedPayment.method,
      status: updatedPayment.status,
      amount: Number(updatedPayment.amount),
      providerReference: updatedPayment.provider_reference,
      createdAt: new Date(updatedPayment.created_at).toISOString(),
      updatedAt: new Date(updatedPayment.updated_at).toISOString(),
    };

    if (order) {
      realtimeService.emit(order.store_id, {
        type: 'PAYMENT_UPDATED',
        payment: resultPayment,
        orderId: payment.order_id,
      });
    }

    return {
      payment: resultPayment,
      isSandbox: true,
    };
  }

  public async refundPayment(paymentId: string, actorId?: string): Promise<PaymentResult> {
    const payment = await queryOne('SELECT * FROM payments WHERE id = $1', [paymentId]);
    if (!payment) throw new Error(`Payment not found: ${paymentId}`);

    const now = new Date().toISOString();
    await query("UPDATE payments SET status = 'REFUNDED', updated_at = $1 WHERE id = $2", [now, paymentId]);
    await query("UPDATE orders SET payment_status = 'REFUNDED' WHERE id = $1", [payment.order_id]);

    const updatedPayment = await queryOne('SELECT * FROM payments WHERE id = $1', [paymentId]);
    const order = await queryOne('SELECT store_id FROM orders WHERE id = $1', [payment.order_id]);

    const resultPayment: Payment = {
      id: updatedPayment.id,
      orderId: updatedPayment.order_id,
      provider: updatedPayment.provider || 'FLOQ_SIMULATED_UPI',
      method: updatedPayment.method,
      status: updatedPayment.status,
      amount: Number(updatedPayment.amount),
      providerReference: updatedPayment.provider_reference,
      createdAt: new Date(updatedPayment.created_at).toISOString(),
      updatedAt: new Date(updatedPayment.updated_at).toISOString(),
    };

    if (order) {
      await auditLogger.log({
        actorId: actorId || 'STAFF',
        actorRole: 'STAFF',
        storeId: order.store_id,
        action: 'PAYMENT_REFUNDED',
        entityType: 'PAYMENT',
        entityId: paymentId,
        details: { amount: Number(payment.amount) },
      });

      realtimeService.emit(order.store_id, {
        type: 'PAYMENT_UPDATED',
        payment: resultPayment,
        orderId: payment.order_id,
      });
    }

    return {
      payment: resultPayment,
      isSandbox: true,
    };
  }

  public async handleWebhook(payload: any, signature?: string): Promise<{ handled: boolean; paymentId?: string }> {
    const paymentId = payload.paymentId || payload.id;
    if (paymentId && payload.status === 'SUCCESS') {
      await this.confirmPayment(paymentId, payload.providerReference || 'WEBHOOK_MOCK_REF');
      return { handled: true, paymentId };
    }
    return { handled: false };
  }
}

export class ProductionPaymentProvider implements PaymentProvider {
  public async createPayment(): Promise<PaymentResult> {
    throw new Error('Production Payment Provider requires credentials (RAZORPAY_KEY_SECRET / CASHFREE_CLIENT_SECRET)');
  }
  public async getPaymentStatus(): Promise<PaymentStatus> {
    throw new Error('Production Payment Provider not configured.');
  }
  public async confirmPayment(): Promise<PaymentResult> {
    throw new Error('Production Payment Provider not configured.');
  }
  public async failPayment(): Promise<PaymentResult> {
    throw new Error('Production Payment Provider not configured.');
  }
  public async refundPayment(): Promise<PaymentResult> {
    throw new Error('Production Payment Provider not configured.');
  }
  public async handleWebhook(): Promise<{ handled: boolean; paymentId?: string }> {
    throw new Error('Production Payment Provider not configured.');
  }
}

export const paymentEngine: PaymentProvider = config.allowMockPayments
  ? new MockUPIProvider()
  : new ProductionPaymentProvider();
