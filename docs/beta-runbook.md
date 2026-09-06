# FLOQ Beta Runbook

Everything you need to stand up the 3 beta merchants and put a working APK on their phones. White-glove: **you** onboard each merchant; they only ever type their PIN.

---

## 1. Deploy the backend

The backend runs migrations automatically on boot and **never seeds or wipes data**.

Required environment variables (the server refuses to start in production without the secrets):

| Var | Notes |
|-----|-------|
| `DATABASE_URL` | Managed PostgreSQL connection string |
| `JWT_SECRET` | Long random string (32+ chars) |
| `ADMIN_KEY` | Long random string — used only by the onboarding CLI |
| `CORS_ORIGIN` | Your host origin |
| `PIN_LENGTH` | `4` (default) |

Deploy, then confirm health:

```bash
curl https://your-floq-host.example.com/api/health
```

## 2. Onboard a merchant

Profiles live in `backend/scripts/profiles/`. Edit the three templates — fill in each merchant's **phone**, a **PIN** you choose for them, their **UPI ID**, and adjust the **items/prices**:

- `hotel-tamilnadu.json`  → FOOD mode, secondary language `ta` (Tamil)
- `tea-shop.json`         → FOOD mode, secondary language `hi` (adjust to their region)
- `keramruth-reseller.json` → RETAIL mode (no kitchen queue), `hi`

Then run the CLI against your deployed host:

```bash
ADMIN_KEY=your_admin_key API_URL=https://your-floq-host.example.com \
  npx tsx backend/scripts/onboardMerchant.ts backend/scripts/profiles/hotel-tamilnadu.json
```

It prints the merchant's `phone` + `PIN` to hand over. The PIN is stored only as a hash — if it's ever lost, rotate it:

```bash
curl -X POST https://your-floq-host.example.com/api/admin/reset-pin \
  -H "x-admin-key: your_admin_key" -H "Content-Type: application/json" \
  -d '{"phone":"9812345678","pin":"1234"}'
```

## 3. Build the APK

Set the backend URL the APK will call, then build:

```bash
cd apps/vendor
cp .env.example .env          # set EXPO_PUBLIC_API_URL to your HTTPS host
# EAS (recommended):
npx eas build -p android --profile preview
# or a local prebuild + Gradle release build if you have Android SDK set up.
```

`EXPO_PUBLIC_API_URL` is baked into the build — rebuild if the host changes. The package id is `in.floq.merchant`.

## 4. On the merchant's phone

1. Install the APK.
2. First launch: they enter **phone → PIN** once. The session persists (180 days), so every later cold start goes straight to the counter — no login.
3. Their catalogue, mode (food/retail), language, and UPI are already set from onboarding.

## 5. Day-to-day

- **Sell:** tap items → CHARGE → Cash or UPI QR → token. Or tap the `₹ amount` toggle for quick-charge with no catalogue.
- **Sold out:** long-press an item on the Sell grid (or use Settings → Manage items).
- **Queue** (food only): advance tokens New → Preparing → Ready (voice call-out) → Hand over.
- **Day:** today's totals, cash/UPI split, top items, and **Close the day** (open tokens carry to tomorrow).
- **Offline:** cash sales are queued locally and sync automatically when the network returns.

## Safety notes

- No demo data, no auto-seed, no debug routes — a fresh DB stays empty until you onboard.
- UPI QR only appears when the store has a UPI ID; otherwise cash-only, so no payment is ever misdirected.
- Each merchant is isolated server-side by merchant/store; a token for one store cannot read another.
