// Generate bcrypt hash for a password
// Usage: node generate-hash.js yourpassword

const bcrypt = require('bcrypt');

const password = process.argv[2];

if (!password) {
  console.error('❌ Please provide a password as an argument');
  console.log('Usage: node generate-hash.js yourpassword');
  process.exit(1);
}

(async () => {
  try {
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);
    
    console.log('\n✅ Password hashed successfully!\n');
    console.log('Copy this hash and replace ADMIN_PASSWORD in your .env file:\n');
    console.log(hash);
    console.log('\nYour .env should look like:');
    console.log('ADMIN_USERNAME=sophia');
    console.log(`ADMIN_PASSWORD=${hash}`);
    console.log('SESSION_SECRET=erdSJJf0oeixyKBgwR1LVDREiZgPbQD9\n');
  } catch (error) {
    console.error('❌ Error hashing password:', error);
  }
})();
