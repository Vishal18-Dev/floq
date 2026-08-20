# FLOQ Kitchen / Counter Display App (Future Client)

## Architectural Boundary

The Display App is designed for kitchen tablets or large customer-facing counter TV displays.

Key Responsibilities:
1. Subscribe to real-time order stream via SSE / WebSockets:
   - `GET /api/queue?storeId=...`
   - Realtime event channel `store:{storeId}:queue`
2. Display 3-stage visual queue board:
   - `PREPARING`: Token numbers and items
   - `READY`: Large flashing token numbers for customer collection
   - `DELAYED`: Warning highlights
3. Audio / Voice Announcements for ready tokens:
   - Triggered on state change to `READY`
4. Station-specific filtering (e.g. Chai station vs Grill station display)

## Shared Platform Integration
- **Shared Types**: `@floq/types` (`QueueTicket`, `DeviceRole`)
- **Shared Voice Lexicon**: `@floq/constants`
- **Shared Sound Synth**: `@floq/utils`
