// Quick test to see what errors occur during startup
console.log('Testing server startup...\n');

try {
  console.log('1. Loading dotenv...');
  require('dotenv').config();
  console.log('   ✓ Dotenv loaded');
  console.log('   MongoDB URI:', process.env.MONGODB_URI ? 'Set' : 'NOT SET');
  console.log('   JWT Secret:', process.env.JWT_SECRET ? 'Set' : 'NOT SET');
  
  console.log('\n2. Loading express...');
  const express = require('express');
  console.log('   ✓ Express loaded');
  
  console.log('\n3. Loading mongoose...');
  const mongoose = require('mongoose');
  console.log('   ✓ Mongoose loaded');
  
  console.log('\n4. Loading models...');
  const User = require('./models/User');
  console.log('   ✓ User model loaded');
  const Post = require('./models/Post');
  console.log('   ✓ Post model loaded');
  const ReferralChain = require('./models/ReferralChain');
  console.log('   ✓ ReferralChain model loaded');
  const Referral = require('./models/Referral');
  console.log('   ✓ Referral model loaded');
  
  console.log('\n5. Loading services...');
  const ComprehensiveReferralChainService = require('./services/comprehensiveReferralChainService');
  console.log('   ✓ ComprehensiveReferralChainService loaded');
  
  console.log('\n6. Loading routes...');
  const comprehensiveReferralsRouter = require('./routes/comprehensiveReferrals');
  console.log('   ✓ ComprehensiveReferrals route loaded');
  
  console.log('\n✅ All modules loaded successfully!');
  console.log('\nNow testing MongoDB connection...');
  
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      console.log('✓ MongoDB connected successfully!');
      console.log('\n✅ Everything is working! You can start the server now.');
      process.exit(0);
    })
    .catch(err => {
      console.error('✗ MongoDB connection failed:', err.message);
      process.exit(1);
    });
  
} catch (error) {
  console.error('\n✗ Error during startup:', error.message);
  console.error('\nStack trace:');
  console.error(error.stack);
  process.exit(1);
}

