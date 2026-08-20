# FLOQ Relational Database Specification

## Relational Model Overview

FLOQ employs a normalized relational database schema (implemented in SQLite with WAL mode & strict foreign key checks, directly portable to PostgreSQL).

---

## Entity Relationship Summary

```text
Merchants (1) ───< Stores (N) ───< Categories (N) ───< Products (N)
                      │                                    │
                      ├───< Staff (N)                      ├───< Modifiers (N)
                      ├───< Devices (N)                    └───< InventoryItems (1)
                      ├───< StoreSettings (1)
                      │
                      └───< Orders (N) ───< OrderItems (N)
                               │
                               ├───< Payments (N)
                               └───< QueueTickets (1)
```

---

## Core Table Schemas

### 1. `merchants`
Primary merchant identity and account status.
- `id` (TEXT, PK)
- `name` (TEXT)
- `phone` (TEXT, UNIQUE)
- `email` (TEXT, NULLABLE)
- `status` (`ACTIVE` | `SUSPENDED`)
- `created_at`, `updated_at` (TIMESTAMP)

### 2. `stores`
Individual physical outlet / counter.
- `id` (TEXT, PK)
- `merchant_id` (TEXT, FK $\to$ `merchants.id`)
- `name` (TEXT)
- `slug` (TEXT, UNIQUE)
- `store_type` (`TEA_STALL` | `BREAKFAST` | `FOOD_STALL` | `JUICE` | `BAKERY` | `GROCERY` | etc.)
- `address`, `phone`, `opening_time`, `closing_time`, `timezone`
- `status` (`ACTIVE` | `INACTIVE`)

### 3. `products`
Menu item catalog.
- `id` (TEXT, PK)
- `store_id` (TEXT, FK $\to$ `stores.id`)
- `category_id` (TEXT, FK $\to$ `categories.id`)
- `name` (TEXT)
- `description` (TEXT)
- `price` (REAL)
- `image_url` (TEXT)
- `is_available` (INTEGER, 0/1)
- `sort_order` (INTEGER)
- `station` (`BEVERAGE` | `HOT_FOOD` | `GRILL` | `BAKERY` | `PACKAGED` | `GENERAL`)

### 4. `orders`
Unified order entity for all channels.
- `id` (TEXT, PK, UUID)
- `store_id` (TEXT, FK $\to$ `stores.id`)
- `customer_id` (TEXT, NULLABLE)
- `source` (`STAFF_POS` | `CUSTOMER_QR` | `WHATSAPP` | `DELIVERY` | `API`)
- `status` (`NEW` | `ACCEPTED` | `PREPARING` | `READY` | `COMPLETED` | `CANCELLED`)
- `payment_status` (`PENDING` | `SUCCESS` | `FAILED` | `REFUNDED`)
- `ticket_number` (TEXT, e.g. `#143`)
- `subtotal` (REAL)
- `discount` (REAL)
- `total` (REAL)
- `notes` (TEXT)
- `created_at`, `accepted_at`, `preparing_at`, `ready_at`, `completed_at`, `cancelled_at`

### 5. `order_items`
Snapshotted line items for an order.
- `id` (TEXT, PK)
- `order_id` (TEXT, FK $\to$ `orders.id`)
- `product_id` (TEXT, FK $\to$ `products.id`)
- `product_name_snapshot` (TEXT)
- `unit_price_snapshot` (REAL)
- `quantity` (INTEGER)
- `modifiers_json` (TEXT)
- `subtotal` (REAL)

### 6. `payments`
Financial transaction records.
- `id` (TEXT, PK)
- `order_id` (TEXT, FK $\to$ `orders.id`)
- `provider` (TEXT, e.g. `FLOQ_SIMULATED_UPI`, `CASH_REGISTER`)
- `method` (`UPI` | `CASH` | `OTHER`)
- `status` (`PENDING` | `SUCCESS` | `FAILED` | `REFUNDED`)
- `amount` (REAL)
- `provider_reference` (TEXT)

### 7. `queue_tickets`
Sequential token registry.
- `id` (TEXT, PK)
- `order_id` (TEXT, FK $\to$ `orders.id`, UNIQUE)
- `store_id` (TEXT, FK $\to$ `stores.id`)
- `ticket_number` (TEXT)
- `created_at`, `called_at`, `ready_at`, `completed_at`
