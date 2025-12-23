const requiredEnvVars = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
];

function ensureFirebaseEnv() {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(
      `Missing Firebase environment variables: ${missing.join(', ')}. ` +
      'Check your .env (and Vercel env vars) for typos.'
    );
  }
}

function getFirebaseConfig() {
  ensureFirebaseEnv();
  return {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID,
  };
}

module.exports = {
  getFirebaseConfig,
};
