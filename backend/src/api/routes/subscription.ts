import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { subscriptionService, Plan } from '../../services/subscriptionService';

const router = Router();

// GET /api/subscription - current status (drives the paywall + banner in the app)
router.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    res.json(await subscriptionService.getStatus(req.storeId!));
  } catch (err) {
    next(err);
  }
});

// POST /api/subscription/submit - merchant reports a manual UPI payment.
// Creates a pending record for an admin to verify; does not activate on its own.
router.post('/submit', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const plan = req.body?.plan as Plan;
    if (plan !== 'monthly' && plan !== 'annual') {
      res.status(400).json({ error: 'INVALID_PLAN', message: 'plan must be "monthly" or "annual"' });
      return;
    }
    const upiReference = typeof req.body?.upiReference === 'string' ? req.body.upiReference.trim() : undefined;
    const payment = await subscriptionService.submitPayment(req.storeId!, plan, upiReference);
    res.status(201).json({ payment, message: 'Payment submitted. Activation after verification.' });
  } catch (err) {
    next(err);
  }
});

export default router;
