import { Router, Response } from 'express';
import { authService } from '../../services/authService';
import { AuthLoginSchema, OTPVerifySchema } from '@floq/validation';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { queryOne } from '../../db';

const router = Router();

// POST /api/auth/otp/request
router.post('/otp/request', async (req, res, next) => {
  try {
    const input = AuthLoginSchema.parse(req.body);
    const result = await authService.requestOTP(input.phone);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/otp/verify
router.post('/otp/verify', async (req, res, next) => {
  try {
    const input = OTPVerifySchema.parse(req.body);
    const session = await authService.verifyOTP(input.phone, input.otp);
    res.json(session);
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me (Authenticated)
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const user = await queryOne('SELECT id, phone, name, role, merchant_id, store_ids_json FROM users WHERE id = $1', [req.userId]);
    if (!user) {
      res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User profile not found' });
      return;
    }

    const storeIds = typeof user.store_ids_json === 'string' ? JSON.parse(user.store_ids_json) : (user.store_ids_json || []);
    res.json({
      userId: user.id,
      phone: user.phone,
      name: user.name,
      merchantId: user.merchant_id,
      storeIds,
      role: user.role,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
