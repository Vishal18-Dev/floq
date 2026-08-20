import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { analyticsService } from '../../services/analyticsService';

const router = Router();

// GET /api/analytics/daily - Get daily sales summary
router.get('/daily', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const dateStr = req.query.date as string | undefined;
    const summary = await analyticsService.getDailySummary(req.storeId!, dateStr);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

export default router;
