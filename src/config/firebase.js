const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let firebaseInitialized = false;

/**
 * Initialize Firebase Admin SDK.
 * Supports two methods:
 *   1. FIREBASE_SERVICE_ACCOUNT_PATH  – path to a JSON key file
 *   2. FIREBASE_SERVICE_ACCOUNT_BASE64 – base64-encoded JSON (useful for Vercel env vars)
 */
function initFirebase() {
  if (firebaseInitialized) return;

  let credential;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(
      process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
      'base64'
    ).toString('utf8');
    const serviceAccount = JSON.parse(json);
    credential = admin.credential.cert(serviceAccount);
    console.log('[Firebase] Initialized from base64 env var');
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const filePath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (!fs.existsSync(filePath)) {
      console.warn(
        `[Firebase] Service account file not found at ${filePath}. FCM notifications will be disabled.`
      );
      return;
    }
    const serviceAccount = require(filePath);
    credential = admin.credential.cert(serviceAccount);
    console.log('[Firebase] Initialized from service account file');
  } else {
    console.warn(
      '[Firebase] No Firebase credentials provided. FCM notifications will be disabled.'
    );
    return;
  }

  admin.initializeApp({ credential });
  firebaseInitialized = true;
}

function getFirebaseAdmin() {
  if (!firebaseInitialized) {
    console.warn('[Firebase] Firebase not initialized – skipping FCM call');
    return null;
  }
  return admin;
}

module.exports = { initFirebase, getFirebaseAdmin };
