// Simple test to identify the exact error
console.log('Starting server test...\n');

try {
  require('dotenv').config();
  console.log('✓ Environment loaded');
  
  const express = require('express');
  const app = express();
  const http = require('http');
  const server = http.createServer(app);
  
  console.log('✓ Express app created');
  
  app.use(express.json());
  console.log('✓ JSON middleware added');
  
  // Test problematic line
  console.log('\nTesting CORS preflight...');
  const cors = require('cors');
  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      cors()(req, res, next);
    } else {
      next();
    }
  });
  console.log('✓ CORS preflight works');
  
  // Test 404 handler
  console.log('\nTesting 404 handler...');
  app.use((req, res) => {
    res.status(404).json({ message: 'Not found' });
  });
  console.log('✓ 404 handler works');
  
  // Try to start server
  console.log('\nStarting server on port 5001...');
  server.listen(5001, () => {
    console.log('✅ Server started successfully on port 5001!');
    console.log('\nNow loading full server.js...');
    server.close();
    
    // Now try loading the actual server
    setTimeout(() => {
      console.log('\n' + '='.repeat(50));
      console.log('Loading actual server.js...');
      console.log('='.repeat(50) + '\n');
      require('./server.js');
    }, 500);
  });
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error('\nStack:');
  console.error(error.stack);
  process.exit(1);
}

