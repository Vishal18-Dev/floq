import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isStaging = nodeEnv === 'staging';
const isDevelopment = nodeEnv === 'development';
const isTest = nodeEnv === 'test';

const DEV_JWT_SECRET = 'floq-dev-secret-key-12345';
const jwtSecret = process.env.JWT_SECRET || 'floq-prod-jwt-secret-key-2026-pune-mumbai';

const allowMockAuth = process.env.ALLOW_MOCK_AUTH === 'false' ? false : true;
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
  allowMockAuth,
  allowMockPayments,
  sentryDsn: process.env.SENTRY_DSN || null,
};
