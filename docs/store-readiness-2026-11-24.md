# floq store readiness: Google Play and Indus Appstore, 24 Nov 2026

**Scope:** the vendor app (`apps/vendor`), the backend it talks to, and the legal pages (`apps/web`), checked against Google Play policy, Indus Appstore listing rules, and Indian law (DPDP Act 2023, IT Act).
**Method:** I read the code and config. Nothing was built or submitted. Items marked *(verify)* rely on store rules I couldn't check against the live consoles today.

## Verdict

| Store | Ready? | Why |
|---|---|---|
| **Google Play** | **No** | 4 policy blockers: subscription billing, account deletion, privacy policy, unused sensitive permissions. Plus the 14-day closed test that new personal accounts must run. |
| **Indus Appstore** | **No, but close** | Indus allows your own UPI billing, so the billing blocker doesn't apply. You still need the privacy policy, account deletion, the permission cleanup and the open security fixes. |

C1–C7 from the 21 Nov security audit are merged (PR #12). Most HIGH items from that audit are still open (see section 3).

---

## 1. Store-policy blockers (expect rejection)

| # | Issue | Where | Play | Indus | Fix |
|---|---|---|---|---|---|
| B1 | **Subscription is paid by manual UPI, not Play Billing.** ₹49/₹499 unlocks app features, so it's a digital service. Play's Payments policy requires Google Play Billing for that. In India the alternative is User Choice Billing with an approved gateway (Razorpay, for example), which still carries a Google service fee. A manual-UPI paywall is grounds for rejection or later removal. | `SubscribeScreen.tsx` | Blocker | OK (Indus permits third-party billing) | Pick one: (a) Play Billing in the Play build; (b) enrol in User Choice Billing; (c) ship the Play build with no paywall at all (free, or paid via your website with no in-app link to it). Keep manual UPI for the Indus and sideloaded builds. |
| B2 | **No account deletion.** Play requires an in-app "delete account" option and a web URL where users can ask for deletion, if the app lets them create an account. DPDP gives users the same right. | backend + Settings | Blocker | Expected | Add `DELETE /api/me` (owner deletes the shop and its data; staff deletes only themself), a Settings button with a confirmation step, and a `floqapp.in/delete-account` page. |
| B3 | **The privacy policy is still a draft.** Placeholders remain: `[LEGAL ENTITY NAME]`, `[REGISTERED ADDRESS]`, grievance officer `[NAME]`, `[DATE]`. The terms page still has `[CONFIRM GST TREATMENT]` and `[CITY]`. The app doesn't link to either page. | `apps/web/privacy`, `apps/web/terms`, `SettingsScreen.tsx` | Blocker | Blocker | Fill in the placeholders, have a lawyer review it, deploy it, and link both pages from Settings and the signup screen. The listing needs a live URL. |
| B4 | **Sensitive permissions the app never uses.** The `expo-image-picker` plugin adds `CAMERA`, `RECORD_AUDIO` and storage permissions to the APK, but nothing in `src/` calls ImagePicker. Product-photo upload isn't wired up. Play reviews microphone and media permissions closely, and any you request must be justified in the Data safety form. | `app.config.js` | Blocker (likely) | Risk | Remove the plugin and the dependency until photo upload is built. When it is, use the system photo picker and pass `microphonePermission: false`. This needs a new native build. |
| B5 | **Reviewers can't sign in.** Login is phone + OTP + PIN, and both stores need working credentials in "App access". | Firebase | Blocker | Blocker | Add a Firebase **test phone number** with a fixed OTP, seed a demo shop for it, and put the number, OTP and PIN in the review notes. |

## 2. Technical gotchas specific to store builds

| # | Issue | Fix |
|---|---|---|
| T1 | **Signing key vs the merchants already on the sideloaded APK.** Their APK is signed with the EAS keystore. If Play App Signing generates a new key, those merchants can't update to the Play version without uninstalling, and they lose local data. | When you create the app in Play Console, choose **"Use existing app signing key"** and upload the EAS keystore (`eas credentials` → download). Sign the Indus build with the same key. |
| T2 | **Firebase phone auth will break on Play installs** unless Firebase knows the Play app-signing SHA-256. Play Integrity and reCAPTCHA checks fail without it. | Add the SHA-1 and SHA-256 from Play Console → App integrity to Firebase project `floq-cd6b5`, then download a fresh `google-services.json`. |
| T3 | **Render deploys from `redesign/floq-beta`, not `main`.** `render.yaml` line 14 says so. Production may be running code without the C1–C7 fixes. | Check the branch in the Render dashboard, switch it to `main`, and redeploy. |
| T4 | **Cold starts.** The keep-warm workflow suggests a plan that sleeps. A reviewer who waits 30–60 seconds at the OTP step marks the app "broken". | Use a paid Render instance (no sleep) during review and after launch. |
| T5 | **`allowBackup` is on by default.** Cached orders and credit-customer phone numbers end up in Google device backups. | Set `"android": { "allowBackup": false }`. This needs a new native build. |
| T6 | **No crash reporting.** `SENTRY_DSN` is read but Sentry is never set up. After launch, Play Vitals is all you'll have. | Add `@sentry/react-native` to the app and Sentry to the backend. The Data safety form then has to declare crash logs. |
| T7 | **Target SDK and 16 KB pages.** Expo 54 and RN 0.81 target API 36 and support 16 KB page sizes, so these should pass. | Check that Play's pre-launch report shows no 16 KB warning on the first AAB. |
| T8 | **OTA updates (EAS Update).** Play allows JavaScript-only updates, as long as they don't change what the app does or slip past review. | Don't ship policy-relevant changes, such as payment flows, over the air. Ship those as a new build. |

Already fine: the package ID `in.floq.merchant`, the AAB production profile, the 1024×1024 icon, the adaptive and monochrome icons, HTTPS-only API in production, no secrets committed, PINs hashed, the session token in SecureStore, and biometric unlock kept on the device.

## 3. Open security findings from the 21 Nov audit (fix before public listing)

| # | Status | Evidence |
|---|---|---|
| H5 Demo UPI fallback | **Open, and it touches real money.** A shop with no UPI ID set shows a QR that pays a stranger's account (`sharma.stall@okhdfcbank`). The subscription UPI ID falls back to a **personal VPA** hard-coded in source. | `paymentEngine.ts:38`, `config.ts:71` |
| H1 Removed users keep access | Open. The middleware never re-checks `users.status`, there's no token revocation, and there's no way to remove a team member. | `middleware/auth.ts` |
| H2 Tokens in URLs | Open. | `auth.ts:21` (`?token=`), `admin.ts:13` (`?key=`) |
| H3 500 errors leak internals | Open. A 500 returns the raw `err.message`. | `errorHandler.ts:52` |
| H4 Input limits | Open. Only 5 `.max()` calls; sync takes `order: z.any()` and skips the paywall check; `?limit=` is uncapped. | `validation/src/index.ts:218`, `orders.ts:13` |
| H7 UTC business date | Partly open. Analytics still uses UTC dates. | `analytics.ts:23,70` |
| M7 Database TLS not verified | Open. | `db/index.ts:31` |
| Mock payments default on | Open. `ALLOW_MOCK_PAYMENTS` defaults to true. | `config.ts:35` |
| C1–C7, `trust proxy`, `x-powered-by`, CORS, rate limits | Fixed. | PR #12, `server.ts:31-35` |

H5 is a blocker on its own: a merchant's customer could pay a stranger. The rest are what a store reviewer or a curious user would find first.

## 4. Compliance and regulatory (India)

| Area | Status | Action |
|---|---|---|
| **DPDP Act 2023 + DPDP Rules 2025** | Partly there. The draft policy covers rights and the grievance route. Most Rules obligations take effect in phases through 2027 *(verify dates)*. | Show a consent notice at signup (a checkbox and a link to the policy, which is the minimum). Name a grievance officer. Write a one-page breach-response process. Deliver deletion (B2). For merchants' customers, floq is the processor and the merchant is the fiduciary; the terms should say so plainly. |
| **IT Act s.43A / SPDI Rules 2011** | Needs the published policy and grievance officer (B3). | Covered by B3. |
| **RBI / payment aggregator rules** | Fine as built. Customer money goes straight to the merchant's UPI ID and floq never holds funds. The webhook was removed (C1). | Keep it that way. If you ever collect money on a merchant's behalf, you'll need a licensed payment aggregator. |
| **Subscription revenue: legal entity and GST** | Not ready. Payments go to a personal VPA, and the legal entity is a placeholder in both legal pages. Play's merchant profile and Indus payouts need a real entity and bank details. | Decide sole proprietorship vs Pvt Ltd, collect into a business account, register for GST if you cross the threshold or want to issue B2B invoices, and resolve `[CONFIRM GST TREATMENT]`. |
| **Cross-border transfer** | Data sits on Render (Singapore) and Cloudinary; the policy discloses this. | Allowed under DPDP unless a country is blacklisted. Keep the disclosure. |
| **NPCI / UPI branding** | Low risk. | If the UPI logo is shown, follow NPCI's brand guidelines. |

## 5. Console paperwork (no code, but required)

**Google Play**
- **Developer account:** a new personal account must run a closed test with ≥12 testers for 14 days before it can apply for production *(verify current numbers)*. An organisation account (needs a D-U-N-S number) skips this. Your 3 beta merchants plus their staff and family can be the testers.
- **Data safety form.** Declare:
  - phone number and name (account management);
  - financial info: UPI ID and purchase history (app functionality);
  - **contacts entered by merchants**: customer names and phone numbers;
  - crash logs, if Sentry is added.

  Also state that data is encrypted in transit and that users can ask for deletion.
- **Financial features declaration:** say floq is a business tool with no lending, payments processing or wallet. The "dues" ledger is bookkeeping, not credit.
- **Other questionnaires:** content rating (IARC); target audience 18+; ads: none.
- **Listing:** 512×512 icon, 1024×500 feature graphic, ≥2 phone screenshots (`apps/web/assets/*.webp` can be the base), short and full description, and a Hindi listing to match the Hinglish site.

**Indus Appstore** *(verify in the Indus Developer Platform)*
- Developer registration and KYC, an APK or AAB, privacy policy URL, screenshots, and regional-language listings (Indus pushes these; Hindi and Tamil fit your market).
- Third-party billing is allowed, so the current manual-UPI subscription can stay in the Indus build.

## 6. Suggested order

1. **Days 1–2:** fix H5 (demo/personal UPI), T3 (Render branch), and B4, T5 (remove the image-picker plugin, set `allowBackup=false`) in **one native build**.
2. **Days 2–4:** B2 account deletion (backend, app and web page) and B3 legal pages: fill, review, deploy, link in-app.
3. **Days 3–5:** H1–H4, M7 and mock payments off. Add Sentry.
4. **Day 5:** B5 reviewer account. T1 and T2 signing-key setup in Play Console and Firebase.
5. **Submit to Indus first.** It has no billing change and a lighter review, so it's a fast first public listing.
6. **Play:** decide B1 (Play Billing, User Choice Billing, or no paywall in the Play build), start the 14-day closed test right away in parallel, then move to production.

Native rebuild needed for: B4, T5, T6 (Sentry), and B1 if you choose Play Billing. Everything else is backend or JavaScript (OTA).
