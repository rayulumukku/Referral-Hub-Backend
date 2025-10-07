// Check if demo users exist in production
const axios = require('axios');

async function checkDemoUsers() {
  console.log('🔍 Checking demo users in production...\n');

  try {
    // Test 1: Check if debug login works
    console.log('1. Testing debug login...');
    const debugRes = await axios.post('https://referral-hub-backend-production.up.railway.app/api/auth/debug-login', {
      email: 'premium@demo.com',
      password: 'demo123'
    });
    console.log('✅ Debug login successful:', debugRes.data);
  } catch (err) {
    console.log('❌ Debug login failed:', err.response?.data);
  }

  try {
    // Test 2: Check if simple login works
    console.log('\n2. Testing simple login...');
    const simpleRes = await axios.post('https://referral-hub-backend-production.up.railway.app/api/auth/simple-login', {
      email: 'premium@demo.com',
      password: 'demo123'
    });
    console.log('✅ Simple login successful:', simpleRes.data);
  } catch (err) {
    console.log('❌ Simple login failed:', err.response?.data);
  }

  try {
    // Test 3: Try to seed demo users
    console.log('\n3. Attempting to seed demo users...');
    const seedRes = await axios.post('https://referral-hub-backend-production.up.railway.app/api/auth/seed-demo-users');
    console.log('✅ Seed successful:', seedRes.data);
  } catch (err) {
    console.log('❌ Seed failed:', err.response?.data);
  }

  console.log('\n📋 Next Steps:');
  console.log('1. If demo users don\'t exist, run the force-create script');
  console.log('2. Test with simple-login endpoint');
  console.log('3. Update frontend to use simple-login if needed');
}

checkDemoUsers();
