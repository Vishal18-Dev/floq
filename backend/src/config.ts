import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isStaging = nodeEnv === 'staging';
const isDevelopment = nodeEnv === 'development';
const isTest = nodeEnv === 'test';

const DEV_JWT_SECRET = 'floq-dev-secret-key-12345';
const jwtSecret = process.env.JWT_SECRET || DEV_JWT_SECRET;

// Production Safety Guard: Fail loudly if production uses default development secret
if (isProduction && (!process.env.JWT_SECRET || jwtSecret === DEV_JWT_SECRET)) {
  throw new Error(
    'FATAL CONFIGURATION ERROR: JWT_SECRET must be explicitly set to a strong random key in production! Application halted for safety.'
  );
}

const allowMockAuth = isDevelopment || isStaging || isTest || process.env.ALLOW_MOCK_AUTH === 'true';
const allowMockPayments = isDevelopment || isStaging || isTest || process.env.ALLOW_MOCK_PAYMENTS === 'true';

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
  allowMockAuth,
  allowMockPayments,
  sentryDsn: process.env.SENTRY_DSN || null,
};
