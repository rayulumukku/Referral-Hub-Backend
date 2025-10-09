const { spawn } = require('child_process');
const path = require('path');

console.log('Starting REF-HUB Development Server...\n');

// Set environment variables
process.env.PORT = '5001';
process.env.NODE_ENV = 'development';

// Load environment variables from .env file if it exists
try {
  require('dotenv').config();
  console.log('✓ Environment variables loaded');
} catch (err) {
  console.log('⚠ No .env file found, using defaults');
}

// Check required environment variables
const required = ['MONGODB_URI', 'JWT_SECRET'];
const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('\n❌ Missing required environment variables:');
  missing.forEach(key => console.error(`   - ${key}`));
  console.error('\nPlease create a .env file in the BACKEND directory with:');
  console.error('MONGODB_URI=your_mongodb_connection_string');
  console.error('JWT_SECRET=your_secret_key\n');
  process.exit(1);
}

console.log('✓ All required environment variables are set');
console.log(`✓ Server will run on http://localhost:${process.env.PORT || 5001}`);
console.log(`✓ Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
console.log('\nStarting server...\n');

// Start the server
const server = spawn('node', ['server.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: process.env
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  if (code !== 0) {
    console.error(`Server exited with code ${code}`);
    process.exit(code);
  }
});

// Handle termination
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down server...');
  server.kill('SIGTERM');
  process.exit(0);
});

