import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isStaging = nodeEnv === 'staging';
const isDevelopment = nodeEnv === 'development';
const isTest = nodeEnv === 'test';

const DEV_JWT_SECRET = 'floq-dev-secret-key-local-only';
const DEV_ADMIN_KEY = 'floq-dev-admin-key-local-only';

// Secrets MUST be provided by the environment in production/staging. We never
// ship a usable fallback — a known secret in the binary means anyone can forge
// owner tokens or hit admin endpoints. Dev/test fall back to a local-only value.
function requireSecret(envVar: string, devFallback: string): string {
  const value = process.env[envVar];
  if (value && value.trim().length > 0) return value;
  if (isProduction || isStaging) {
    throw new Error(
      `FATAL: ${envVar} is not set. Refusing to start in ${nodeEnv} with an insecure default. ` +
        `Set ${envVar} in the environment.`
    );
  }
  return devFallback;
}

const jwtSecret = requireSecret('JWT_SECRET', DEV_JWT_SECRET);
const adminKey = requireSecret('ADMIN_KEY', DEV_ADMIN_KEY);

// Beta payments are cash + static UPI QR with manual "payment received"
// confirmation — no gateway. The manual/mock provider models exactly that.
// Set ALLOW_MOCK_PAYMENTS=false only once a real gateway is wired.
const allowMockPayments = process.env.ALLOW_MOCK_PAYMENTS === 'false' ? false : true;

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv,
  isProduction,
  isStaging,
  isDevelopment,
  isTest,
  databaseUrl: process.env.DATABASE_URL || 'postgresql://floq:floq_dev_password_2026@localhost:5432/floq_db',
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.includes(',')
      ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
      : process.env.CORS_ORIGIN
    : '*',
  jwtSecret,
  adminKey,
  allowMockPayments,
  // PIN policy (phone + fixed PIN auth). 4 digits by default; tune via env.
  pinLength: parseInt(process.env.PIN_LENGTH || '4', 10),
  pinMaxAttempts: parseInt(process.env.PIN_MAX_ATTEMPTS || '5', 10),
  pinLockoutMinutes: parseInt(process.env.PIN_LOCKOUT_MINUTES || '15', 10),
  sentryDsn: process.env.SENTRY_DSN || null,
};
