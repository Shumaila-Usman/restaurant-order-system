const jwt = require('jsonwebtoken');
const RestaurantUser = require('../models/RestaurantUser');
const Restaurant = require('../models/Restaurant');

/**
 * Middleware: authenticate restaurant owner JWT.
 * Attaches req.user (RestaurantUser doc) and req.restaurant (Restaurant doc).
 */
async function requireOwnerAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (payload.type !== 'owner') {
      return res.status(403).json({ error: 'Forbidden: owner token required' });
    }

    const user = await RestaurantUser.findById(payload.userId).lean();
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    const restaurant = await Restaurant.findById(user.restaurantId).lean();
    if (!restaurant || !restaurant.isActive) {
      return res.status(403).json({ error: 'Restaurant not found or inactive' });
    }

    req.user = user;
    req.restaurant = restaurant;
    next();
  } catch (err) {
    console.error('[Auth] requireOwnerAuth error:', err.message);
    res.status(500).json({ error: 'Authentication error' });
  }
}

module.exports = { requireOwnerAuth };
