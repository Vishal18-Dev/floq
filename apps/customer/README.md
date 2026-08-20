# FLOQ Customer PWA (Future Client)

## Architectural Boundary

The Customer PWA will allow end customers to:
1. Scan a merchant's table / counter QR code: `/customer/store/:storeSlug`
2. Browse real-time products, prices, categories, and modifier options via public endpoints:
   - `GET /api/public/stores/:storeSlug`
   - `GET /api/public/stores/:storeSlug/products`
3. Add items to cart and submit orders directly into the **Single Unified Order Engine**:
   - `POST /api/public/stores/:storeSlug/orders`
4. Pay via dynamic UPI intent / gateway
5. Receive live digital token ticket (e.g. `#143`) and track order status in real time:
   - `GET /api/public/orders/:orderId`
   - Live SSE updates on order transitions: `NEW -> ACCEPTED -> PREPARING -> READY`

## Shared Platform Integration
- **Shared Types**: `@floq/types` (`Order`, `Product`, `QueueTicket`)
- **Shared Validation**: `@floq/validation` (`CreateOrderSchema`)
- **Shared Constants & State Machine**: `@floq/constants` (`ALLOWED_ORDER_TRANSITIONS`)
- **Shared Backend**: Interacts with the same backend API as the Vendor App.
