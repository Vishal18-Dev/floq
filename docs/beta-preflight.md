# FLOQ Beta Pre-Flight Checklist

One page. Tick each box on deploy day and first-device day. Nothing here is code — it's the ops gap between "app is ready" and "3 real merchants are selling on it."

## 1. Deploy the backend (Render)
- [ ] Create the service from `render.yaml` (Dashboard → New → Blueprint → this repo).
- [ ] Set **`ADMIN_KEY`** in the dashboard to a long random value you keep safe (you need it for onboarding). `JWT_SECRET` is auto-generated.
- [ ] Confirm the Postgres DB is a **paid plan** (free expires in 90 days) and the web service is **`starter` (always-on)** — not free.
- [ ] First deploy succeeds. Check logs for **`✅ Applied migration: 002_beta_redesign.sql`** (it ALTERs live tables — watch it apply cleanly).
- [ ] `curl https://floq.onrender.com/api/health` → `{"status":"ok",...}`.
- [ ] Sanity: a wrong-PIN login returns 401, an unregistered phone returns 401 (no auto-provisioning).

## 2. Reliability (before any merchant relies on it)
- [ ] Confirm always-on: hit `/api/health` after 10 idle minutes — response is **instant**, no cold-start delay.
- [ ] Add uptime monitoring with an alert to your phone (UptimeRobot/BetterStack free tier hitting `/api/health`).
- [ ] Trigger one manual DB backup and confirm it exists; note how to restore.
- [ ] (Optional) Set `SENTRY_DSN` for crash visibility once you're not standing there.

## 3. Onboard the 3 merchants
- [ ] Fill each profile in `backend/scripts/profiles/` — real **phone**, the **PIN** you'll hand over, **UPI ID**, and confirm the **menu/prices** with the merchant.
- [ ] Run for each: `ADMIN_KEY=... API_URL=https://floq.onrender.com npx tsx backend/scripts/onboardMerchant.ts backend/scripts/profiles/<file>.json`
- [ ] Verify each merchant's mode is right (tea shop + Hotel TamilNadu = FOOD; Keramruth = RETAIL) and language (Tamil / Hindi).
- [ ] Record each merchant's phone + PIN somewhere safe to hand over.

## 4. Build the APK
- [ ] `cd apps/vendor && npx eas login` (your Expo account).
- [ ] `npx eas build -p android --profile preview` → download the `.apk`.
- [ ] Confirm the build used `EXPO_PUBLIC_API_URL=https://floq.onrender.com` (it's baked from `eas.json`).

## 5. On-device smoke test (a real cheap Android — the untested path)
- [ ] Install the APK; grant install-from-unknown-sources.
- [ ] PIN login with a test/real merchant → lands on the counter (no login on 2nd cold start).
- [ ] One **cash** sale → token prints, appears in Queue (food) / completes (retail).
- [ ] One **UPI** sale → QR scans from *another* phone, amount pre-fills, "payment received" → token.
- [ ] **Airplane mode** → make a cash sale → shows OFFLINE + pending count → reconnect → it syncs (no duplicate).
- [ ] Advance a food order New → Preparing → Ready → confirm the **voice call-out** fires; Hand over → Day totals update.
- [ ] Long-press an item → **Sold out** toggles; Day → **Close the day** works.
- [ ] Kill and reopen the app mid-session → state restored, still logged in.

## 6. Go / no-go
- [ ] All of §5 passes on the actual device model the merchants use.
- [ ] You've written down the **kill criteria** (see the strategy brief) and the **retention/coverage** you'll measure.
- [ ] You can reach the backend logs and restart it from your phone if it falls over during a rush.

If every box is ticked, you're clear to put it on a real counter.
