const mongoose = require('mongoose');

/**
 * Cache of open connections keyed by restaurantKey.
 * We reuse connections across cron runs to avoid reconnect overhead.
 */
const connectionCache = new Map();

/**
 * Get (or create) a Mongoose connection to a restaurant's source database.
 *
 * IMPORTANT: The mobile app NEVER calls this. Only the backend (cron + order
 * fetch routes) connects to source databases.
 *
 * @param {object} restaurant - Restaurant document from central DB
 * @returns {mongoose.Connection}
 */
async function getSourceDbConnection(restaurant) {
  const key = restaurant.restaurantKey;

  if (connectionCache.has(key)) {
    const cached = connectionCache.get(key);
    // readyState: 1 = connected
    if (cached.readyState === 1) {
      return cached;
    }
    // Stale connection – remove and reconnect
    connectionCache.delete(key);
  }

  // Log DB name and collection but NOT the full URI (may contain credentials)
  console.log(
    `[SourceDB] Connecting to restaurant="${restaurant.name}" key="${key}" ` +
    `db="${restaurant.sourceDbName}" collection="${restaurant.sourceOrderCollection}"`
  );

  const conn = await mongoose.createConnection(restaurant.sourceDbUri, {
    dbName: restaurant.sourceDbName,
  }).asPromise();

  connectionCache.set(key, conn);
  console.log(`[SourceDB] Connected: restaurant="${restaurant.name}" db="${restaurant.sourceDbName}"`);
  return conn;
}

/**
 * Close and remove a cached connection (e.g. when a restaurant is deactivated).
 */
async function closeSourceDbConnection(restaurantKey) {
  if (connectionCache.has(restaurantKey)) {
    const conn = connectionCache.get(restaurantKey);
    await conn.close();
    connectionCache.delete(restaurantKey);
    console.log(`[SourceDB] Closed connection for key="${restaurantKey}"`);
  }
}

/**
 * Fetch paid orders from a restaurant's source database.
 *
 * @param {object} restaurant - Restaurant document
 * @param {object} options    - { limit, sinceId }
 * @returns {Array}           - Raw order documents
 */
async function fetchPaidOrdersFromSource(restaurant, options = {}) {
  const { limit = 100 } = options;

  const conn = await getSourceDbConnection(restaurant);

  // Build a dynamic model for the orders collection
  // Use a unique model name per connection to avoid Mongoose model cache conflicts
  const modelName = `Order_${restaurant.restaurantKey}`;
  let OrderModel;
  try {
    OrderModel = conn.model(modelName);
  } catch {
    // Model not registered yet on this connection
    const schema = new mongoose.Schema({}, { strict: false });
    OrderModel = conn.model(modelName, schema, restaurant.sourceOrderCollection);
  }

  const paymentField = restaurant.sourcePaymentStatusField || 'paymentStatus';
  const paidValue = restaurant.sourcePaidValue || 'paid';

  const query = { [paymentField]: paidValue };

  const orders = await OrderModel.find(query)
    .sort({ _id: -1 })
    .limit(limit)
    .lean();

  console.log(
    `[SourceDB] restaurant="${restaurant.name}" key="${restaurant.restaurantKey}" ` +
    `db="${restaurant.sourceDbName}" collection="${restaurant.sourceOrderCollection}" ` +
    `paid orders found=${orders.length}`
  );

  return orders;
}

module.exports = {
  getSourceDbConnection,
  closeSourceDbConnection,
  fetchPaidOrdersFromSource,
};
