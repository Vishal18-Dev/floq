import jwt from 'jsonwebtoken';
import { JWTPayload, StaffRole } from '@floq/types';
import { config } from '../src/config';

// Seeded owner logins (src/db/seed.ts): the auth middleware rejects tokens for users that don't exist.
const SEED_OWNER: Record<string, string> = {
  merchant_sharma_01: 'user_sharma_owner',
  merchant_chaipoint_02: 'user_chaipoint_owner',
  merchant_nila_03: 'user_nila_owner',
};

export function getTestAuthHeader(merchantId = 'merchant_sharma_01', storeId = 'store_sharma_01', role: StaffRole = 'OWNER') {
  const payload: JWTPayload = {
    userId: SEED_OWNER[merchantId] || `user_${merchantId}`,
    phone: '9876543210',
    merchantId,
    storeIds: [storeId],
    role,
  };
  const token = jwt.sign(payload, config.jwtSecret);
  return {
    Authorization: `Bearer ${token}`,
    'x-store-id': storeId,
  };
}
