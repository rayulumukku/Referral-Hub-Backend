/**
 * Quick Setup Checker
 * Run this to verify your environment is ready
 */

const fs = require('fs');
const path = require('path');

console.log('═══════════════════════════════════════════════════════════');
console.log('  REF-HUB Setup Checker');
console.log('═══════════════════════════════════════════════════════════\n');

let errors = 0;
let warnings = 0;

// Check Node version
console.log('1. Checking Node.js version...');
const nodeVersion = process.version;
console.log(`   ✓ Node.js ${nodeVersion} detected`);
if (parseInt(nodeVersion.slice(1)) < 14) {
  console.log('   ⚠ Warning: Node.js 14+ recommended');
  warnings++;
}

// Check if .env exists
console.log('\n2. Checking .env file...');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('   ✓ .env file found');
  
  // Load and check environment variables
  require('dotenv').config();
  
  const requiredVars = ['MONGODB_URI', 'JWT_SECRET'];
  const missing = [];
  
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });
  
  if (missing.length > 0) {
    console.log('   ✗ Missing required variables:');
    missing.forEach(v => console.log(`     - ${v}`));
    errors++;
  } else {
    console.log('   ✓ All required variables set');
  }
} else {
  console.log('   ✗ .env file NOT found!');
  console.log('   → Please create .env file with:');
  console.log('     MONGODB_URI=your_mongodb_connection_string');
  console.log('     JWT_SECRET=your_secret_key');
  console.log('     PORT=5001');
  errors++;
}

// Check if node_modules exists
console.log('\n3. Checking dependencies...');
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log('   ✓ node_modules found');
} else {
  console.log('   ✗ node_modules NOT found!');
  console.log('   → Please run: npm install');
  errors++;
}

// Check critical files
console.log('\n4. Checking critical files...');
const criticalFiles = [
  'server.js',
  'models/Post.js',
  'models/User.js',
  'models/ReferralChain.js',
  'routes/comprehensiveReferrals.js',
  'services/comprehensiveReferralChainService.js'
];

criticalFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✓ ${file}`);
  } else {
    console.log(`   ✗ ${file} NOT found!`);
    errors++;
  }
});

// Check port availability
console.log('\n5. Checking port 5001...');
const net = require('net');
const server = net.createServer();

server.once('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('   ⚠ Port 5001 is already in use!');
    console.log('   → Another process is using this port');
    console.log('   → Stop the other process or use a different port');
    warnings++;
  }
});

server.once('listening', () => {
  console.log('   ✓ Port 5001 is available');
  server.close();
});

server.listen(5001);

// Summary
setTimeout(() => {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  if (errors === 0 && warnings === 0) {
    console.log('✅ All checks passed! You are ready to start the server.');
    console.log('\nRun: npm start');
  } else {
    if (errors > 0) {
      console.log(`❌ ${errors} error(s) found. Please fix them before starting.`);
    }
    if (warnings > 0) {
      console.log(`⚠  ${warnings} warning(s) found. Review them if you have issues.`);
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  Quick Fixes:');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (!fs.existsSync(envPath)) {
      console.log('1. Create .env file:');
      console.log('   → Copy env.example to .env');
      console.log('   → Fill in your MongoDB URI and JWT secret\n');
    }
    
    if (!fs.existsSync(nodeModulesPath)) {
      console.log('2. Install dependencies:');
      console.log('   → npm install\n');
    }
  }
  
  console.log('═══════════════════════════════════════════════════════════\n');
  process.exit(errors > 0 ? 1 : 0);
}, 1000);

