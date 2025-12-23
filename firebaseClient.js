const fs = require('fs');
const admin = require('firebase-admin');

let adminApp;

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT environment variable');
  }

  const value = raw.trim();

  // Case 1: inline JSON
  if (value.startsWith('{')) {
    return JSON.parse(value);
  }

  // Case 2: path to JSON file
  if (fs.existsSync(value)) {
    const fileContents = fs.readFileSync(value, 'utf8');
    return JSON.parse(fileContents);
  }

  // Case 3: base64-encoded JSON
  const decoded = Buffer.from(value, 'base64').toString('utf8');
  return JSON.parse(decoded);
}

function initializeFirebaseAdmin() {
  if (admin.apps.length) {
    return admin.app();
  }

  const credentials = parseServiceAccount();
  if (!process.env.FIREBASE_STORAGE_BUCKET) {
    throw new Error('FIREBASE_STORAGE_BUCKET must be set to your Firebase Storage bucket name');
  }

  adminApp = admin.initializeApp({
    credential: admin.credential.cert(credentials),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });

  return adminApp;
}

const app = initializeFirebaseAdmin();
const db = admin.firestore();
const bucket = admin.storage().bucket();

module.exports = {
  admin,
  app,
  db,
  bucket,
};
