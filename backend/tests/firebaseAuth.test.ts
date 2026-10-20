import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { runMigrations } from '../src/db/migrate';
import { seedDatabase } from '../src/db/seed';
import { authService } from '../src/services/authService';

// The Firebase ID-token verification itself is exercised against live Google
// certs in the app; here we cover the account-matching branch it feeds into.
describe('OTP (verified-phone) login', () => {
  beforeAll(async () => {
    await runMigrations();
  });
  beforeEach(async () => {
    await seedDatabase(true);
  });

  it('returns a signed session for a known number without a PIN', async () => {
    const session = await authService.loginWithVerifiedPhone('9876543210');
    expect(session).not.toBeNull();
    expect(session!.token.length).toBeGreaterThan(20);
    expect(session!.storeIds.length).toBeGreaterThan(0);
  });

  it('returns null for an unknown number so the caller routes to onboarding', async () => {
    const session = await authService.loginWithVerifiedPhone('9000000009');
    expect(session).toBeNull();
  });
});
