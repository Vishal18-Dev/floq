# Store review setup: reviewer account and signing key

Covers B5 (the reviewer can sign in) and T1/T2 (signing key and Firebase fingerprints) from `store-readiness-2026-11-24.md`. Steps that happen in a console are marked *(verify)*: menus move, so check the wording when you get there.

## 1. Reviewer account (B5)

Reviewers sign in with a **Firebase test phone number**. Firebase never sends an SMS for it; the code you choose always works. The reviewer gets a ready-made demo shop, so they never see the signup wizard or an empty app.

### 1a. Add the test number in Firebase
1. Firebase console → project **floq-cd6b5** → Authentication → Sign-in method → Phone → **Phone numbers for testing** *(verify)*.
2. Add a number and a 6-digit code, e.g. `+91 90000 12345` / `246810`. Pick a number nobody real uses: while it is listed, nobody can get a real OTP on it.
3. Save. This works in release builds too, with no SHA or Play Integrity check.

### 1b. Create the demo shop
1. In `backend/scripts/profiles/store-reviewer.json`, set `phone` to the test number **without** `+91` and `pin` to any 4–6 digits. The script requires the PIN. Reviewers never need it, because they sign in with the OTP and choose their own unlock PIN on the phone. Don't commit the filled-in file.
2. Run it against production:

   ```bash
   cd backend && ADMIN_KEY=<prod admin key> API_URL=https://<your render host> npm run merchant:onboard -- scripts/profiles/store-reviewer.json
   ```

   It prints the `storeId` (e.g. `store_floq_demo_kirana_2345`). Keep it for the next step.

### 1c. Stop the trial from expiring mid-review
Every shop starts with a 7-day trial. Play reviews can take longer, and Play re-reviews every update. Mark the demo shop as paid. Run this on the production database (Neon SQL editor), replacing the store ID:

```sql
INSERT INTO subscriptions (store_id, plan, status, trial_ends_at, current_period_end, updated_at)
VALUES ('store_floq_demo_kirana_2345', 'annual', 'active', NULL, '2027-12-31T00:00:00.000Z', '2026-11-24T00:00:00.000Z')
ON CONFLICT (store_id) DO UPDATE
  SET plan = 'annual', status = 'active', current_period_end = EXCLUDED.current_period_end, updated_at = EXCLUDED.updated_at;
```

### 1d. If a reviewer deletes the account
Play reviewers often test account deletion. If they do, the demo shop is gone. Repeat 1b and 1c before you submit the next update. The Firebase test number stays.

### 1e. Text for "App access" (Play) and the review notes (Indus)
> floq is a billing and stock app for small shops. Sign-in is by phone OTP.
> 1. Open the app and tap **I already have floq — Log in**.
> 2. Phone: **90000 12345** (India, +91). OTP: **246810**.
> 3. Choose any 4-digit PIN when asked. This is the on-device unlock PIN.
>
> You land in a demo grocery shop with stock and two credit (khata) customers. Pay with **Cash** to complete a sale. UPI is off for this demo shop because a UPI QR would point to a real bank account.
> Account deletion: Settings → Delete account.

Use your actual number and code. Also put this text into a no-cost tester note for the closed test.

## 2. Signing key (T1)

Your 3 beta merchants have an APK signed with the **EAS keystore**. Android only installs an update over an existing app when both are signed with the same key. If Play generates its own key, those merchants must uninstall, which loses offline data. **Play's app signing key must be the EAS keystore.**

1. Download the keystore and note its passwords and alias:

   ```bash
   cd apps/vendor && eas credentials -p android
   ```

   Choose the `production` profile → Keystore → **Download existing keystore**. Store the `.jks` file and passwords in your password manager, not in the repo.
2. Play Console → create the app `in.floq.merchant` → Test and release → **App integrity** → App signing → **Change app signing key / Use a different key** → "Export and upload a key from Java keystore" *(verify)*. Play gives you a PEPK tool command and an encryption key. Run it on the downloaded `.jks` and upload the output.
3. Do this **before** you upload the first AAB. Once Play has generated a key for the app, you can't switch to the old one.
4. Build and upload: `eas build -p android --profile production` then `eas submit -p android` (or upload the AAB by hand). EAS signs with the same keystore, so it also counts as the upload key.
5. **Indus:** upload an APK/AAB built by EAS from the same profile. It is already signed with the same key, and Indus doesn't re-sign *(verify)*. Merchants can then move between sideload, Indus and Play without reinstalling.

## 3. Firebase fingerprints (T2)

Phone OTP on a Play-installed app checks the app's signing certificate against Firebase.

1. Play Console → App integrity → App signing → copy the **SHA-1** and **SHA-256** of the *app signing key certificate* and of the *upload key certificate*.
2. Firebase console → Project settings → Your apps → Android `in.floq.merchant` → **Add fingerprint**. Add each one that isn't already listed.
3. If step 2 above worked, these match the EAS fingerprints Firebase probably already has. Check anyway; it takes a minute.
4. No new build is needed. Phone auth reads fingerprints from Firebase, not from `google-services.json`.

**Test on a real install from the Play internal test track:** log in with a real number (not the test one) and confirm the SMS arrives. If you see "app not authorized" or a reCAPTCHA page, a fingerprint is missing.

## Still open for Play
B1 (billing). The subscribe screen is still reachable from Settings in the Play build. The reviewer won't hit the paywall, because the demo shop is marked paid. But the screen itself is what Play's Payments policy objects to, and it must be resolved before Play production. Indus is unaffected.
