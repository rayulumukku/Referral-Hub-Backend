// Test script to check backend endpoints
const axios = require('axios');

const BACKEND_URL = 'https://referral-hub-backend-production.up.railway.app';

async function testBackend() {
  console.log('🧪 Testing Backend Endpoints...\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthRes = await axios.get(`${BACKEND_URL}/api/auth/health`);
    console.log('✅ Health check passed');
    console.log('   Database:', healthRes.data.mongo?.state);
    console.log('   Environment:', healthRes.data.env?.NODE_ENV);
  } catch (err) {
    console.log('❌ Health check failed:', err.message);
  }

  try {
    // Test 2: Test endpoint
    console.log('\n2. Testing test endpoint...');
    const testRes = await axios.post(`${BACKEND_URL}/api/auth/test`, {
      test: 'data',
      email: 'test@example.com'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://referral-hub-frontend.vercel.app'
      }
    });
    console.log('✅ Test endpoint passed');
    console.log('   Response:', testRes.data.message);
  } catch (err) {
    console.log('❌ Test endpoint failed:', err.message);
    if (err.response) {
      console.log('   Status:', err.response.status);
      console.log('   Data:', err.response.data);
    }
  }

  try {
    // Test 3: Login with demo user
    console.log('\n3. Testing login endpoint...');
    const loginRes = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      email: 'premium@demo.com',
      password: 'demo123',
      platform: 'web',
      device: 'desktop',
      browser: 'Chrome'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://referral-hub-frontend.vercel.app'
      }
    });
    console.log('✅ Login successful');
    console.log('   Has token:', !!loginRes.data.token);
    console.log('   User:', loginRes.data.user?.email);
  } catch (err) {
    console.log('❌ Login failed:');
    console.log('   Status:', err.response?.status);
    console.log('   Message:', err.response?.data?.message);
    console.log('   Errors:', err.response?.data?.errors);
    if (err.response?.data) {
      console.log('   Full response:', JSON.stringify(err.response.data, null, 2));
    }
  }

  console.log('\n🔧 Railway Environment Variables to Check:');
  console.log('□ MONGODB_URI - MongoDB connection string');
  console.log('□ JWT_SECRET - Strong secret key');
  console.log('□ NODE_ENV - Set to "production"');
  console.log('□ CORS_ORIGINS - Set to "https://referral-hub-frontend.vercel.app"');
}

testBackend().catch(console.error);
