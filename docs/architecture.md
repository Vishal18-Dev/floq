# FLOQ Architecture Documentation

## System Topology & Monorepo Structure

FLOQ is structured as an npm monorepo (`npm workspaces`):

```
floq/
├── backend/                  # Shared Node.js REST & Realtime Backend
│   ├── src/
│   │   ├── api/
│   │   │   ├── middleware/   # JWT Auth & Multi-Tenant Authorization
│   │   │   └── routes/       # Auth, Orders, Payments, Stores, Products, Sync, Public, Analytics
│   │   ├── db/               # SQLite connection, schema.sql, migrations, seed.ts
│   │   ├── services/         # AuthService, OrderEngine, PaymentEngine, QueueEngine, RealtimeService, AuditLogger
│   │   └── server.ts         # Express server entry point
│   └── tests/                # Vitest integration test suite
├── apps/
│   └── vendor/               # FLOQ Merchant Mobile POS (Expo SDK 54, React Native 0.81)
└── packages/
    ├── types/                # Shared TypeScript domain interfaces
    ├── constants/            # State machines, store presets, voice templates
    ├── utils/                # INR currency & ticket formatting helpers
    ├── validation/           # Zod input validation schemas
    └── ui/                   # Shared UI primitives
```

## Key Architectural Guarantees

1. **Strict Multi-Tenant Isolation**: Verified JWT token identifies merchant and authorized store IDs. Header-based spoofing is completely eliminated.
2. **Atomic Daily Ticket Generator**: Ticket sequence numbers increment atomically inside SQLite WAL transactions per `(store_id, business_date)`.
3. **Idempotent Offline Synchronization**: Every offline order carries a globally unique `clientOrderId` (UUID), guaranteeing duplicate sync pushes never produce duplicate server orders or resequence customer receipts.
4. **Authenticated Realtime Push**: Resilient SSE stream (`/api/realtime`) emits typed events (`ORDER_CREATED`, `ORDER_UPDATED`, `PAYMENT_UPDATED`) with unique `eventId` attributes to prevent duplicate voice announcements.
5. **Audited Cash & Transaction History**: All cash transactions, status transitions, and price edits produce persistent audit records in `audit_logs`.
