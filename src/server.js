require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { connectCentralDB } = require('./config/db');
const { initFirebase } = require('./config/firebase');

// ── Route imports ─────────────────────────────────────────────────────────────
const authRoutes = require('./routes/authRoutes');
const adminAuthRoutes = require('./routes/adminAuthRoutes');
const adminRestaurantRoutes = require('./routes/adminRestaurantRoutes');
const adminUserRoutes = require('./routes/adminUserRoutes');
const adminOrderRoutes = require('./routes/adminOrderRoutes');
const orderRoutes = require('./routes/orderRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const cronRoutes = require('./routes/cronRoutes');
const debugRoutes = require('./routes/debugRoutes');

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend is running',
    service: 'restaurant-order-system-backend',
    timestamp: new Date().toISOString(),
  });
});

// Also mount at /api/health for convenience
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend is running',
    service: 'restaurant-order-system-backend',
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────

// Restaurant owner auth
app.use('/api/auth', authRoutes);

// Mobile: orders
app.use('/api/orders', orderRoutes);

// Mobile: device tokens
app.use('/api/devices', deviceRoutes);

// Admin auth (login + me)
app.use('/api/admin', adminAuthRoutes);

// Admin: restaurant CRUD
app.use('/api/admin/restaurants', adminRestaurantRoutes);

// Admin: restaurant user CRUD (uses /restaurants/:id/users and /users/:id paths)
app.use('/api/admin', adminUserRoutes);

// Admin: orders
app.use('/api/admin', adminOrderRoutes);

// Cron: check paid orders and send FCM notifications
app.use('/api/cron', cronRoutes);

// Debug: inspect restaurant config and raw orders (admin auth required)
app.use('/api/debug', debugRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Server] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function bootstrap() {
  await connectCentralDB();
  initFirebase();

  app.listen(PORT, () => {
    console.log(`[Server] Restaurant Order System backend running on port ${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[Server] Health check: http://localhost:${PORT}/health`);
  });
}

bootstrap().catch((err) => {
  console.error('[Server] Bootstrap failed:', err.message);
  process.exit(1);
});
