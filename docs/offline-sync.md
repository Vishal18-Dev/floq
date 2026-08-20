# FLOQ Offline Synchronization & Ticket Stability

## 1. Ticket Numbering Architecture (Customer-Visible & Final)

### Guiding Principle
> **A customer-visible queue or ticket number must NEVER change after synchronization.**

### Exact Behavior Breakdown

1. **Local Ticket Generation**:
   - When a device is offline and processes a sale, it assigns a customer-visible ticket number using a local counter ([storage.ts](file:///Users/vishalrao/Developer/floq/apps/vendor/src/services/storage.ts)): e.g. `#OFF-101`, `#OFF-102`.
   - This ticket number is immediately displayed on the POS screen and printed on customer receipts.
2. **Server Preservation on Synchronization**:
   - Every offline order carries a globally unique `clientOrderId` (UUID) and the generated `ticketNumber` (`#OFF-101`).
   - When connection is restored and `POST /api/sync` runs, `orderEngine.createOrder()` accepts and **preserves the exact client ticket number `#OFF-101`**.
   - The server inserts `#OFF-101` directly into `orders` and `queue_tickets` tables.
   - **Result**: What the customer saw on their receipt (`#OFF-101`) matches what appears on the server, the kitchen display, and realtime event streams!

---

## 2. Multi-Device Offline Model

| Property | Behavior |
| :--- | :--- |
| **Order Identity** | Assigned UUID `clientOrderId` (e.g. `offline_1771286400_abc12`). |
| **Sync Identity** | Uniquely identified by `client_order_id` in database table `orders` (`UNIQUE(store_id, client_order_id)`). |
| **Ticket Identity** | Device-scoped or local sequence ticket number (e.g. `#OFF-101`). Preserved on server upon sync. |
| **Queue Ordering** | On sync, server registers ticket into `queue_tickets`. Orders are ordered by `created_at` timestamp. |
| **Conflict Handling** | Duplicate sync requests for the same `clientOrderId` return existing order (`200 OK`) without creating duplicate records or incrementing sequences. |
| **Vendor View** | Vendor POS displays offline indicator, pending sync badge, and preserved local ticket number. |
| **Customer View** | Customer receives receipt with ticket `#OFF-101`, which remains unchanged throughout the order lifecycle. |

### Technical Concurrency Guarantee
Even if two devices (Device A and Device B) belonging to the same store create orders offline simultaneously, both assign distinct UUIDs. Upon reconnecting, the server ingests both records safely without sequence gaps or database primary key collisions.
