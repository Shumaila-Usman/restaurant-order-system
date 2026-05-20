const jwt = require('jsonwebtoken');
const AdminUser = require('../models/AdminUser');

/**
 * Middleware: authenticate admin JWT.
 * Attaches req.admin (AdminUser doc).
 */
async function requireAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    let payload;
    try {
      payload = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired admin token' });
    }

    if (payload.type !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: admin token required' });
    }

    const admin = await AdminUser.findById(payload.adminId).lean();
    if (!admin || !admin.isActive) {
      return res.status(401).json({ error: 'Admin not found or inactive' });
    }

    req.admin = admin;
    next();
  } catch (err) {
    console.error('[Auth] requireAdminAuth error:', err.message);
    res.status(500).json({ error: 'Authentication error' });
  }
}

module.exports = { requireAdminAuth };
