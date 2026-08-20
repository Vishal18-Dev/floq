# FLOQ Multi-Client Architecture & Future Integrations

FLOQ is architected from day one as a monorepo platform serving multiple specialized client applications interacting with the **same shared backend, order engine, and database**.

---

## Client Applications Matrix

| Client Application | Primary Target | Key Responsibilities | Current Status |
|---|---|---|---|
| **FLOQ Merchant** | Counter Smartphone (Vendor) | Selling, Cash/UPI checkout, Queue management, Product catalog, Daily analytics, Voice announcements. | **Implemented & Live** |
| **Customer PWA** | Customer Smartphone via QR | Scanning QR (`/customer/store/:slug`), Browsing menu, Submitting order, UPI payment, Live status tracking. | Architectural Boundary & API live |
| **Kitchen / Display** | Kitchen Tablet or TV Screen | Real-time queue columns, station filtering (Beverage vs Grill), Loud voice announcements for ready tokens. | Architectural Boundary & API live |
| **Admin Dashboard** | Operations & Platform Support | Multi-merchant onboarding, settlement logs, SLA analytics, dispute resolution. | Architectural Boundary |

---

## 1. Customer PWA Integration Guide

### Step 1: Scan & Fetch Menu
The Customer PWA requests public, safe endpoints:
```http
GET /api/public/stores/sharma-breakfast-corner
GET /api/public/stores/sharma-breakfast-corner/products
```

### Step 2: Place Order
The customer submits items without mandatory account creation:
```http
POST /api/public/stores/sharma-breakfast-corner/orders
Content-Type: application/json

{
  "customerName": "Rohan",
  "items": [
    { "productId": "prod_sharma_1", "quantity": 2 }
  ]
}
```

### Step 3: Track Live Status
The customer monitors token `#143` progress:
```http
GET /api/public/orders/:orderId
```

---

## 2. Kitchen Display App Integration Guide

The Display client connects to the real-time SSE stream:
```http
GET /api/realtime?storeId=store_sharma_01
```
And renders 3 high-contrast columns: `PREPARING`, `READY`, and `DELAYED`, calling the Web Audio/Speech engine when a ticket moves to `READY`.
