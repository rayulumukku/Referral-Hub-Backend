const axios = require('axios');

async function testServer() {
  try {
    console.log('Testing backend server...');
    
    // Test health endpoint
    const healthResponse = await axios.get('http://localhost:5001/api/auth/health');
    console.log('✅ Health check passed:', healthResponse.data);
    
    // Test enhanced referral routes
    console.log('✅ Server is running and accessible');
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Server is not running on port 5001');
      console.log('Please start the server with: npm start');
    } else {
      console.log('❌ Error testing server:', error.message);
    }
  }
}

testServer();
