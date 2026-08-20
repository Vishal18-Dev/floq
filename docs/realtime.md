# FLOQ Realtime Order Push Architecture

## Overview

The FLOQ backend includes an SSE (Server-Sent Events) stream (`/api/realtime`) that connects the Vendor Mobile POS directly to incoming customer QR orders and status updates.

## SSE Authentication & Event Design

- **Endpoint**: `GET /api/realtime?storeId=<storeId>&token=<jwt_token>`
- **Event Header**: Every SSE event includes a unique `id: <uuid>` line for deduplication.

### Event Format

```json
id: 550e8400-e29b-41d4-a716-446655440000
data: {
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "ORDER_CREATED",
  "storeId": "store_sharma_01",
  "timestamp": "2026-08-17T23:00:00.000Z",
  "order": { ... }
}
```

## Vendor Mobile Client Resilience

1. **Deduplication**: `ResilientRealtimeClient` maintains a bounded set of `processedEventIds`. Duplicate events arriving over network retries are ignored.
2. **Reconnection & State Reconciliation**: When connection drops, the client automatically retries every 3 seconds and triggers `onReconnectedCallback` to refetch current orders and sync state from `/api/orders`.
3. **Voice Announcement Rules**: Voice announcements (`voiceService.announceNewOrder()`) trigger ONLY for genuinely new customer orders (`ORDER_CREATED`), never on state refreshes or reconnection.
