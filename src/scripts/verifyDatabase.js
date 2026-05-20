/**
 * verifyDatabase.js
 *
 * Prints a full health report of the central database and the test source DB.
 * Safe to run at any time — read-only, no writes.
 *
 * Usage:
 *   npm run db:verify
 */
require('dotenv').config();

const mongoose = require('mongoose');
const { CENTRAL_DB_NAME } = require('../config/db');

const AdminUser      = require('../models/AdminUser');
const Restaurant     = require('../models/Restaurant');
const RestaurantUser = require('../models/RestaurantUser');
const DeviceToken    = require('../models/DeviceToken');
const OrderOverride  = require('../models/OrderOverride');

const MONGO_URI = process.env.MONGO_URI;
const TEST_SOURCE_DB_URI = process.env.TEST_SOURCE_DB_URI || MONGO_URI;

function tick(val)  { return val ? '✓ YES' : '✗ NO '; }
function count(n)   { return String(n).padStart(4); }

async function run() {
  if (!MONGO_URI) {
    console.error('[Verify] ERROR: MONGO_URI is not set in .env');
    process.exit(1);
  }

  // ── Connect to central DB ──────────────────────────────────────────────────
  await mongoose.connect(MONGO_URI, { dbName: CENTRAL_DB_NAME });
  const dbName = mongoose.connection.db.databaseName;

  console.log('\n══════════════════════════════════════════════');
  console.log('  DATABASE VERIFICATION REPORT');
  console.log('══════════════════════════════════════════════');

  // ── Central DB ─────────────────────────────────────────────────────────────
  console.log(`\n  Central DB name:   ${dbName}`);
  console.log(`  Expected:          ${CENTRAL_DB_NAME}`);
  console.log(`  Match:             ${tick(dbName === CENTRAL_DB_NAME)}`);

  const restaurantCount  = await Restaurant.countDocuments();
  const ownerCount       = await RestaurantUser.countDocuments();
  const adminCount       = await AdminUser.countDocuments();
  const tokenCount       = await DeviceToken.countDocuments();
  const overrideCount    = await OrderOverride.countDocuments();

  console.log('\n  ── Collection Counts ──────────────────────');
  console.log(`  restaurants:     ${count(restaurantCount)}`);
  console.log(`  restaurantusers: ${count(ownerCount)}`);
  console.log(`  adminusers:      ${count(adminCount)}`);
  console.log(`  devicetokens:    ${count(tokenCount)}`);
  console.log(`  orderoverrides:  ${count(overrideCount)}`);

  // ── Test Pizza House ───────────────────────────────────────────────────────
  console.log('\n  ── Test Pizza House ───────────────────────');
  const testRestaurant = await Restaurant.findOne({ restaurantKey: 'test_pizza_house' });
  console.log(`  Exists:          ${tick(!!testRestaurant)}`);

  if (testRestaurant) {
    console.log(`  isActive:        ${tick(testRestaurant.isActive)}`);
    console.log(`  timezone:        ${testRestaurant.timezone || '(not set)'}`);
    console.log(`  sourceDbName:    ${testRestaurant.sourceDbName}`);
    console.log(`  sourceCollection:${testRestaurant.sourceOrderCollection}`);
    console.log(`  paymentField:    ${testRestaurant.sourcePaymentStatusField}`);
    console.log(`  paidValue:       ${testRestaurant.sourcePaidValue}`);
  }

  // ── Test Owner ─────────────────────────────────────────────────────────────
  console.log('\n  ── Test Owner User ────────────────────────');
  const testOwner = await RestaurantUser.findOne({ email: 'testowner@example.com' });
  console.log(`  Exists:          ${tick(!!testOwner)}`);

  if (testOwner) {
    console.log(`  isActive:        ${tick(testOwner.isActive)}`);

    const linkedRestaurant = testRestaurant &&
      testOwner.restaurantId.toString() === testRestaurant._id.toString();
    console.log(`  Linked to Test Pizza House: ${tick(linkedRestaurant)}`);
  }

  // ── Admin user ─────────────────────────────────────────────────────────────
  console.log('\n  ── Admin User ─────────────────────────────');
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const admin = await AdminUser.findOne({ email: adminEmail });
  console.log(`  ${adminEmail}`);
  console.log(`  Exists:          ${tick(!!admin)}`);
  if (admin) {
    console.log(`  isActive:        ${tick(admin.isActive)}`);
    console.log(`  role:            ${admin.role}`);
  }

  // ── Source DB ──────────────────────────────────────────────────────────────
  console.log('\n  ── Test Source DB (test_restaurant_source) ');
  let sourceConn;
  try {
    sourceConn = await mongoose.createConnection(TEST_SOURCE_DB_URI, {
      dbName: 'test_restaurant_source',
      serverSelectionTimeoutMS: 5000,
    }).asPromise();

    const sourceDbName = sourceConn.db.databaseName;
    const orderSchema = new mongoose.Schema({}, { strict: false });
    const OrderModel = sourceConn.model('VerifyOrder', orderSchema, 'orders');

    const totalOrders = await OrderModel.countDocuments();
    const paidOrders  = await OrderModel.countDocuments({ paymentStatus: 'paid' });

    console.log(`  Reachable:       ✓ YES`);
    console.log(`  DB name:         ${sourceDbName}`);
    console.log(`  Total orders:    ${count(totalOrders)}`);
    console.log(`  Paid orders:     ${count(paidOrders)}`);

    // Check specific test orders
    const t1001 = await OrderModel.findOne({ orderNumber: 'TEST-1001' });
    const t1002 = await OrderModel.findOne({ orderNumber: 'TEST-1002' });
    const t1003 = await OrderModel.findOne({ orderNumber: 'TEST-1003' });
    console.log(`  TEST-1001 (paid ASAP):      ${tick(!!t1001)}`);
    console.log(`  TEST-1002 (unpaid):         ${tick(!!t1002)}`);
    console.log(`  TEST-1003 (paid scheduled): ${tick(!!t1003)}`);

    await sourceConn.close();
  } catch (err) {
    console.log(`  Reachable:       ✗ NO  (${err.message})`);
    console.log(`  → Run: npm run db:seed-source`);
  }

  // ── Final verdict ──────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════');

  const allGood =
    dbName === CENTRAL_DB_NAME &&
    !!testRestaurant &&
    testRestaurant.isActive &&
    !!testOwner &&
    testOwner.isActive &&
    !!admin;

  if (allGood) {
    console.log('  STATUS: ✓ READY — run npm run dev');
  } else {
    console.log('  STATUS: ✗ NOT READY — run npm run db:init first');
  }
  console.log('══════════════════════════════════════════════\n');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[Verify] FATAL:', err.message);
  process.exit(1);
});
