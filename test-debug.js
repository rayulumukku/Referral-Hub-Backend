// Quick debug test for login
const axios = require('axios');

async function testDebugLogin() {
  console.log('🧪 Testing Debug Login...\n');

  try {
    const response = await axios.post('https://referral-hub-backend-production.up.railway.app/api/auth/debug-login', {
      email: 'premium@demo.com',
      password: 'demo123'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://referral-hub-frontend.vercel.app'
      }
    });
    
    console.log('✅ Debug login successful:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Debug login failed:');
    console.log('Status:', error.response?.status);
    console.log('Data:', JSON.stringify(error.response?.data, null, 2));
  }
}

testDebugLogin();
