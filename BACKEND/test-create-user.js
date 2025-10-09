// Test creating a user via API
const axios = require('axios');

async function testCreateUser() {
  console.log('🧪 Testing user creation...\n');

  try {
    // Test 1: Try to register a new user
    console.log('1. Testing user registration...');
    const registerRes = await axios.post('https://referral-hub-backend-production.up.railway.app/api/auth/register', {
      email: 'test@demo.com',
      username: 'testuser',
      password: 'demo123',
      type: 'premium'
    });
    console.log('✅ Registration successful:', registerRes.data);
  } catch (err) {
    console.log('❌ Registration failed:', err.response?.data);
  }

  try {
    // Test 2: Try to login with the new user
    console.log('\n2. Testing login with new user...');
    const loginRes = await axios.post('https://referral-hub-backend-production.up.railway.app/api/auth/login', {
      email: 'test@demo.com',
      password: 'demo123'
    });
    console.log('✅ Login successful:', loginRes.data);
  } catch (err) {
    console.log('❌ Login failed:', err.response?.data);
  }

  try {
    // Test 3: Try to login with premium@demo.com (should fail if user doesn't exist)
    console.log('\n3. Testing login with premium@demo.com...');
    const premiumLoginRes = await axios.post('https://referral-hub-backend-production.up.railway.app/api/auth/login', {
      email: 'premium@demo.com',
      password: 'demo123'
    });
    console.log('✅ Premium login successful:', premiumLoginRes.data);
  } catch (err) {
    console.log('❌ Premium login failed:', err.response?.data);
  }
}

testCreateUser();
