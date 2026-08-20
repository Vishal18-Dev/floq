# FLOQ Authentication & Security Architecture

## P0-1 Authentication Implementation

The header-based `x-merchant-id` model has been replaced with a verified JWT authentication framework.

### Phone OTP Auth Flow

```
Vendor App (Mobile)             Backend API                    SQLite Database
    │                                │                                │
    │ ─── 1. POST /api/auth/otp ────►│                                │
    │     { phone: "9876543210" }    │ ─── 2. Generate OTP 123456 ───►│ (Stored in users table)
    │                                │                                │
    │ ─── 3. POST /api/auth/verify ─►│                                │
    │     { phone, otp: "123456" }   │ ─── 4. Issue Signed JWT ──────►│
    │◄─── 5. Return UserSession ─────│                                │
    │     (Token stored in           │                                │
    │      Expo SecureStore)         │                                │
    │                                │                                │
    │ ─── 6. Authenticated Req ─────►│ ─── 7. authMiddleware ────────► Verify JWT & Store Authorization
    │     Authorization: Bearer      │      (Verify merchantId &      Reject 401/403 on mismatch
    │     <token>                    │       storeIds in payload)     No default merchant fallbacks!
```

### JWT Payload Structure

```json
{
  "userId": "user_sharma_01",
  "phone": "9876543210",
  "merchantId": "merchant_sharma_01",
  "storeIds": ["store_sharma_01"],
  "role": "OWNER",
  "iat": 1771286400,
  "exp": 1773878400
}
```

### Environment Configuration

- **Development Mode (`MOCK_AUTH=true`)**: Standard development OTP `123456` or `1234` is enabled for local mobile testing.
- **Production Mode (`MOCK_AUTH=false`)**: Requires `JWT_SECRET` environment variable and integrates real SMS gateway (Twilio / AWS SNS). Missing production credentials cause loud startup failures.
