const express = require('express');
const DeviceToken = require('../models/DeviceToken');
const { requireOwnerAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireOwnerAuth);

/**
 * POST /api/devices/register
 * Register or update an FCM device token for the authenticated owner.
 * Body: { token: string, platform: 'android' | 'ios' }
 */
router.post('/register', async (req, res) => {
  try {
    const { token, platform } = req.body;

    if (!token || !platform) {
      return res.status(400).json({ error: 'token and platform are required' });
    }

    if (!['android', 'ios'].includes(platform)) {
      return res.status(400).json({ error: 'platform must be android or ios' });
    }

    // Upsert: if token already exists, update it; otherwise create new
    const deviceToken = await DeviceToken.findOneAndUpdate(
      { token },
      {
        $set: {
          restaurantId: req.restaurant._id,
          userId: req.user._id,
          platform,
          tokenType: 'fcm',
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );

    console.log(
      `[Devices] Token registered: restaurant="${req.restaurant.name}" ` +
      `user="${req.user.email}" platform="${platform}"`
    );

    res.json({ deviceToken });
  } catch (err) {
    console.error('[Devices] Register error:', err.message);
    res.status(500).json({ error: 'Failed to register device token' });
  }
});

/**
 * DELETE /api/devices/unregister
 * Deactivate a device token (e.g. on logout).
 * Body: { token: string }
 */
router.delete('/unregister', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }

    await DeviceToken.findOneAndUpdate(
      { token, restaurantId: req.restaurant._id },
      { $set: { isActive: false } }
    );

    console.log(
      `[Devices] Token unregistered: restaurant="${req.restaurant.name}" ` +
      `user="${req.user.email}"`
    );

    res.json({ message: 'Device token unregistered' });
  } catch (err) {
    console.error('[Devices] Unregister error:', err.message);
    res.status(500).json({ error: 'Failed to unregister device token' });
  }
});

module.exports = router;
