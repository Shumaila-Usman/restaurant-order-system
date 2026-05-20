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

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend is running',
    service: 'restaurant-order-system-backend',
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/admin', adminAuthRoutes);
app.use('/api/admin/restaurants', adminRestaurantRoutes);
app.use('/api/admin', adminUserRoutes);
app.use('/api/admin', adminOrderRoutes);
app.use('/api/cron', cronRoutes);
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

// ── Bootstrap — works for both local and Vercel ───────────────────────────────
let isInitialized = false;

async function initialize() {
  if (isInitialized) return;
  isInitialized = true;
  await connectCentralDB();
  initFirebase();
}

// Local development — start HTTP server
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  initialize().then(() => {
    app.listen(PORT, () => {
      console.log(`[Server] Restaurant Order System backend running on port ${PORT}`);
      console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`[Server] Health check: http://localhost:${PORT}/health`);
    });
  }).catch((err) => {
    console.error('[Server] Bootstrap failed:', err.message);
    process.exit(1);
  });
} else {
  // Vercel — initialize on first request
  const originalHandler = app;
  
  module.exports = async (req, res) => {
    await initialize();
    return originalHandler(req, res);
  };
}

// Also export app for Vercel (module.exports may be overwritten above in production)
if (process.env.NODE_ENV !== 'production') {
  module.exports = app;
}
