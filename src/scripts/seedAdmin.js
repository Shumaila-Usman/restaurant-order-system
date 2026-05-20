/**
 * Seed script: create the first admin user.
 *
 * Usage:
 *   node src/scripts/seedAdmin.js
 *
 * Set ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME in your .env or pass as env vars:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret123 node src/scripts/seedAdmin.js
 */
require('dotenv').config();

const mongoose = require('mongoose');
const AdminUser = require('../models/AdminUser');

async function seed() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not set in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to central MongoDB');

  const email = process.env.ADMIN_EMAIL || 'admin@restaurant.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin1234!';
  const name = process.env.ADMIN_NAME || 'Super Admin';

  const existing = await AdminUser.findOne({ email });
  if (existing) {
    console.log(`Admin already exists: ${email}`);
    await mongoose.disconnect();
    return;
  }

  // passwordHash is set to plain text; the pre-save hook hashes it
  const admin = await AdminUser.create({
    name,
    email,
    passwordHash: password,
    role: 'superadmin',
    isActive: true,
  });

  console.log(`✓ Admin created:`);
  console.log(`  Email:    ${admin.email}`);
  console.log(`  Name:     ${admin.name}`);
  console.log(`  Role:     ${admin.role}`);
  console.log(`  Password: ${password}  ← change this immediately after first login`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
