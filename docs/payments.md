# FLOQ Payment Architecture & Provider Abstraction

## Current Payment Implementation Status

- **Development / Mock Provider (`MockUPIProvider`)**: Generates simulated `upi://pay` URI payloads for testing mobile QR rendering.
- **Cash Payment Confirmation**: Requires explicit merchant POS confirmation and records immutable records in `audit_logs`.
- **Payment State Machine**: Independent of order status. Payment status transitions follow strict rules (`PENDING` -> `SUCCESS` | `FAILED` | `REFUNDED`).

## Payment Provider Abstraction Interface

```typescript
export interface PaymentProvider {
  createPayment(orderId: string, amount: number, method: PaymentMethod, metadata?: any): Promise<PaymentResult>;
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
  confirmPayment(paymentId: string, providerReference?: string, actorId?: string): Promise<PaymentResult>;
  failPayment(paymentId: string, reason?: string): Promise<PaymentResult>;
  refundPayment(paymentId: string, actorId?: string): Promise<PaymentResult>;
  handleWebhook(payload: any, signature?: string): Promise<{ handled: boolean; paymentId?: string }>;
}
```

## Production Integration Requirements (Razorpay / Cashfree)

1. **Credentials Required**:
   - `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET`
   - `CASHFREE_APP_ID` & `CASHFREE_SECRET_KEY`
   - `PAYMENT_WEBHOOK_SECRET`
2. **Webhook Endpoint**: `POST /api/payments/webhook`
   - Unauthenticated public endpoint with HMAC-SHA256 signature verification.
   - Idempotent processing: Duplicate webhook callbacks for the same payment reference return `200 OK` without duplicating order state transitions.
3. **Cash Audit Trail**: Every Cash payment logs `{ actorId, storeId, action: 'CASH_PAYMENT_CONFIRMED', entityId, amount }` in SQLite `audit_logs`.
