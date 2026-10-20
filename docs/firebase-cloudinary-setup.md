# Firebase + Cloudinary setup (Phases 1 & 2)

These are the two external accounts needed before building OTP auth (Phase 1)
and the onboarding wizard with store photos (Phase 2). Both have free tiers that
cover the beta. Do each step, then hand back the values marked **→ give to dev**.

Firebase Phone Auth is a **native module**, so wiring it produces a **new APK**
(OTA still works for JS after that). Cloudinary is pure JS → ships over OTA.

---

## A. Firebase (Phone OTP)

### 1. Create the project
- Go to <https://console.firebase.google.com> → **Add project**.
- Name it `FLOQ` (or `floq-merchant`). Google Analytics: **off** is fine (simpler).
- Create.

### 2. Enable Phone sign-in
- Left nav → **Build → Authentication → Get started**.
- **Sign-in method** tab → **Phone** → **Enable** → **Save**.
- Optional but recommended: under Phone → **Phone numbers for testing**, add a
  test number + fixed code (e.g. `+91 90000 00000` → `123456`). Lets us test the
  flow without spending real SMS. **→ give to dev** (the test number + code).

### 3. Enable Blaze billing
- Phone Auth needs the **Blaze (pay-as-you-go)** plan beyond a tiny free quota.
- Bottom-left **Upgrade** / ⚙ → **Usage and billing → Details & settings →
  Modify plan → Blaze** → link a billing account (needs a card).
- Set a **budget alert** (Usage and billing → Budget) at e.g. ₹500 so there are
  no surprises. India SMS is a few paise–rupees per verification after the free
  allotment; trivial at beta volume.

### 4. Register the Android app
- ⚙ **Project settings → General → Your apps → Add app → Android**.
- **Android package name:** `in.floq.merchant` (must match exactly — do not change).
- App nickname: `FLOQ Merchant` (optional).
- **Debug/signing SHA-1:** Phone Auth requires the app's signing SHA-1.
  EAS holds our keystore — the dev will fetch the SHA-1 (`eas credentials`, or
  expo.dev → project → Credentials → Android) and give it to you to paste here.
  Add **both SHA-1 and SHA-256** when you have them.
- **Download `google-services.json`.** **→ give to dev** (this file).

### What to hand back (Firebase)
1. `google-services.json`
2. Confirmation the package is `in.floq.merchant`
3. (Optional) the test phone number + fixed code from step 2
4. Confirm Blaze is enabled + a budget alert is set

The dev will add the SHA-1 to the Firebase app (or give it to you to paste),
place `google-services.json`, add the `@react-native-firebase` config plugin,
and cut a new APK.

---

## B. Cloudinary (store photos)

### 1. Create the account
- <https://cloudinary.com/users/register_free> → sign up (free tier is plenty).

### 2. Note the Cloud name
- Dashboard → **Account Details / Product Environment** → **Cloud name**
  (a short slug like `dxxxx`). **→ give to dev.**

### 3. Create an unsigned upload preset
- ⚙ **Settings → Upload → Upload presets → Add upload preset**.
- **Signing Mode: Unsigned** (lets the app upload directly without exposing a
  secret — the app only needs the cloud name + preset name, neither is secret).
- **Preset name:** `floq_store_photos`. **→ give to dev.**
- **Folder:** `floq/stores` (keeps uploads tidy).
- Recommended guards (abuse/storage): restrict **allowed formats** to
  `jpg,png,webp`; add an **incoming transformation** to cap size
  (e.g. width/height limit 1600, quality `auto`); set **max file size** ~5 MB.
- **Save.**

### What to hand back (Cloudinary)
1. **Cloud name**
2. **Upload preset name** (`floq_store_photos`)

That's all the app needs — the API secret stays on your Cloudinary account and
is never shipped in the app.

---

## Summary — the handoff list

| From Firebase | From Cloudinary |
|---|---|
| `google-services.json` | Cloud name |
| package = `in.floq.merchant` (confirm) | Upload preset name |
| Blaze enabled + budget alert | |
| (optional) test number + code | |

Once these land, the dev builds Phase 1 (OTP login/signup) and Phase 2
(onboarding wizard + photo upload), then ships one new APK.
