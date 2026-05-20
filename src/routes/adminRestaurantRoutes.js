const express = require('express');
const Restaurant = require('../models/Restaurant');
const { requireAdminAuth } = require('../middleware/adminAuthMiddleware');

const router = express.Router();

// All routes require admin auth
router.use(requireAdminAuth);

/**
 * POST /api/admin/restaurants
 * Create a new restaurant.
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      restaurantKey,
      timezone,
      sourceDbUri,
      sourceDbName,
      sourceOrderCollection,
      sourcePaymentStatusField,
      sourcePaidValue,
      sourceOrderNumberField,
      sourceOrderTypeField,
      sourceItemsField,
      isActive,
    } = req.body;

    if (!name || !restaurantKey || !sourceDbUri || !sourceDbName) {
      return res.status(400).json({
        error: 'name, restaurantKey, sourceDbUri, and sourceDbName are required',
      });
    }

    const existing = await Restaurant.findOne({ restaurantKey: restaurantKey.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'restaurantKey already exists' });
    }

    const restaurant = await Restaurant.create({
      name,
      restaurantKey: restaurantKey.toLowerCase(),
      timezone: timezone || 'America/New_York',
      sourceDbUri,
      sourceDbName,
      sourceOrderCollection: sourceOrderCollection || 'orders',
      sourcePaymentStatusField: sourcePaymentStatusField || 'paymentStatus',
      sourcePaidValue: sourcePaidValue || 'paid',
      sourceOrderNumberField: sourceOrderNumberField || 'orderNumber',
      sourceOrderTypeField: sourceOrderTypeField || 'orderType',
      sourceItemsField: sourceItemsField || 'items',
      isActive: isActive !== undefined ? isActive : true,
    });

    console.log(`[Admin] Created restaurant: name="${restaurant.name}" key="${restaurant.restaurantKey}"`);
    res.status(201).json({ restaurant });
  } catch (err) {
    console.error('[Admin] Create restaurant error:', err.message);
    res.status(500).json({ error: 'Failed to create restaurant' });
  }
});

/**
 * GET /api/admin/restaurants
 * List all restaurants.
 */
router.get('/', async (req, res) => {
  try {
    const restaurants = await Restaurant.find().sort({ name: 1 }).lean();
    // Mask sourceDbUri in list view for security
    const masked = restaurants.map((r) => ({
      ...r,
      sourceDbUri: r.sourceDbUri ? '***' : null,
    }));
    res.json({ restaurants: masked });
  } catch (err) {
    console.error('[Admin] List restaurants error:', err.message);
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
});

/**
 * GET /api/admin/restaurants/:id
 * Get a single restaurant (includes full sourceDbUri for editing).
 */
router.get('/:id', async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id).lean();
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    res.json({ restaurant });
  } catch (err) {
    console.error('[Admin] Get restaurant error:', err.message);
    res.status(500).json({ error: 'Failed to fetch restaurant' });
  }
});

/**
 * PATCH /api/admin/restaurants/:id
 * Update a restaurant.
 */
router.patch('/:id', async (req, res) => {
  try {
    const allowedFields = [
      'name',
      'restaurantKey',
      'timezone',
      'sourceDbUri',
      'sourceDbName',
      'sourceOrderCollection',
      'sourcePaymentStatusField',
      'sourcePaidValue',
      'sourceOrderNumberField',
      'sourceOrderTypeField',
      'sourceItemsField',
      'isActive',
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (updates.restaurantKey) {
      updates.restaurantKey = updates.restaurantKey.toLowerCase();
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    console.log(`[Admin] Updated restaurant: name="${restaurant.name}" key="${restaurant.restaurantKey}"`);
    res.json({ restaurant });
  } catch (err) {
    console.error('[Admin] Update restaurant error:', err.message);
    res.status(500).json({ error: 'Failed to update restaurant' });
  }
});

/**
 * DELETE /api/admin/restaurants/:id
 * Delete a restaurant.
 */
router.delete('/:id', async (req, res) => {
  try {
    const restaurant = await Restaurant.findByIdAndDelete(req.params.id).lean();
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    console.log(`[Admin] Deleted restaurant: name="${restaurant.name}" key="${restaurant.restaurantKey}"`);
    res.json({ message: 'Restaurant deleted' });
  } catch (err) {
    console.error('[Admin] Delete restaurant error:', err.message);
    res.status(500).json({ error: 'Failed to delete restaurant' });
  }
});

module.exports = router;
