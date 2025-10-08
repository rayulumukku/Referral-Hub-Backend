const http = require('http');

// Test server connection
function testServerConnection() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5001,
      path: '/api/auth/health',
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: response,
            success: res.statusCode === 200
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            data: data,
            success: false,
            error: error.message
          });
        }
      });
    });

    req.on('error', (error) => {
      reject({
        success: false,
        error: error.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject({
        success: false,
        error: 'Request timeout'
      });
    });

    req.end();
  });
}

async function runConnectionTest() {
  console.log('🔍 Testing server connection...');
  
  try {
    const result = await testServerConnection();
    
    if (result.success) {
      console.log('✅ Server is running and responding');
      console.log('📊 Server Status:', result.data);
    } else {
      console.log('❌ Server connection failed');
      console.log('Status:', result.status);
      console.log('Data:', result.data);
      if (result.error) {
        console.log('Error:', result.error);
      }
    }
  } catch (error) {
    console.log('❌ Server connection test failed:', error);
  }
}

// Run the test
runConnectionTest();
