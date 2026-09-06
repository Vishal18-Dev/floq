import { Router, Response } from 'express';
import { authService } from '../../services/authService';
import { PinLoginSchema } from '@floq/validation';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { queryOne } from '../../db';

const router = Router();

// POST /api/auth/login — phone + fixed PIN
router.post('/login', async (req, res, next) => {
  try {
    const input = PinLoginSchema.parse(req.body);
    const session = await authService.login(input.phone, input.pin);
    res.json(session);
  } catch (err: any) {
    // Auth failures are 401, not 500, so the client shows a clean message.
    if (err?.name === 'ZodError') return next(err);
    res.status(401).json({ error: 'AUTH_FAILED', message: err?.message || 'Login failed' });
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
