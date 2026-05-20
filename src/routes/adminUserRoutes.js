const express = require('express');
const RestaurantUser = require('../models/RestaurantUser');
const Restaurant = require('../models/Restaurant');
const { requireAdminAuth } = require('../middleware/adminAuthMiddleware');

const router = express.Router();

router.use(requireAdminAuth);

/**
 * POST /api/admin/restaurants/:restaurantId/users
 * Create a restaurant owner user.
 */
router.post('/restaurants/:restaurantId/users', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    const existing = await RestaurantUser.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    // passwordHash field is set to plain password; the pre-save hook hashes it
    const user = await RestaurantUser.create({
      restaurantId,
      name,
      email: email.toLowerCase().trim(),
      passwordHash: password,
      isActive: true,
    });

    console.log(
      `[Admin] Created user: email="${user.email}" restaurant="${restaurant.name}"`
    );

    res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        restaurantId: user.restaurantId,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    console.error('[Admin] Create user error:', err.message);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/**
 * GET /api/admin/restaurants/:restaurantId/users
 * List all users for a restaurant.
 */
router.get('/restaurants/:restaurantId/users', async (req, res) => {
  try {
    const users = await RestaurantUser.find({
      restaurantId: req.params.restaurantId,
    })
      .select('-passwordHash')
      .lean();

    res.json({ users });
  } catch (err) {
    console.error('[Admin] List users error:', err.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * PATCH /api/admin/users/:userId
 * Update user name, email, or isActive.
 */
router.patch('/users/:userId', async (req, res) => {
  try {
    const { name, email, isActive } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email.toLowerCase().trim();
    if (isActive !== undefined) updates.isActive = isActive;

    const user = await RestaurantUser.findByIdAndUpdate(
      req.params.userId,
      { $set: updates },
      { new: true }
    ).select('-passwordHash');

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ user });
  } catch (err) {
    console.error('[Admin] Update user error:', err.message);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * PATCH /api/admin/users/:userId/password
 * Change a restaurant owner's password.
 */
router.patch('/users/:userId/password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await RestaurantUser.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Setting passwordHash to plain triggers the pre-save hash
    user.passwordHash = password;
    await user.save();

    console.log(`[Admin] Password changed for user: email="${user.email}"`);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('[Admin] Change password error:', err.message);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

/**
 * DELETE /api/admin/users/:userId
 * Delete a restaurant owner user.
 */
router.delete('/users/:userId', async (req, res) => {
  try {
    const user = await RestaurantUser.findByIdAndDelete(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    console.log(`[Admin] Deleted user: email="${user.email}"`);
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('[Admin] Delete user error:', err.message);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
