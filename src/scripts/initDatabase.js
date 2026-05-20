/**
 * initDatabase.js
 *
 * Initializes the central database for restaurant_order_system_v2.
 *
 * Safe to run multiple times — never duplicates records.
 * Only resets test passwords if RESET_TEST_PASSWORDS=true in env.
 *
 * Usage:
 *   npm run db:init
 *
 * What it does:
 *   1. Connects to central MongoDB (restaurant_order_system_v2)
 *   2. Prints DB name confirmation
 *   3. Ensures all indexes exist on all collections
 *   4. Creates admin user if missing
 *   5. Creates Test Pizza House restaurant if missing
 *   6. Creates test owner user if missing
 *   7. Prints summary
 */
require('dotenv').config();

const mongoose = require('mongoose');
const { CENTRAL_DB_NAME } = require('../config/db');

// ── Models (explicit collection names) ───────────────────────────────────────
const AdminUser      = require('../models/AdminUser');
const Restaurant     = require('../models/Restaurant');
const RestaurantUser = require('../models/RestaurantUser');
const DeviceToken    = require('../models/DeviceToken');
const OrderOverride  = require('../models/OrderOverride');

// ── Config from env ───────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI;

const ADMIN_NAME     = process.env.SEED_ADMIN_NAME     || 'Local Admin';
const ADMIN_EMAIL    = process.env.SEED_ADMIN_EMAIL    || 'admin@example.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';

const RESET_PASSWORDS = process.env.RESET_TEST_PASSWORDS === 'true';

// Test source DB URI — reuse same Atlas cluster with a different DB name
const TEST_SOURCE_DB_URI = process.env.TEST_SOURCE_DB_URI || MONGO_URI;

// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  if (!MONGO_URI) {
    console.error('[Init] ERROR: MONGO_URI is not set in .env');
    process.exit(1);
  }

  // ── Connect ────────────────────────────────────────────────────────────────
  console.log('\n[Init] Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI, { dbName: CENTRAL_DB_NAME });

  const dbName = mongoose.connection.db.databaseName;
  console.log(`[Init] ✓ Connected`);
  console.log(`[Init] ✓ Database: ${dbName}`);

  if (dbName !== CENTRAL_DB_NAME) {
    console.error(
      `[Init] ERROR: Expected database "${CENTRAL_DB_NAME}" but got "${dbName}". Aborting.`
    );
    process.exit(1);
  }

  // ── Ensure indexes ─────────────────────────────────────────────────────────
  console.log('\n[Init] Syncing indexes...');
  await Promise.all([
    AdminUser.createIndexes(),
    Restaurant.createIndexes(),
    RestaurantUser.createIndexes(),
    DeviceToken.createIndexes(),
    OrderOverride.createIndexes(),
  ]);
  console.log('[Init] ✓ Indexes synced for all collections');

  // ── Admin user ─────────────────────────────────────────────────────────────
  console.log('\n[Init] Checking admin user...');
  let admin = await AdminUser.findOne({ email: ADMIN_EMAIL.toLowerCase() });

  if (!admin) {
    admin = await AdminUser.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL.toLowerCase(),
      passwordHash: ADMIN_PASSWORD, // pre-save hook hashes this
      role: 'superadmin',
      isActive: true,
    });
    console.log(`[Init] ✓ Admin created: ${admin.email}`);
  } else if (RESET_PASSWORDS) {
    admin.passwordHash = ADMIN_PASSWORD;
    await admin.save();
    console.log(`[Init] ✓ Admin password reset: ${admin.email}`);
  } else {
    console.log(`[Init] ✓ Admin already exists: ${admin.email} (skipped)`);
  }

  // ── Test Pizza House restaurant ────────────────────────────────────────────
  console.log('\n[Init] Checking test restaurant...');
  let restaurant = await Restaurant.findOne({ restaurantKey: 'test_pizza_house' });

  if (!restaurant) {
    restaurant = await Restaurant.create({
      name: 'Test Pizza House',
      restaurantKey: 'test_pizza_house',
      timezone: 'America/New_York',
      sourceDbUri: TEST_SOURCE_DB_URI,
      sourceDbName: 'test_restaurant_source',
      sourceOrderCollection: 'orders',
      sourcePaymentStatusField: 'paymentStatus',
      sourcePaidValue: 'paid',
      sourceOrderNumberField: 'orderNumber',
      sourceOrderTypeField: 'orderType',
      sourceItemsField: 'items',
      isActive: true,
    });
    console.log(`[Init] ✓ Test restaurant created: "${restaurant.name}" (id: ${restaurant._id})`);
  } else {
    console.log(`[Init] ✓ Test restaurant already exists: "${restaurant.name}" (id: ${restaurant._id}) (skipped)`);
  }

  // ── Test owner user ────────────────────────────────────────────────────────
  console.log('\n[Init] Checking test owner user...');
  const TEST_OWNER_EMAIL = 'testowner@example.com';
  const TEST_OWNER_PASSWORD = 'TestOwner123!';

  let owner = await RestaurantUser.findOne({ email: TEST_OWNER_EMAIL });

  if (!owner) {
    owner = await RestaurantUser.create({
      restaurantId: restaurant._id,
      name: 'Test Owner',
      email: TEST_OWNER_EMAIL,
      passwordHash: TEST_OWNER_PASSWORD, // pre-save hook hashes this
      isActive: true,
    });
    console.log(`[Init] ✓ Test owner created: ${owner.email}`);
  } else if (RESET_PASSWORDS) {
    owner.passwordHash = TEST_OWNER_PASSWORD;
    await owner.save();
    console.log(`[Init] ✓ Test owner password reset: ${owner.email}`);
  } else {
    console.log(`[Init] ✓ Test owner already exists: ${owner.email} (skipped)`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const restaurantCount  = await Restaurant.countDocuments();
  const ownerCount       = await RestaurantUser.countDocuments();
  const adminCount       = await AdminUser.countDocuments();
  const tokenCount       = await DeviceToken.countDocuments();
  const overrideCount    = await OrderOverride.countDocuments();

  console.log('\n─────────────────────────────────────────');
  console.log('[Init] DATABASE SUMMARY');
  console.log(`  Database:        ${dbName}`);
  console.log(`  restaurants:     ${restaurantCount}`);
  console.log(`  restaurantusers: ${ownerCount}`);
  console.log(`  adminusers:      ${adminCount}`);
  console.log(`  devicetokens:    ${tokenCount}`);
  console.log(`  orderoverrides:  ${overrideCount}`);
  console.log('─────────────────────────────────────────');
  console.log('\n[Init] ✓ Database initialization complete');
  console.log('\nNext step: npm run db:seed-source');
  console.log('Then:      npm run dev\n');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[Init] FATAL:', err.message);
  process.exit(1);
});
