const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RestaurantUser',
      required: true,
    },
    platform: {
      type: String,
      enum: ['android', 'ios'],
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true, // unique: true on field already creates the index — no duplicate below
    },
    tokenType: {
      type: String,
      enum: ['fcm'],
      default: 'fcm',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'devicetokens', // explicit collection name
  }
);

// Quick lookup of all active tokens for a restaurant
deviceTokenSchema.index({ restaurantId: 1, isActive: 1 });

module.exports = mongoose.model('DeviceToken', deviceTokenSchema, 'devicetokens');
