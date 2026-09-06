/**
 * White-glove merchant onboarding CLI.
 *
 * Reads a merchant profile JSON and POSTs it to the onboarding endpoint using
 * the admin key. Works against a local or a deployed backend — this is the tool
 * you run to stand up each of the 3 beta merchants.
 *
 * Usage:
 *   ADMIN_KEY=... API_URL=https://your-host tsx scripts/onboardMerchant.ts scripts/profiles/hotel-tamilnadu.json
 *   # or against localhost:
 *   ADMIN_KEY=... tsx scripts/onboardMerchant.ts scripts/profiles/tea-shop.json
 *
 * Env:
 *   API_URL     Backend base URL (default http://localhost:4000)
 *   ADMIN_KEY   Admin key (must match the server's ADMIN_KEY)
 */

import fs from 'fs';
import path from 'path';

async function main() {
  const profilePath = process.argv[2];
  if (!profilePath) {
    console.error('Usage: tsx scripts/onboardMerchant.ts <profile.json>');
    process.exit(1);
  }

  const apiUrl = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    console.error('ERROR: ADMIN_KEY env var is required (must match the server ADMIN_KEY).');
    process.exit(1);
  }

  const raw = fs.readFileSync(path.resolve(profilePath), 'utf8');
  const profile = JSON.parse(raw);

  if (!profile.pin) {
    console.error('ERROR: profile is missing a "pin" (4-6 digits). Set the PIN you will give this merchant.');
    process.exit(1);
  }

  console.log(`\n→ Onboarding "${profile.merchantName}" (${profile.storeName}) in ${profile.mode || 'FOOD'} mode`);
  console.log(`  API: ${apiUrl}`);

  const res = await fetch(`${apiUrl}/api/admin/onboard-merchant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
    body: JSON.stringify(profile),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`\n✗ Onboarding failed (${res.status}):`, body.message || body.error || body);
    process.exit(1);
  }

  if (body.alreadyExisted) {
    console.log(`\nℹ️  Already onboarded. Merchant ${body.merchantId}. To change the PIN, use /api/admin/reset-pin.`);
  } else {
    console.log(`\n✓ Onboarded successfully`);
    console.log(`  merchantId : ${body.merchantId}`);
    console.log(`  storeId    : ${body.storeId}`);
    console.log(`  mode       : ${body.mode}`);
    console.log(`  language   : ${body.secondaryLanguage}`);
    console.log(`  items      : ${body.itemsCreated}`);
    console.log(`\n  Merchant logs in with:`);
    console.log(`    phone : ${body.phone}`);
    console.log(`    PIN   : ${profile.pin}  (give this to the merchant; it is not stored in plain text)`);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
