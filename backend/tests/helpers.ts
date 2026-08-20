import jwt from 'jsonwebtoken';
import { JWTPayload, StaffRole } from '@floq/types';
import { config } from '../src/config';

export function getTestAuthHeader(merchantId = 'merchant_sharma_01', storeId = 'store_sharma_01', role: StaffRole = 'OWNER') {
  const payload: JWTPayload = {
    userId: `user_${merchantId}`,
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
