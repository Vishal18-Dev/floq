import express from 'express';
import cors from 'cors';
import * as Sentry from '@sentry/node';
import { config } from './config';
import { authMiddleware } from './api/middleware/auth';
import { errorHandler } from './api/middleware/errorHandler';
import { realtimeService } from './services/realtimeService';
import { authService } from './services/authService';
import { runMigrations } from './db/migrate';
import { queryOne } from './db';
import { createLimits } from './api/middleware/rateLimit';

import authRouter from './api/routes/auth';
import storesRouter from './api/routes/stores';
import productsRouter from './api/routes/products';
import ordersRouter from './api/routes/orders';
import paymentsRouter from './api/routes/payments';
import queueRouter from './api/routes/queue';
import analyticsRouter from './api/routes/analytics';
import syncRouter from './api/routes/sync';
import publicRouter from './api/routes/public';
import adminRouter from './api/routes/admin';
import signupRouter from './api/routes/signup';
import subscriptionRouter from './api/routes/subscription';
import retailRouter from './api/routes/retail';
import teamRouter from './api/routes/team';
import invitesRouter from './api/routes/invites';

export function createServer() {
  const app = express();
  // Render terminates TLS at one proxy hop; this makes req.ip the real client IP.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  const limits = createLimits();

  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'floq-backend',
      timestamp: new Date().toISOString(),
    });
  });

  // NOTE: There is deliberately NO auto-seed, /api/seed, or /api/debug route.
  // Seeding wipes tables and demo data must never touch a production database;
  // real merchants are provisioned via POST /api/admin/onboard-merchant.

  // Public auth routes (Unauthenticated)
  app.use('/api/auth/login', limits.loginIp, limits.loginPhone);
  app.use('/api/auth/firebase', limits.otpLogin);
  app.use('/api/auth', authRouter);

  // Realtime Server-Sent Events (SSE) stream (Authenticated via query token or Bearer header)
  app.get('/api/realtime', async (req, res) => {
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token as string;
    let token = queryToken;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Realtime SSE requires authentication token' });
      return;
    }

    let payload;
    try {
      payload = authService.verifyToken(token);
    } catch {
      res.status(401).json({ error: 'INVALID_TOKEN', message: 'Realtime token verification failed' });
      return;
    }

    try {
      const storeId = (req.query.storeId as string) || (payload.storeIds && payload.storeIds[0]);

      if (!storeId) {
        res.status(400).json({ error: 'STORE_REQUIRED', message: 'storeId is required for realtime stream' });
        return;
      }

      // Same tenant check as authMiddleware: the stream is only for the caller's own store.
      const store = await queryOne('SELECT merchant_id FROM stores WHERE id = $1', [storeId]);
      if (!store || store.merchant_id !== payload.merchantId) {
        res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized for this store' });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      realtimeService.subscribe(storeId, res);
    } catch (err) {
      console.error('[FLOQ realtime]:', err);
      if (!res.headersSent) res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Could not open realtime stream' });
    }
  });

  // Public customer & admin routes
  app.use('/api/public', limits.publicApi, publicRouter);
  app.use('/api/admin', limits.admin, adminRouter);
  app.use('/api/signup', limits.signup, signupRouter);
  // Invite lookup + accept is public: the invitee has no session yet, and the
  // accept is gated by an OTP on the invited number.
  app.use('/api/invites', limits.invites, invitesRouter);

  // Authenticated Merchant API Routes (with Data Isolation Middleware)
  app.use('/api/stores', authMiddleware, storesRouter);
  app.use('/api/products', authMiddleware, productsRouter);
  app.use('/api/orders', authMiddleware, ordersRouter);
  app.use('/api/payments', authMiddleware, paymentsRouter);
  app.use('/api/queue', authMiddleware, queueRouter);
  app.use('/api/analytics', authMiddleware, analyticsRouter);
  app.use('/api/subscription', authMiddleware, subscriptionRouter);
  app.use('/api/sync', authMiddleware, syncRouter);
  app.use('/api/retail', authMiddleware, retailRouter);
  app.use('/api/team', authMiddleware, teamRouter);

  // Central Error Handler
  app.use(errorHandler);

  return app;
}

if (require.main === module) {
  // Error reports only, no tracing.
  // Collect nothing personal: request bodies, headers, query values, DB params and
  // local variables would carry customer phone numbers and khata amounts.
  if (config.sentryDsn) {
    Sentry.init({
      dsn: config.sentryDsn,
      environment: config.nodeEnv,
      tracesSampleRate: 0,
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
        databaseQueryData: false,
        stackFrameVariables: false,
      },
    });
  }
  // Run schema migrations on boot, then start. Never seed automatically —
  // migrations are additive and safe; seeding is destructive and manual.
  runMigrations()
    .then(() => {
      const app = createServer();
      app.listen(config.port, '0.0.0.0', () => {
        console.log(`🚀 FLOQ Backend Server running on 0.0.0.0:${config.port} (${config.nodeEnv})`);
      });
    })
    .catch((err) => {
      console.error('❌ FATAL: migrations failed on boot, refusing to start:', err);
      process.exit(1);
    });
}
