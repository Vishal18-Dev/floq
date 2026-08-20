# FLOQ Automated Test Suite Documentation

## Overview

The FLOQ backend test suite is powered by **Vitest** and **Supertest**, verifying authentication security, multi-tenant isolation, atomic ticket concurrency, idempotent sync, SSE realtime streams, and payment state transitions.

## Running Tests Locally

```bash
# Run all unit and integration tests
npm test --workspace=backend

# Run full monorepo build and test suite
npm run build && npm test --workspace=backend
```

## Test Coverage Map

| Test Suite File | Scope & Target | Key Assertions |
| :--- | :--- | :--- |
| `tests/auth.test.ts` | P0-1 Authentication & Security | Unauthenticated 401, Invalid token 401, Valid token 200, Cross-tenant 403, OTP login. |
| `tests/concurrentTickets.test.ts` | P0-4 Atomic Concurrency | 10, 50, 100 simultaneous concurrent order creations with zero duplicate tickets. |
| `tests/syncIdempotency.test.ts` | P0-5 Offline Sync Integrity | Stable customer tickets, clientOrderId idempotency, duplicate sync payload safety. |
| `tests/realtime.test.ts` | P0-3 Realtime SSE | SSE token authentication, initial `CONNECTED` handshake event, unique `eventId`. |
| `tests/payments.test.ts` | P0-2 Payment State Machine | Cash audit log, illegal state transition rejection, webhook handler. |
| `tests/floq.test.ts` | End-to-End Master Acceptance | Full POS sale flow, customer QR menu & tracking, multi-tenant isolation, state machine. |
