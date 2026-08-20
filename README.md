# FLOQ — Modern Mobile Commerce OS for Micro-Merchants

**FLOQ** is a high-speed, mobile-first physical commerce operating system architected for high-volume physical merchants in India (tea stalls, breakfast counters, food carts, juice vendors, bakeries, cafes, and canteens).

The core proposition is:
> **"Serve more customers with the same staff."**

By turning counter chaos into an instantaneous loop:
$$\text{Tap / Scan} \longrightarrow \text{Order} \longrightarrow \text{Payment} \longrightarrow \text{Ticket} \longrightarrow \text{Queue} \longrightarrow \text{Preparing} \longrightarrow \text{Ready} \longrightarrow \text{Completed} \longrightarrow \text{Sales Record}$$

---

## 🏗️ Monorepo Architecture

FLOQ is built as a unified monorepo with **one shared backend, one relational database, shared business logic, and multiple client applications**:

```text
floq/
├── apps/
│   ├── vendor/              ← FLOQ Merchant (Native Android Mobile App in React Native & Expo)
│   ├── customer/            ← Customer PWA (Architectural boundary & contract)
│   ├── display/             ← Kitchen / Counter TV Display (Architectural boundary)
│   └── admin/               ← Platform Admin Dashboard (Architectural boundary)
│
├── backend/                 ← Single Source of Truth Shared Backend (Node/Express + SSE)
│   ├── src/api/             ← Protected & Public REST endpoints
│   ├── src/services/        ← Unified Order Engine, Payment Abstraction, Queue Engine, Voice
│   └── src/db/              ← Relational SQLite/PostgreSQL schema & seed scripts
│
├── packages/
│   ├── types/               ← Shared Domain Types & Enums (@floq/types)
│   ├── validation/          ← Shared Zod Validation Schemas (@floq/validation)
│   ├── constants/           ← State Machine rules & Store Templates (@floq/constants)
│   ├── utils/               ← Formatters (₹ INR, Ticket #), Delay math, Audio Synthesizer (@floq/utils)
│   └── ui/                  ← Reusable Design System Tokens & Primitives (@floq/ui)
│
├── docs/                    ← Comprehensive Architecture & Technical Specifications
└── tests/                   ← Automated Acceptance & Contract Test Suite
```

---

## ⚡ Key Features

1. **Lightning Sell Screen**:
   - Zero multi-step forms. Tap items $\to$ see live cart $\to$ tap **[ CHARGE ₹XX ]** $\to$ choose Cash or UPI $\to$ Token generated $\to$ Done.
   - Quick Cash tender suggestions with instant change calculation.
2. **Unified Order Engine & State Machine**:
   - Single order lifecycle handling both `STAFF_POS` and `CUSTOMER_QR` orders.
   - Explicit state machine: `NEW -> ACCEPTED -> PREPARING -> READY -> COMPLETED`.
   - Immutable snapshotting on `order_items` (`productNameSnapshot`, `unitPriceSnapshot`).
3. **Live Queue & Delay Detection**:
   - Real-time sequential ticket token numbers (`#101`, `#102`...).
   - Automatic delay warnings for orders exceeding typical prep time (e.g. `⚠️ Delayed (Waiting 11m, Typical 6m)`).
4. **Multilingual Voice Announcements**:
   - Web Speech API + Web Audio chime synthesis.
   - Incoming QR orders: *"Token 147. Two chai and one poha."* (English / Hindi / Marathi).
   - Ready orders: *"Token 147 is ready."*
5. **Payment Provider Abstraction**:
   - Dynamic UPI QR generator with simulated sandbox webhooks.
   - Cash register tender with zero-latency reconciliation.
6. **Offline-First Resilience**:
   - Dexie IndexedDB caching of menu catalog and store settings.
   - Offline cash sales enqueued locally and auto-synced with idempotency upon reconnect.
7. **Multi-Tenant Data Isolation**:
   - Strict store and merchant scoping enforced server-side.
8. **Interactive Demo Suite**:
   - Integrated top bar drawer to simulate customer QR orders, trigger rush hours, test voice speech, and toggle offline network mode.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js $\ge$ 18.x
- npm $\ge$ 9.x

### 1. Installation
```bash
# Clone and enter directory
cd floq

# Install all monorepo workspace dependencies
npm install

# Build shared packages
npm run build
```

### 2. Database Setup & Seed
Populate demo store **Sharma Breakfast Corner** and **Chai Point Express**:
```bash
npm run seed
```

### 3. Run Development Servers
Start both the backend server (port 4000) and the vendor merchant app (port 3000):

```bash
# Start backend service
npm run dev:backend

# In a separate terminal, start vendor application
npm run dev:vendor
```

Open [http://localhost:3000](http://localhost:3000) on your mobile browser or desktop.

---

## 🧪 Running Automated Acceptance Tests

Run the full end-to-end acceptance test suite verifying staff sales, customer QR simulation, data isolation, offline sync, and state machine guards:

```bash
npm test
```

---

## 📚 Technical Documentation

Detailed architectural and engineering guides are available in `/docs`:
- [`architecture.md`](file:///Users/vishalrao/Developer/floq/docs/architecture.md) — System design, monorepo patterns, and core principles.
- [`database.md`](file:///Users/vishalrao/Developer/floq/docs/database.md) — Relational schema, indexes, snapshots, and migrations.
- [`api.md`](file:///Users/vishalrao/Developer/floq/docs/api.md) — Public and authenticated REST & SSE API contracts.
- [`order-lifecycle.md`](file:///Users/vishalrao/Developer/floq/docs/order-lifecycle.md) — Unified Order state machine & transition rules.
- [`payments.md`](file:///Users/vishalrao/Developer/floq/docs/payments.md) — Payment abstraction layer, Cash & simulated UPI.
- [`future-clients.md`](file:///Users/vishalrao/Developer/floq/docs/future-clients.md) — Integration guide for Customer PWA, Kitchen Display, and Admin apps.
