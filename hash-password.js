// Script to generate bcrypt password hash
// Run with: node hash-password.js

const bcrypt = require('bcrypt');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter password to hash: ', async (password) => {
  try {
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);
    console.log('\n✅ Hashed password:');
    console.log(hash);
    console.log('\nCopy this hash and paste it as ADMIN_PASSWORD in your .env file');
  } catch (error) {
    console.error('Error hashing password:', error);
  }
  rl.close();
});
