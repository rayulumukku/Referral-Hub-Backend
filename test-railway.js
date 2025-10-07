// Test script for Railway deployment debugging
const axios = require('axios');

async function testRailwayDeployment() {
  console.log('🔍 Testing Railway Deployment...\n');

  // Get Railway URL from environment or use placeholder
  const RAILWAY_URL = process.env.RAILWAY_URL || 'https://your-app-name.railway.app';
  
  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthRes = await axios.get(`${RAILWAY_URL}/api/auth/health`);
    console.log('✅ Health check passed:');
    console.log('   - Database:', healthRes.data.mongo?.state);
    console.log('   - Environment:', healthRes.data.env?.NODE_ENV);
    console.log('   - JWT Secret:', healthRes.data.env?.JWT_SECRET_SET ? 'Set' : 'Missing');
    console.log('   - MongoDB URI:', healthRes.data.env?.MONGODB_URI_SET ? 'Set' : 'Missing');
    console.log('   - CORS Origins:', healthRes.data.env?.CORS_ORIGINS);
  } catch (err) {
    console.log('❌ Health check failed:', err.message);
    if (err.response) {
      console.log('   Status:', err.response.status);
      console.log('   Data:', err.response.data);
    }
  }

  try {
    // Test 2: Login with demo user
    console.log('\n2. Testing login endpoint...');
    const loginRes = await axios.post(`${RAILWAY_URL}/api/auth/login`, {
      email: 'premium@demo.com',
      password: 'demo123',
      platform: 'web',
      device: 'desktop',
      browser: 'Chrome'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://test.vercel.app'
      }
    });
    console.log('✅ Login successful:', { 
      hasToken: !!loginRes.data.token, 
      user: loginRes.data.user?.email 
    });
  } catch (err) {
    console.log('❌ Login failed:');
    console.log('   Status:', err.response?.status);
    console.log('   Message:', err.response?.data?.message);
    console.log('   Errors:', err.response?.data?.errors);
    if (err.response?.data) {
      console.log('   Full response:', JSON.stringify(err.response.data, null, 2));
    }
  }

  try {
    // Test 3: CORS preflight
    console.log('\n3. Testing CORS preflight...');
    const optionsRes = await axios.options(`${RAILWAY_URL}/api/auth/login`, {
      headers: {
        'Origin': 'https://test.vercel.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    console.log('✅ CORS preflight successful');
  } catch (err) {
    console.log('❌ CORS preflight failed:', err.message);
  }

  console.log('\n📋 Railway Environment Variables Checklist:');
  console.log('□ MONGODB_URI - MongoDB connection string');
  console.log('□ JWT_SECRET - Strong secret key (32+ characters)');
  console.log('□ NODE_ENV - Set to "production"');
  console.log('□ CORS_ORIGINS - Comma-separated list of allowed origins');
  console.log('□ PORT - Railway will set this automatically');
  
  console.log('\n🔧 Common Railway Issues:');
  console.log('1. Check Railway logs: railway logs');
  console.log('2. Verify environment variables in Railway dashboard');
  console.log('3. Ensure MongoDB Atlas allows Railway IPs');
  console.log('4. Check CORS origins match your frontend domain');
}

// Run the test
testRailwayDeployment().catch(console.error);
