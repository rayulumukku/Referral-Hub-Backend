const fs = require('fs');
const path = require('path');

// Create .env file if it doesn't exist
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, 'env.example');

if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file from template...');
  
  const envContent = `# Database
MONGODB_URI=mongodb://localhost:27017/referralhub

# JWT Secret
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production_123456789

# Environment
NODE_ENV=development

# Server
PORT=5001

# CORS Origins
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Frontend URL
FRONTEND_URL=http://localhost:3000
`;

  try {
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env file created successfully');
  } catch (error) {
    console.error('❌ Failed to create .env file:', error.message);
  }
} else {
  console.log('✅ .env file already exists');
}

// Check if MongoDB is running locally
const mongoose = require('mongoose');

async function checkMongoConnection() {
  try {
    console.log('🔍 Checking MongoDB connection...');
    await mongoose.connect('mongodb://localhost:27017/referralhub');
    console.log('✅ MongoDB connection successful');
    await mongoose.disconnect();
  } catch (error) {
    console.warn('⚠️  MongoDB connection failed:', error.message);
    console.log('💡 Make sure MongoDB is running locally or update MONGODB_URI in .env');
  }
}

checkMongoConnection();
