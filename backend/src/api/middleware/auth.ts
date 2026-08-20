import { Request, Response, NextFunction } from 'express';
import { authService } from '../../services/authService';
import { queryOne } from '../../db';
import { StaffRole } from '@floq/types';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  merchantId?: string;
  storeId?: string;
  userRole?: StaffRole;
}

/**
 * Strict Auth & Multi-Tenant Authorization Middleware (P0-1 Fix)
 * Derives merchant/user identity from verified JWT token.
 * NO SILENT DEFAULT FALLBACKS.
 */
export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  // Allow public endpoints & webhooks to pass through without JWT check
  if (req.path === '/webhook' || req.path === '/api/payments/webhook') {
    return next();
  }
  // Extract Authorization header or query token
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token as string;
  let token: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (queryToken) {
    token = queryToken;
  }

  if (!token) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication credential required. Please provide Authorization: Bearer <token>.',
    });
    return;
  }

  try {
    const payload = authService.verifyToken(token);

    const storeIdHeader = (req.headers['x-store-id'] as string) || (req.query.storeId as string) || (req.body?.storeId as string);
    const requestedStoreId = storeIdHeader || (payload.storeIds && payload.storeIds[0]);

    if (!requestedStoreId) {
      res.status(400).json({
        error: 'STORE_CONTEXT_REQUIRED',
        message: 'No active store context specified for request.',
      });
      return;
    }

    // Verify store exists and belongs to token's merchant
    const store = await queryOne('SELECT id, merchant_id FROM stores WHERE id = $1', [requestedStoreId]);

    if (!store) {
      res.status(404).json({
        error: 'STORE_NOT_FOUND',
        message: `Store ${requestedStoreId} was not found.`,
      });
      return;
    }

    // Strictly enforce merchant boundaries
    if (store.merchant_id !== payload.merchantId) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: `Access denied: Merchant ${payload.merchantId} is not authorized to access store ${requestedStoreId}.`,
      });
      return;
    }

    req.userId = payload.userId;
    req.merchantId = payload.merchantId;
    req.storeId = requestedStoreId;
    req.userRole = payload.role;
    next();
  } catch (err: any) {
    res.status(401).json({
      error: 'INVALID_TOKEN',
      message: err.message || 'Authentication failed',
    });
  }
}

/**
 * Role-Based Authorization Guard
 */
export function requireRole(...allowedRoles: StaffRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      res.status(403).json({
        error: 'FORBIDDEN_ROLE',
        message: `Insufficient permissions. Required role: [${allowedRoles.join(', ')}]`,
      });
      return;
    }
    next();
  };
}
