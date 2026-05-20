const mongoose = require('mongoose');

/**
 * OrderOverride — lives in the CENTRAL database only.
 *
 * Stores per-order metadata that does not exist in the restaurant's source DB:
 *  - notificationSent: set ONLY by the cron job, never by GET /api/orders
 *  - prepTimeMinutes: set by restaurant owner via mobile app
 *  - acknowledgedAt: set by restaurant owner via mobile app
 */
const orderOverrideSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
    },
    // _id of the order in the source restaurant DB (stored as string)
    sourceOrderId: {
      type: String,
      required: true,
    },
    prepTimeMinutes: {
      type: Number,
      default: null,
    },
    customPrepTimeLabel: {
      type: String,
      default: null,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    // Set to true ONLY by /api/cron/check-paid-orders — never by GET /api/orders
    notificationSent: {
      type: Boolean,
      default: false,
    },
    notificationSentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'orderoverrides', // explicit collection name
  }
);

// One override record per order per restaurant
orderOverrideSchema.index({ restaurantId: 1, sourceOrderId: 1 }, { unique: true });
// Fast cron lookup: unsent notifications per restaurant
orderOverrideSchema.index({ restaurantId: 1, notificationSent: 1 });

module.exports = mongoose.model('OrderOverride', orderOverrideSchema, 'orderoverrides');
