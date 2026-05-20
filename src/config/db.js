const mongoose = require('mongoose');

/**
 * Central database name for this application.
 *
 * All central collections (restaurants, restaurantusers, adminusers,
 * devicetokens, orderoverrides) live here.
 *
 * This is completely separate from each restaurant's source database,
 * which is connected on-demand in utils/sourceDb.js.
 */
const CENTRAL_DB_NAME = 'restaurant_order_system_v2';

/**
 * Connect to the central MongoDB database.
 *
 * The dbName option ensures we always use restaurant_order_system_v2
 * regardless of what database name (if any) is in the MONGO_URI string.
 * This prevents accidentally writing to a wrong database.
 */
async function connectCentralDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not defined in environment variables');
  }

  try {
    await mongoose.connect(uri, {
      dbName: CENTRAL_DB_NAME,
    });

    const dbName = mongoose.connection.db.databaseName;
    console.log(`[DB] Connected to central MongoDB`);
    console.log(`[DB] Database: ${dbName}`);

    if (dbName !== CENTRAL_DB_NAME) {
      console.warn(
        `[DB] WARNING: Connected to "${dbName}" but expected "${CENTRAL_DB_NAME}". ` +
        `Check your MONGO_URI or dbName config.`
      );
    }
  } catch (err) {
    console.error('[DB] Central MongoDB connection error:', err.message);
    process.exit(1);
  }
}

module.exports = { connectCentralDB, CENTRAL_DB_NAME };
