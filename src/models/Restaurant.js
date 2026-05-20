const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    restaurantKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    timezone: {
      type: String,
      default: 'America/New_York',
    },
    // ─── Source DB connection (restaurant's own website database) ──────────
    sourceDbUri: {
      type: String,
      required: true,
    },
    sourceDbName: {
      type: String,
      required: true,
    },
    sourceOrderCollection: {
      type: String,
      required: true,
      default: 'orders',
    },
    sourcePaymentStatusField: {
      type: String,
      required: true,
      default: 'paymentStatus',
    },
    sourcePaidValue: {
      type: String,
      required: true,
      default: 'paid',
    },
    sourceOrderNumberField: {
      type: String,
      default: 'orderNumber',
    },
    sourceOrderTypeField: {
      type: String,
      default: 'orderType',
    },
    sourceItemsField: {
      type: String,
      default: 'items',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'restaurants', // explicit collection name
  }
);

module.exports = mongoose.model('Restaurant', restaurantSchema, 'restaurants');
