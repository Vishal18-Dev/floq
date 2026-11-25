# Launching floq on PhonePe Appstore (formerly Indus Appstore)

PhonePe renamed Indus Appstore to **PhonePe Appstore** on 28 Oct 2026. The developer console moved to `developer.phonepeappstore.com` (the old `developer.indusappstore.com` links redirect there). Facts below were checked against the official developer docs on 25 Nov 2026.

## What the store needs

| Item | Requirement (official docs) | floq status |
|---|---|---|
| Developer account | Free registration with email; free for the first year, then a "nominal annual fee" | Vishal creates it |
| Verification (KYC) | Mobile number. **Individual:** personal details, PAN, date of birth (more ID or address checks may apply). **Organisation:** GSTIN, PAN, CIN or LLP details. GSTIN is not always required | Vishal, as an individual (the legal pages name an individual operator) |
| Build | APK, AAB or APKS. **AAB needs the signing keystore uploaded with every release** (PhonePe doesn't keep it) | Use an **APK** from the new `phonepe` EAS profile, so the keystore never leaves you |
| Signing | Properly signed release build; keep the key for every update | Same EAS keystore as the beta APK and Play, so beta merchants can update in place |
| Title, type, category, age group | Required | Apps → **Business**, age group **18+** |
| Icon | 512 × 512 PNG (32-bit), ≤ 1024 KB, no rounded corners or masks | `store/phonepe-appstore/icon-512.png` |
| Screenshots | 2–8, PNG or JPEG, ≤ 8 MB each, must show the **real current app** | **Still needed:** take them on a phone from the demo shop (see below) |
| Feature graphic | 1024 × 500 PNG/JPEG, ≤ 5 MB (promotional placements) | `store/phonepe-appstore/feature-graphic-1024x500.png` |
| Short description | Up to **200** characters | Below |
| Long description | Up to 4,000 characters | Below |
| Languages | Auto-translates the listing into 12 Indian languages; you review and edit each one | Paste our Hindi text over the auto-translation; check Tamil and Marathi with a native speaker |
| Privacy policy | Mandatory, must be reachable | `https://floqapp.in/privacy/` (switch to `getfloq.in` once that domain is attached to the Worker) |
| Support | Support email and contact details | `hello@getfloq.in`. Confirm it receives mail first |
| Reviewer login | Test credentials if sign-in is needed | Text in `docs/store-review-setup.md` §1e |
| Billing | Zero commission; any third-party payment method is allowed | The in-app UPI subscription stays in this build |
| Review time | Usually 24–72 hours; blocked until KYC is done | |

## Build

```bash
cd apps/vendor
eas build -p android --profile phonepe   # signed release APK, update channel "production"
```

The `phonepe` profile is `production` with an APK instead of an AAB. It uses the `production` update channel, so it has the full in-app subscription (`IS_PLAY_BUILD` is false) and gets the same OTA updates as before:

```bash
eas update --channel production --message "..."
```

Before each new store upload, bump `android.versionCode` in `app.json`. The store refuses a version code it has already seen, and Android refuses to update to a lower one.

## Screenshots (Vishal, on a phone)

Sign in with the reviewer demo shop (`docs/store-review-setup.md` §1), never a real merchant's shop. Take 4–6 portrait screenshots with the phone's own screenshot button:

1. Counter bill with a few items added
2. Stock list showing a low-stock item
3. Khata: a customer with dues and the WhatsApp reminder button
4. Day summary
5. The same billing screen in Hindi
6. Token queue (food mode), if the demo shop has it on

Don't use the landing-page images in `apps/web/assets/`. They come from the design mock-ups, which don't match the shipped app's colours, and the store rejects screenshots that don't show the real app.

## Listing text

**App title**
```
floq: Billing, Stock & Khata
```

**Short description** (166 of 200 characters)
```
Fast billing, stock and khata (credit book) for kirana shops, tea stalls and food counters. UPI QR, WhatsApp reminders, works offline. English, Hindi, Tamil, Marathi.
```

**Short description, Hindi**
```
किराना दुकान, चाय की टपरी और खाने के काउंटर के लिए तेज़ बिलिंग, स्टॉक और खाता (उधार)। UPI QR, WhatsApp पर याद दिलाना, बिना इंटरनेट भी चलता है।
```

**Long description:** the English and Hindi full descriptions in `docs/store-listing.md` §3, plus the pricing line from §4 at the end. PhonePe allows the price and the in-app UPI payment to be mentioned.

**App website:** `https://floqapp.in` (later `https://getfloq.in`).

## Steps only Vishal can do

1. **Register** at `developer.phonepeappstore.com` → Register Free, and verify the email.
2. **Verify identity:** Manage Profile → Start Verification, with mobile number, PAN and date of birth. Do this first; review can't finish without it.
3. **Confirm `hello@getfloq.in` receives mail** (Cloudflare Email Routing), because it's the support address on the listing. If getfloq.in isn't set up yet, use an address that works today.
4. **Reviewer account:** add the Firebase test number and seed the demo shop (`docs/store-review-setup.md` §1a–1c), if not done already.
5. **Build:** `eas build -p android --profile phonepe` and download the APK. Install it on your own phone over the beta APK once, to check it updates in place and signs in.
6. **Screenshots:** take them as listed above.
7. **Create the listing:** List New App → Upload File Directly. Fill in the details from this page, upload the icon, screenshots, feature graphic and APK, paste the reviewer text into the testing credentials field, and review the auto-translations.
8. **Submit**, then send the listing link so the landing page buttons can point to it.

## Landing page badge

The site now says "PhonePe Appstore" instead of "Indus Appstore". PhonePe's developer docs don't publish an official "Get it on" badge yet, so the site keeps its own text button. Once the app is live, replace `href="#get"` on that button with the listing link (search for `aria-label="Get it on PhonePe Appstore"` in `apps/web/index.html` and `apps/web/hi/index.html`).
