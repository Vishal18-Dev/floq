# FLOQ Merchant — Controlled Beta Onboarding Checklist

This checklist guides field onboarding engineers and merchant owners during initial setup.

---

## Step-by-Step Onboarding Checklist

- [ ] **Step 1: Install FLOQ Merchant App**
  - Download and install the FLOQ Merchant APK v1.0.0 on the merchant's counter Android tablet/phone.
- [ ] **Step 2: Authenticate via Mobile OTP**
  - Enter the merchant owner's registered 10-digit mobile number (+91).
  - Enter the 6-digit SMS verification code to establish an authenticated session stored in Expo SecureStore.
- [ ] **Step 3: Store Onboarding & Preset Setup**
  - Verify store name, UPI VPA ID (e.g. `merchant@okhdfcbank`), address, and typical preparation time (default 6 mins).
  - Apply template preset if applicable (e.g., *Sharma Breakfast Corner* or *Chai Point Express*).
- [ ] **Step 4: Product Catalog Verification**
  - Review category list (Beverages, Hot Breakfast, Snacks).
  - Add or update merchant menu items with price in INR (₹).
- [ ] **Step 5: Run Test Cash Sale**
  - Select items on the SELL tab, tap **Charge Cash**, and verify ticket generation (e.g. `#101`).
- [ ] **Step 6: Verify Live Queue & Status Transitions**
  - Check the QUEUE tab to verify the new ticket appears under **In Preparation**.
  - Advance status to **READY** and verify the ticket updates.
- [ ] **Step 7: Verify Audio / Voice TTS Announcements**
  - Ensure counter speaker volume is turned up.
  - Verify voice announcement triggers: *"Token 101 is ready for pickup"*.
- [ ] **Step 8: Verify Offline Connectivity & Sync**
  - Enable Airplane mode on the Android device.
  - Complete a test cash sale offline. Verify local ticket `#OFF-xxx` displays on device.
  - Re-enable Wi-Fi/Cellular connection. Verify auto-sync uploads the order safely with zero ticket collisions.
- [ ] **Step 9: Launch Live Merchant Counter Operation**
  - Hand over device to counter operator for live customer ordering.
