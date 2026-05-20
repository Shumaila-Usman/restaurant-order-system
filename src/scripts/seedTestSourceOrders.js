/**
 * seedTestSourceOrders.js
 *
 * Inserts test orders into the SOURCE database (test_restaurant_source).
 * This simulates what a real restaurant website database looks like.
 *
 * Safe to run multiple times — skips orders that already exist (by orderNumber).
 *
 * Usage:
 *   npm run db:seed-source
 *
 * Test orders inserted:
 *   TEST-1001 — paid, ASAP pickup       → should appear in /api/orders
 *   TEST-1002 — UNPAID                  → must NOT appear in /api/orders
 *   TEST-1003 — paid, scheduled pickup  → should appear in /api/orders
 */
require('dotenv').config();

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;
const TEST_SOURCE_DB_URI = process.env.TEST_SOURCE_DB_URI || MONGO_URI;
const SOURCE_DB_NAME = 'test_restaurant_source';
const SOURCE_COLLECTION = 'orders';

// ── Test order documents ──────────────────────────────────────────────────────

const TEST_ORDERS = [
  {
    orderNumber: 'TEST-1001',
    paymentStatus: 'paid',
    orderStatus: 'new',
    orderType: 'pickup',
    isASAP: true,
    createdAt: new Date('2026-05-20T18:30:00.000Z'),
    customer: {
      name: 'John Test',
      phone: '+1 555 123 4567',
      email: 'john.test@example.com',
    },
    items: [
      {
        name: 'Margherita Pizza',
        quantity: 1,
        price: 12.99,
        modifiers: ['Extra cheese', 'Thin crust'],
      },
      {
        name: 'Garlic Bread',
        quantity: 2,
        price: 4.5,
      },
    ],
    subtotal: 21.99,
    tax: 1.76,
    tip: 3,
    deliveryFee: 0,
    total: 26.75,
    currency: 'USD',
    notes: 'Test paid ASAP pickup order',
  },
  {
    orderNumber: 'TEST-1002',
    paymentStatus: 'unpaid',
    orderStatus: 'new',
    orderType: 'pickup',
    isASAP: true,
    createdAt: new Date('2026-05-20T18:40:00.000Z'),
    customer: {
      name: 'Unpaid Customer',
      phone: '+1 555 999 9999',
      email: 'unpaid@example.com',
    },
    items: [
      {
        name: 'Pepperoni Pizza',
        quantity: 1,
        price: 14.99,
      },
    ],
    subtotal: 14.99,
    tax: 1.2,
    tip: 0,
    deliveryFee: 0,
    total: 16.19,
    currency: 'USD',
  },
  {
    orderNumber: 'TEST-1003',
    paymentStatus: 'paid',
    orderStatus: 'processing',
    orderType: 'pickup',
    pickupType: 'scheduled',
    pickupTime: new Date('2026-05-20T22:15:00.000Z'),
    createdAt: new Date('2026-05-20T19:00:00.000Z'),
    customer: {
      name: 'Scheduled Customer',
      phone: '+1 555 222 3333',
      email: 'scheduled@example.com',
    },
    items: [
      {
        name: 'Veggie Pizza',
        quantity: 1,
        price: 13.99,
        modifiers: ['No olives'],
      },
    ],
    subtotal: 13.99,
    tax: 1.12,
    tip: 2,
    deliveryFee: 0,
    total: 17.11,
    currency: 'USD',
    notes: 'Test paid scheduled pickup order',
  },
];

// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  if (!MONGO_URI) {
    console.error('[SeedSource] ERROR: MONGO_URI is not set in .env');
    process.exit(1);
  }

  console.log(`\n[SeedSource] Connecting to source DB: ${SOURCE_DB_NAME}`);
  console.log(`[SeedSource] Collection: ${SOURCE_COLLECTION}`);

  // Connect to the source database (separate from central DB)
  const conn = await mongoose.createConnection(TEST_SOURCE_DB_URI, {
    dbName: SOURCE_DB_NAME,
  }).asPromise();

  const actualDb = conn.db.databaseName;
  console.log(`[SeedSource] ✓ Connected to: ${actualDb}`);

  // Dynamic schema — matches any shape of order document
  const orderSchema = new mongoose.Schema({}, { strict: false });
  const OrderModel = conn.model('SourceOrder', orderSchema, SOURCE_COLLECTION);

  let inserted = 0;
  let skipped = 0;

  for (const order of TEST_ORDERS) {
    const existing = await OrderModel.findOne({ orderNumber: order.orderNumber });
    if (existing) {
      console.log(`[SeedSource] ✓ Already exists: ${order.orderNumber} (skipped)`);
      skipped++;
    } else {
      await OrderModel.create(order);
      console.log(
        `[SeedSource] ✓ Inserted: ${order.orderNumber} ` +
        `(paymentStatus=${order.paymentStatus}, isASAP=${order.isASAP || false})`
      );
      inserted++;
    }
  }

  // Verify counts
  const totalOrders = await OrderModel.countDocuments();
  const paidOrders  = await OrderModel.countDocuments({ paymentStatus: 'paid' });

  console.log('\n─────────────────────────────────────────');
  console.log('[SeedSource] SOURCE DB SUMMARY');
  console.log(`  Database:     ${actualDb}`);
  console.log(`  Collection:   ${SOURCE_COLLECTION}`);
  console.log(`  Total orders: ${totalOrders}`);
  console.log(`  Paid orders:  ${paidOrders}`);
  console.log(`  Inserted:     ${inserted}`);
  console.log(`  Skipped:      ${skipped}`);
  console.log('─────────────────────────────────────────');
  console.log('\n[SeedSource] ✓ Source orders seeded');
  console.log('\nExpected /api/orders results:');
  console.log('  TEST-1001 → appears  (paid, ASAP)');
  console.log('  TEST-1002 → HIDDEN   (unpaid — must not appear)');
  console.log('  TEST-1003 → appears  (paid, scheduled)\n');

  await conn.close();
}

run().catch((err) => {
  console.error('[SeedSource] FATAL:', err.message);
  process.exit(1);
});
