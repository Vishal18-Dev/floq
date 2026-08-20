# FLOQ Production Configuration & Environment Checklist

## Mandated Rules for Production Deployments

1. **NO Hardcoded Secrets**: Secrets must be injected via environment variables or secret managers (e.g. AWS Secrets Manager or GCP Secret Manager).
2. **NO Development Defaults**: Default development keys (e.g. `floq-dev-secret-key-12345`) cause immediate server process failure.
3. **NO Localhost API URLs**: Production Android builds (`in.floq.merchant`) must point to HTTPS endpoints (`https://api.floq.in`).
4. **NO Ephemeral Storage**: Backend database must run on persistent block storage.

---

## Required Environment Variables Matrix

| Variable | Description | Production Mandate | Sensitive |
| :--- | :--- | :--- | :---: |
| `NODE_ENV` | Application environment state | Set strictly to `production`. | No |
| `PORT` | HTTP server listening port | Set to `4000` (or system port). | No |
| `JWT_SECRET` | 256-bit secret key for signing JWT tokens | **Must be a random 32+ char key**. Cannot equal dev defaults. | **YES** |
| `CORS_ORIGIN` | Allowed cross-origin domains | Set strictly to `https://vendor.floq.in,https://app.floq.in`. | No |
| `DB_PATH` | Path to persistent SQLite database file | `/var/lib/floq/database/floq.sqlite` on persistent storage. | No |
| `DB_BACKUP_DIR` | Path to snapshot backup directory | `/var/lib/floq/database/backups`. | No |
| `ALLOW_MOCK_AUTH` | Enables mock OTP codes (`123456`) | **Must be `false`**. | No |
| `ALLOW_MOCK_PAYMENTS` | Enables mock UPI payment confirmation | **Must be `false`**. | No |
| `RAZORPAY_KEY_ID` | Production Razorpay key identifier | Required for live UPI payments. | No |
| `RAZORPAY_KEY_SECRET` | Production Razorpay API secret | Required for live UPI payments. | **YES** |
| `RAZORPAY_WEBHOOK_SECRET` | HMAC signature verification key | Required for live payment webhooks. | **YES** |
| `TWILIO_ACCOUNT_SID` | SMS Gateway Account SID | Required for live SMS OTP delivery. | No |
| `TWILIO_AUTH_TOKEN` | SMS Gateway API Token | Required for live SMS OTP delivery. | **YES** |
| `SENTRY_DSN` | Sentry Error Tracking DSN | Required for error monitoring. | No |
