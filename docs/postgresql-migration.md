# FLOQ — PostgreSQL Migration Guide

## 1. Overview & Objectives

This document details the complete architectural migration of the FLOQ backend database from **SQLite** (`better-sqlite3`) to managed **PostgreSQL** (`pg`).

The goal is to transition to a cloud-native, scalable relational database suitable for deployment on **Render** (or AWS RDS / GCP Cloud SQL) while **preserving 100% of existing application behavior, API contracts, domain entities, transaction semantics, offline sync idempotency, and ticket sequence stability**.

---

## 2. Audit of Existing SQLite Implementation

### 2.1 Schema & Data Type Mapping

| Entity Column | SQLite Type | PostgreSQL Type | Notes / Rationale |
| :--- | :--- | :--- | :--- |
| `id` / Primary Keys | `TEXT` | `VARCHAR(64)` / `UUID` | Standard string identifiers (e.g. `store_sharma_01` or UUIDs). |
| `created_at` / `updated_at` | `TEXT` (ISO 8601 string) | `TIMESTAMPTZ` | Microsecond-accurate timezone-aware timestamp. |
| Money / Prices | `REAL` / `INTEGER` | `NUMERIC(10, 2)` | Exact decimal math preventing floating-point rounding errors. |
| Booleans (`is_active`, etc.) | `INTEGER` (`0` / `1`) | `BOOLEAN` | Native PostgreSQL boolean type (`TRUE` / `FALSE`). |
| JSON Arrays (`store_ids_json`) | `TEXT` (JSON string) | `JSONB` | Native binary JSON indexing and validation. |
| Ticket Sequences (`last_ticket_number`)| `INTEGER` | `INTEGER` | Native 32-bit signed integer. |
| Enums (`status`, `role`, `source`) | `TEXT` | `VARCHAR(32)` | Flexible validated string types with Zod / app-level guards. |

### 2.2 Table Inventory

1. `merchants` — Tenant merchant accounts (`id`, `name`, `phone`, `email`, `status`).
2. `stores` — Physical outlet store details (`id`, `merchant_id`, `name`, `slug`, `store_type`, `address`, `phone`, `opening_time`, `closing_time`, `timezone`, `status`).
3. `store_settings` — Store operational settings (`id`, `store_id`, `upi_id`, `upi_name`, `voice_enabled`, `voice_language`, `voice_verbosity`, `typical_prep_time_minutes`, `ticket_prefix`, `auto_accept_qr_orders`).
4. `users` — Merchant users & auth accounts (`id`, `phone`, `name`, `role`, `merchant_id`, `store_ids_json`, `otp_code`, `otp_expires_at`, `status`).
5. `staff` — Counter staff members (`id`, `store_id`, `name`, `phone`, `role`, `status`).
6. `devices` — Registered POS devices (`id`, `store_id`, `name`, `role`, `last_active_at`).
7. `categories` — Menu categories (`id`, `store_id`, `name`, `sort_order`, `is_active`).
8. `products` — Menu items (`id`, `store_id`, `category_id`, `name`, `description`, `price`, `is_available`, `sort_order`, `station`).
9. `orders` — Fulfillment orders (`id`, `client_order_id`, `store_id`, `business_date`, `source`, `status`, `payment_status`, `ticket_number`, `subtotal`, `discount`, `total`, `customer_id`, `notes`, `created_at`, `accepted_at`, `ready_at`, `completed_at`, `cancelled_at`, `cancellation_reason`).
10. `order_items` — Order line items (`id`, `order_id`, `product_id`, `product_name_snapshot`, `unit_price_snapshot`, `quantity`, `modifiers_json`, `subtotal`).
11. `payments` — Payment records (`id`, `order_id`, `provider_reference`, `method`, `status`, `amount`, `created_at`, `updated_at`).
12. `queue_tickets` — Live ticket queue (`id`, `order_id`, `store_id`, `business_date`, `ticket_number`, `created_at`, `called_at`, `completed_at`).
13. `ticket_sequences` — Daily atomic ticket counter per store (`store_id`, `business_date`, `last_ticket_number`).
14. `audit_logs` — Immutable audit trail (`id`, `actor_id`, `store_id`, `action`, `entity_type`, `entity_id`, `amount`, `metadata_json`, `created_at`).

---

## 3. Database Abstraction Layer Architecture

To keep application logic clean, raw SQLite calls (`better-sqlite3`) are replaced with an asynchronous, parameterized PostgreSQL Data Access Layer (`backend/src/db/index.ts`) built on `node-postgres` (`pg`):

```
Application Controllers / Services (OrderEngine, PaymentEngine, QueueEngine, AuthService)
                          │
                          ▼
            Data Access Layer (db/index.ts)
   ├── query<T>(sql: string, params?: any[]): Promise<T[]>
   ├── queryOne<T>(sql: string, params?: any[]): Promise<T | null>
   ├── execute(sql: string, params?: any[]): Promise<number>
   └── transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>
                          │
                          ▼
              pg.Pool Connection Pool
```

### PostgreSQL Transaction Safety & Concurrency
- All transactions execute within `BEGIN ... COMMIT / ROLLBACK` using `pool.connect()`.
- Daily Ticket Generation uses PostgreSQL `INSERT INTO ticket_sequences (store_id, business_date, last_ticket_number) VALUES ($1, $2, 1) ON CONFLICT (store_id, business_date) DO UPDATE SET last_ticket_number = ticket_sequences.last_ticket_number + 1 RETURNING last_ticket_number` inside an explicit transaction block.

---

## 4. Migration & Seed System

1. **Migration System (`npm run db:migrate`)**:
   - Migration runner in `backend/src/db/migrate.ts`.
   - Executes ordered SQL files in `backend/src/db/migrations/001_initial_schema.sql`.
   - Tracks applied migrations in `schema_migrations` table to enforce idempotency.
2. **Seed System (`npm run db:seed`)**:
   - Seed script in `backend/src/db/seed.ts`.
   - Populates initial merchant demo stores (*Sharma Breakfast Corner* and *Chai Point Express*).
   - Enforces a safety guard preventing accidental execution when `NODE_ENV === 'production'`.

---

## 5. Local Development Setup (Docker Compose)

- Provided `docker-compose.yml` launches a local PostgreSQL 16 container bound to `localhost:5432`.
- Documentation in [docs/local-development.md](file:///Users/vishalrao/Developer/floq/docs/local-development.md).

---

## 6. Render Deployment Readiness

- Server binds to `0.0.0.0` using `process.env.PORT`.
- Uses `process.env.DATABASE_URL` with SSL support (`ssl: { rejectUnauthorized: false }` for Render managed database).
- Zero dependency on local filesystem persistence or SQLite WAL files.
