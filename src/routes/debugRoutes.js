const express = require('express');
const Restaurant = require('../models/Restaurant');
const { getSourceDbConnection } = require('../utils/sourceDb');
const { requireAdminAuth } = require('../middleware/adminAuthMiddleware');
const mongoose = require('mongoose');

const router = express.Router();

// Debug routes require admin auth
router.use(requireAdminAuth);

/**
 * GET /api/debug/restaurants/:id/config
 * Show the restaurant config (masks sourceDbUri).
 */
router.get('/restaurants/:id/config', async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id).lean();
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    console.log(`[Debug] restaurant config: name="${restaurant.name}" key="${restaurant.restaurantKey}"`);
    console.log(`[Debug] restaurant config timezone: ${restaurant.timezone || '(not set)'}`);
    console.log(`[Debug] source db: "${restaurant.sourceDbName}" collection: "${restaurant.sourceOrderCollection}"`);

    // Mask the URI but show the host portion for debugging
    let maskedUri = '***';
    try {
      const url = new URL(restaurant.sourceDbUri);
      maskedUri = `${url.protocol}//*****@${url.host}/${url.pathname.slice(1)}`;
    } catch {
      maskedUri = '*** (invalid URI)';
    }

    res.json({
      restaurant: {
        ...restaurant,
        sourceDbUri: maskedUri,
      },
    });
  } catch (err) {
    console.error('[Debug] Config error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/debug/restaurants/:id/latest-orders
 * Fetch the 5 most recent orders from the restaurant's source DB.
 * Useful for verifying field names and data shape.
 */
router.get('/restaurants/:id/latest-orders', async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id).lean();
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    console.log(`[Debug] latest-orders: restaurant="${restaurant.name}" key="${restaurant.restaurantKey}"`);
    console.log(`[Debug] restaurant config timezone: ${restaurant.timezone || '(not set)'}`);
    console.log(`[Debug] source db: "${restaurant.sourceDbName}" collection: "${restaurant.sourceOrderCollection}"`);

    const conn = await getSourceDbConnection(restaurant);

    const modelName = `DebugOrder_${restaurant.restaurantKey}`;
    let OrderModel;
    try {
      OrderModel = conn.model(modelName);
    } catch {
      const schema = new mongoose.Schema({}, { strict: false });
      OrderModel = conn.model(modelName, schema, restaurant.sourceOrderCollection);
    }

    const orders = await OrderModel.find({}).sort({ _id: -1 }).limit(5).lean();

    // Show all field names present in the first order (helps configure field mappings)
    const fieldNames = orders.length > 0 ? Object.keys(orders[0]) : [];

    res.json({
      restaurantName: restaurant.name,
      restaurantKey: restaurant.restaurantKey,
      sourceDbName: restaurant.sourceDbName,
      sourceOrderCollection: restaurant.sourceOrderCollection,
      totalFetched: orders.length,
      fieldNamesInFirstOrder: fieldNames,
      orders,
    });
  } catch (err) {
    console.error('[Debug] Latest orders error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
