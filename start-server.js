const mongoose = require('mongoose');
require('dotenv').config();

// Check environment variables
console.log('🔍 Checking environment variables...');
if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set!');
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET is not set! Using fallback secret.');
}

console.log('✅ Environment variables checked');

// Test database connection
async function testDatabase() {
  try {
    console.log('🔗 Testing database connection...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Database connected successfully');
    
    // Test a simple query
    const User = require('./models/User');
    const userCount = await User.countDocuments();
    console.log(`📊 Found ${userCount} users in database`);
    
    await mongoose.disconnect();
    console.log('✅ Database test completed');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

// Start the server
async function startServer() {
  try {
    console.log('🚀 Starting server...');
    
    // Test database first
    await testDatabase();
    
    // Start the actual server
    require('./server.js');
    
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
