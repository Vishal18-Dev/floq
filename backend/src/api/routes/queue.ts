import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { queueEngine } from '../../services/queueEngine';

const router = Router();

// GET /api/queue - Get live queue columns and delay metrics
router.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const liveQueue = await queueEngine.getLiveQueue(req.storeId!);
    res.json(liveQueue);
  } catch (err) {
    next(err);
  }
});

export default router;
