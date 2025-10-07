// Force create demo users - run this to fix the login issue
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function forceCreateDemoUsers() {
  try {
    console.log('🔧 Force creating demo users...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/referralhub');
    console.log('✅ Connected to database');
    
    // Delete existing demo users
    await User.deleteMany({ email: { $in: ['premium@demo.com', 'superpremium@demo.com'] } });
    console.log('🗑️ Deleted existing demo users');
    
    // Create premium user with simple password hash
    const hashedPassword = await bcrypt.hash('demo123', 10);
    
    const premiumUser = new User({
      email: 'premium@demo.com',
      username: 'premiumdemo',
      password: hashedPassword,
      type: 'premium',
      isVerified: true,
      credits: 1000,
      profile: {
        name: 'Premium Demo User',
        company: 'Demo Company',
        location: 'Demo City'
      },
      kyc: {
        status: 'approved',
        submittedAt: new Date(),
        reviewedAt: new Date(),
        reviewedBy: 'system'
      }
    });
    
    await premiumUser.save();
    console.log('✅ Premium demo user created: premium@demo.com / demo123');
    
    // Test the user
    const testUser = await User.findOne({ email: 'premium@demo.com' });
    if (testUser) {
      const passwordMatch = await bcrypt.compare('demo123', testUser.password);
      console.log('✅ User verification:');
      console.log('   - User exists:', !!testUser);
      console.log('   - Password matches:', passwordMatch);
      console.log('   - Email:', testUser.email);
      console.log('   - Type:', testUser.type);
    }
    
    console.log('🎉 Demo users created successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error creating demo users:', error);
    process.exit(1);
  }
}

forceCreateDemoUsers();
