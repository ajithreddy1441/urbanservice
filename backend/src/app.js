import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import orderRoutes from './modules/orders/order.routes.js';
import customerRoutes from './modules/customer/customer.routes.js';
import technicianRoutes from './modules/technician/technician.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import { categories, services, service, reviews, stats, settings, locations } from './modules/catalog/catalog.controller.js';

const app = express();
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.corsOrigins, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 400,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please wait a moment.', errorCode: 'RATE_LIMIT' },
}));
app.use('/uploads', express.static(path.resolve('uploads')));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, message: 'OK', data: { service: 'urban-services', database: 'up' } });
  } catch {
    res.status(503).json({ success: false, message: 'Database unavailable', errorCode: 'DB_UNAVAILABLE' });
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: { success: false, message: 'Too many sign-in attempts. Try again shortly.', errorCode: 'RATE_LIMIT' },
});

app.use('/api/auth', authLimiter, authRoutes);
app.get('/api/categories', categories);
app.get('/api/services', services);
app.get('/api/services/:id', service);
app.get('/api/reviews/public', reviews);
app.get('/api/stats', stats);
app.get('/api/settings/public', settings);
app.get('/api/locations', locations);
app.use('/api/orders', orderRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/technician', technicianRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
