// Test the actual frontend and backend interface
const axios = require('axios');

async function testRealInterface() {
  console.log('🌐 TESTING REAL INTERFACE...\n');

  try {
    // Test 1: Check if frontend is accessible
    console.log('1. Testing frontend accessibility...');
    const frontendRes = await axios.get('https://referral-hub-frontend.vercel.app', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    console.log('✅ Frontend accessible:', frontendRes.status);
    console.log('   Content-Type:', frontendRes.headers['content-type']);
    console.log('   Content length:', frontendRes.data.length);
  } catch (err) {
    console.log('❌ Frontend not accessible:', err.message);
  }

  try {
    // Test 2: Test login with real frontend origin
    console.log('\n2. Testing login with frontend origin...');
    const loginRes = await axios.post('https://referral-hub-backend-production.up.railway.app/api/auth/login', {
      email: 'premium@demo.com',
      password: 'demo123',
      platform: 'web',
      device: 'desktop',
      browser: 'Chrome',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      screenSize: { width: 1920, height: 1080 }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://referral-hub-frontend.vercel.app',
        'Referer': 'https://referral-hub-frontend.vercel.app/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    console.log('✅ Login successful with frontend origin');
    console.log('   Token received:', !!loginRes.data.token);
    console.log('   User type:', loginRes.data.user?.type);
  } catch (err) {
    console.log('❌ Login failed with frontend origin:');
    console.log('   Status:', err.response?.status);
    console.log('   Message:', err.response?.data?.message);
    console.log('   Headers:', err.response?.headers);
  }

  try {
    // Test 3: Test CORS preflight
    console.log('\n3. Testing CORS preflight...');
    const optionsRes = await axios.options('https://referral-hub-backend-production.up.railway.app/api/auth/login', {
      headers: {
        'Origin': 'https://referral-hub-frontend.vercel.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    console.log('✅ CORS preflight successful:', optionsRes.status);
  } catch (err) {
    console.log('❌ CORS preflight failed:', err.message);
  }

  console.log('\n📋 INTERFACE TEST SUMMARY:');
  console.log('Frontend URL: https://referral-hub-frontend.vercel.app');
  console.log('Backend URL: https://referral-hub-backend-production.up.railway.app');
  console.log('Demo Login: premium@demo.com / demo123');
}

testRealInterface().catch(console.error);
