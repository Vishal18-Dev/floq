# FLOQ Order Lifecycle & State Machine

## 1. Unified Operational Flow

All orders, whether created by counter staff or scanned via customer QR, follow the exact same unified lifecycle:

```text
       Staff POS                      Customer QR
           │                               │
           ▼                               ▼
    [ STAFF_POS ]                   [ CUSTOMER_QR ]
    Immediate / Cash                 Public QR Order
           │                               │
           ▼                               ▼
    (State: ACCEPTED)               (State: NEW)
           │                               │
           │                      Merchant Accepts
           │                               │
           └───────────────┬───────────────┘
                           │
                           ▼
                     [ PREPARING ]
                           │
                     Kitchen Done
                           │
                           ▼
                       [ READY ] ──▶ Voice Announcement: "Token 147 is ready."
                           │
                     Counter Handoff
                           │
                           ▼
                     [ COMPLETED ]
                           │
                           ▼
                    [ SALES RECORD ]
```

---

## 2. State Transition Rules

| Initial State | Permitted Next States | Description |
|---|---|---|
| `NEW` | `ACCEPTED`, `CANCELLED` | Customer QR order placed, awaiting merchant acceptance. |
| `ACCEPTED` | `PREPARING`, `CANCELLED` | Order acknowledged by kitchen staff. |
| `PREPARING` | `READY`, `CANCELLED` | Food is actively being prepared on station. |
| `READY` | `COMPLETED`, `CANCELLED` | Food is ready for pickup. Ticket announced over voice. |
| `COMPLETED` | *None* | Finalized and recorded in daily sales. |
| `CANCELLED` | *None* | Order cancelled and inventory restored. |

---

## 3. Delay Detection & SLA Monitoring

Every order records timestamps:
- `createdAt`
- `acceptedAt`
- `preparingAt`
- `readyAt`
- `completedAt`

The Queue Engine computes elapsed wait time against `store_settings.typical_prep_time_minutes` (default: 6 mins). If wait duration $\ge$ threshold, the order is flagged with `⚠️ Delayed` in the Live Queue and Orders screens.
