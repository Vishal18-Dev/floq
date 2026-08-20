# FLOQ Platform Admin App (Future Client)

## Architectural Boundary

The Admin App is designed for platform operators to manage merchants, monitor system health, and oversee financial settlements.

Key Responsibilities:
1. Multi-merchant onboarding, verification, and KYC status.
2. System-wide throughput monitoring (Orders/sec, UPI settlement reliability, peak platform load).
3. Support tooling (order lookups, merchant configuration overrides, dispute handling).
4. Store template management.

## Shared Platform Integration
- Consumes the same backend database models & `@floq/types`.
- Enforces platform-level RBAC without disrupting merchant tenant isolation.
