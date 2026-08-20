# FLOQ API Specification

## 1. Authentication & Tenant Headers

Protected merchant endpoints require:
- `x-store-id`: Active store identifier (e.g. `store_sharma_01`)
- `x-merchant-id`: Merchant identifier (e.g. `merchant_sharma_01`)

The backend validates that the merchant owns the requested store on every request.

---

## 2. Protected Merchant Endpoints

### Store & Settings
- `GET /api/stores/current` — Returns store profile, active staff, connected devices, and store settings.
- `PATCH /api/stores/settings` — Updates settings (`voiceEnabled`, `voiceLanguage`, `typicalPrepTimeMinutes`, `upiId`).
- `POST /api/stores/apply-template` — Applies a preset merchant template.

### Product Catalog
- `GET /api/products` — Returns all categories, products, modifiers, and inventory levels for the active store.
- `POST /api/products` — Creates a new menu item.
- `PATCH /api/products/:id` — Updates price, name, category, station, or availability.
- `DELETE /api/products/:id` — Removes a product.
- `PATCH /api/products/:id/inventory` — Updates current stock and low-stock threshold.

### Order Engine
- `GET /api/orders?status={status}&limit={limit}` — Lists orders for the store.
- `GET /api/orders/:id` — Returns single order with full item snapshots and timestamps.
- `POST /api/orders` — Creates an order (Staff POS or digital).
- `PATCH /api/orders/:id/status` — Transitions order state (`NEW` $\to$ `ACCEPTED` $\to$ `PREPARING` $\to$ `READY` $\to$ `COMPLETED`).

### Payments
- `POST /api/payments` — Initiates cash or dynamic UPI QR payment.
- `GET /api/payments/:id` — Retrieves payment status.
- `POST /api/payments/:id/confirm` — Confirms simulated UPI payment.
- `POST /api/payments/:id/fail` — Simulates UPI decline.

### Queue & Realtime
- `GET /api/queue` — Returns live 4-column queue (`newOrders`, `preparingOrders`, `readyOrders`, `delayedOrders`).
- `GET /api/realtime?storeId={storeId}` — Server-Sent Events (SSE) stream for live updates.

### Analytics & Sync
- `GET /api/analytics/daily?date={YYYY-MM-DD}` — Daily sales summary, hourly peak, AOV, and top products.
- `POST /api/sync` — Reconciles offline-created cash transactions idempotently.

---

## 3. Public Customer Endpoints (Unauthenticated)

- `GET /api/public/stores/:slug` — Returns safe public store details (name, hours, UPI ID).
- `GET /api/public/stores/:slug/products` — Returns public menu categorized with prices.
- `POST /api/public/stores/:slug/orders` — Customer places an order via QR.
- `GET /api/public/orders/:id` — Customer checks live order progress and ticket number.
