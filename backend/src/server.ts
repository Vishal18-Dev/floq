import express from 'express';
import cors from 'cors';
import { config } from './config';
import { authMiddleware } from './api/middleware/auth';
import { errorHandler } from './api/middleware/errorHandler';
import { realtimeService } from './services/realtimeService';
import { authService } from './services/authService';
import { seedDatabase } from './db/seed';

import authRouter from './api/routes/auth';
import storesRouter from './api/routes/stores';
import productsRouter from './api/routes/products';
import ordersRouter from './api/routes/orders';
import paymentsRouter from './api/routes/payments';
import queueRouter from './api/routes/queue';
import analyticsRouter from './api/routes/analytics';
import syncRouter from './api/routes/sync';
import publicRouter from './api/routes/public';

export function createServer() {
  const app = express();

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

  let lastSeedResult: any = { status: 'none' };

  // Admin Seed Route (guarded by admin key)
  app.post('/api/seed', async (req, res) => {
    const key = (req.headers['x-admin-key'] as string) || (req.query.key as string);
    const expectedKey = process.env.ADMIN_KEY || 'floq_admin_seed_secret';

    if (!key || key !== expectedKey) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Invalid or missing admin seed key' });
      return;
    }

    try {
      console.log('🌱 Seeding database...');
      await seedDatabase(true);
      console.log('✅ Database seeded successfully!');

      res.json({
        success: true,
        message: 'Database seeded successfully on live PostgreSQL!',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('❌ Database seed error:', err);
      res.status(500).json({
        error: 'SEED_FAILED',
        message: err.message,
        detail: err.detail || null,
        stack: err.stack || null,
      });
    }
  });

  app.get('/api/seed/status', (req, res) => {
    res.json(lastSeedResult);
  });

  app.get('/api/debug/users', async (req, res) => {
    try {
      const { query } = require('./db');
      const users = await query('SELECT id, phone, name, merchant_id FROM users');
      const merchants = await query('SELECT id, name, phone FROM merchants');
      res.json({ users, merchants });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Public auth routes (Unauthenticated)
  app.use('/api/auth', authRouter);

  // Realtime Server-Sent Events (SSE) stream (Authenticated via query token or Bearer header)
  app.get('/api/realtime', (req, res) => {
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

    try {
      const payload = authService.verifyToken(token);
      const storeId = (req.query.storeId as string) || (payload.storeIds && payload.storeIds[0]);

      if (!storeId) {
        res.status(400).json({ error: 'STORE_REQUIRED', message: 'storeId is required for realtime stream' });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      realtimeService.subscribe(storeId, res);
    } catch {
      res.status(401).json({ error: 'INVALID_TOKEN', message: 'Realtime token verification failed' });
    }
  });

  // Public customer routes (Unauthenticated)
  app.use('/api/public', publicRouter);

  // Authenticated Merchant API Routes (with Data Isolation Middleware)
  app.use('/api/stores', authMiddleware, storesRouter);
  app.use('/api/products', authMiddleware, productsRouter);
  app.use('/api/orders', authMiddleware, ordersRouter);
  app.use('/api/payments', authMiddleware, paymentsRouter);
  app.use('/api/queue', authMiddleware, queueRouter);
  app.use('/api/analytics', authMiddleware, analyticsRouter);
  app.use('/api/sync', authMiddleware, syncRouter);

  // Central Error Handler
  app.use(errorHandler);

  return app;
}

if (require.main === module) {
  const app = createServer();
  app.listen(config.port, '0.0.0.0', async () => {
    console.log(`🚀 FLOQ Backend Server running on 0.0.0.0:${config.port}`);
    try {
      const { queryOne } = await import('./db');
      const merchantCount = await queryOne('SELECT COUNT(*) as count FROM merchants');
      if (!merchantCount || parseInt(merchantCount.count, 10) === 0) {
        console.log('🌱 Merchants table empty. Auto-seeding pilot merchants on boot...');
        await seedDatabase(true);
        console.log('✅ Auto-seed completed on boot!');
      }
    } catch (err) {
      console.error('⚠️ Auto-seed check warning:', err);
    }
  });
}
