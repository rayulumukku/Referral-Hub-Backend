const mongoose = require('mongoose');
const ReferralChain = require('./models/ReferralChain');
const Referral = require('./models/Referral');
const User = require('./models/User');
const Post = require('./models/Post');
const Commission = require('./models/Commission');
const ComprehensiveReferralTrackingService = require('./services/comprehensiveReferralTrackingService');
const EnhancedCommissionService = require('./services/enhancedCommissionService');

// Test configuration
const TEST_CONFIG = {
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb+srv://test:test123@cluster0.mongodb.net/referralhub-test?retryWrites=true&w=majority',
  TEST_POST_ID: null,
  TEST_USERS: [],
  TEST_CHAINS: []
};

async function connectToDatabase() {
  try {
    await mongoose.connect(TEST_CONFIG.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}

async function createTestUsers() {
  console.log('\n📝 Creating test users...');
  
  const users = [
    {
      email: 'testuser1@example.com',
      username: 'testuser1',
      password: 'password123',
      type: 'individual'
    },
    {
      email: 'testuser2@example.com',
      username: 'testuser2',
      password: 'password123',
      type: 'individual'
    },
    {
      email: 'testuser3@example.com',
      username: 'testuser3',
      password: 'password123',
      type: 'individual'
    },
    {
      email: 'testuser4@example.com',
      username: 'testuser4',
      password: 'password123',
      type: 'individual'
    }
  ];

  for (const userData of users) {
    try {
      // Check if user already exists
      let user = await User.findOne({ email: userData.email });
      if (!user) {
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(userData.password, salt);
        
        user = new User({
          ...userData,
          password: hashedPassword,
          credits: 100
        });
        await user.save();
        console.log(`✅ Created user: ${userData.email}`);
      } else {
        console.log(`ℹ️  User already exists: ${userData.email}`);
      }
      TEST_CONFIG.TEST_USERS.push(user);
    } catch (error) {
      console.error(`❌ Error creating user ${userData.email}:`, error);
    }
  }
}

async function createTestPost() {
  console.log('\n📝 Creating test post...');
  
  try {
    const post = new Post({
      creator: TEST_CONFIG.TEST_USERS[0]._id,
      title: 'Test Product - Enhanced Referral System',
      description: 'This is a test product for the enhanced referral system',
      category: 'product',
      price: 1000,
      pointsPool: 1000,
      platformFee: 100,
      distributablePoints: 900,
      status: 'active'
    });
    
    await post.save();
    TEST_CONFIG.TEST_POST_ID = post._id;
    console.log(`✅ Created test post: ${post.title} (ID: ${post._id})`);
  } catch (error) {
    console.error('❌ Error creating test post:', error);
  }
}

async function testReferralChainTracking() {
  console.log('\n🔗 Testing referral chain tracking...');
  
  try {
    const [userA, userB, userC, userD] = TEST_CONFIG.TEST_USERS;
    const postId = TEST_CONFIG.TEST_POST_ID;

    // User A creates and shares post
    console.log('👤 User A creates and shares post');
    const shareResult1 = await ComprehensiveReferralTrackingService.trackReferralClick({
      postId,
      referrerId: userA._id,
      refereeId: userA._id,
      platform: 'web',
      device: 'desktop',
      browser: 'chrome',
      userAgent: 'Mozilla/5.0',
      screenSize: { width: 1920, height: 1080 },
      coordinates: { latitude: 19.0760, longitude: 72.8777, accuracy: 10 },
      ipAddress: '192.168.1.1',
      sessionId: 'session_1',
      language: 'en',
      parentReferralId: null,
      fromLocation: { city: 'Mumbai', state: 'Maharashtra', country: 'India' },
      toLocation: { city: 'Mumbai', state: 'Maharashtra', country: 'India' },
      interactionType: 'click',
      duration: 5000,
      scrollDepth: 75
    });

    console.log('✅ User A referral tracked');

    // User B clicks on User A's link
    console.log('👤 User B clicks on User A\'s link');
    const shareResult2 = await ComprehensiveReferralTrackingService.trackReferralClick({
      postId,
      referrerId: userA._id,
      refereeId: userB._id,
      platform: 'whatsapp',
      device: 'mobile',
      browser: 'chrome',
      userAgent: 'Mozilla/5.0',
      screenSize: { width: 375, height: 667 },
      coordinates: { latitude: 19.0760, longitude: 72.8777, accuracy: 10 },
      ipAddress: '192.168.1.2',
      sessionId: 'session_2',
      language: 'en',
      parentReferralId: shareResult1.referral._id,
      fromLocation: { city: 'Mumbai', state: 'Maharashtra', country: 'India' },
      toLocation: { city: 'Delhi', state: 'Delhi', country: 'India' },
      interactionType: 'click',
      duration: 3000,
      scrollDepth: 50
    });

    console.log('✅ User B referral tracked');

    // User C clicks on User B's link
    console.log('👤 User C clicks on User B\'s link');
    const shareResult3 = await ComprehensiveReferralTrackingService.trackReferralClick({
      postId,
      referrerId: userB._id,
      refereeId: userC._id,
      platform: 'linkedin',
      device: 'desktop',
      browser: 'firefox',
      userAgent: 'Mozilla/5.0',
      screenSize: { width: 1366, height: 768 },
      coordinates: { latitude: 28.7041, longitude: 77.1025, accuracy: 10 },
      ipAddress: '192.168.1.3',
      sessionId: 'session_3',
      language: 'en',
      parentReferralId: shareResult2.referral._id,
      fromLocation: { city: 'Delhi', state: 'Delhi', country: 'India' },
      toLocation: { city: 'Bangalore', state: 'Karnataka', country: 'India' },
      interactionType: 'click',
      duration: 8000,
      scrollDepth: 90
    });

    console.log('✅ User C referral tracked');

    // User D clicks on User C's link
    console.log('👤 User D clicks on User C\'s link');
    const shareResult4 = await ComprehensiveReferralTrackingService.trackReferralClick({
      postId,
      referrerId: userC._id,
      refereeId: userD._id,
      platform: 'twitter',
      device: 'mobile',
      browser: 'safari',
      userAgent: 'Mozilla/5.0',
      screenSize: { width: 414, height: 896 },
      coordinates: { latitude: 12.9716, longitude: 77.5946, accuracy: 10 },
      ipAddress: '192.168.1.4',
      sessionId: 'session_4',
      language: 'en',
      parentReferralId: shareResult3.referral._id,
      fromLocation: { city: 'Bangalore', state: 'Karnataka', country: 'India' },
      toLocation: { city: 'Chennai', state: 'Tamil Nadu', country: 'India' },
      interactionType: 'click',
      duration: 12000,
      scrollDepth: 100
    });

    console.log('✅ User D referral tracked');

    // Test share tracking
    console.log('📤 Testing share tracking...');
    await ComprehensiveReferralTrackingService.trackShare({
      postId,
      referrerId: userB._id,
      platform: 'whatsapp',
      device: 'mobile',
      browser: 'chrome',
      coordinates: { latitude: 28.7041, longitude: 77.1025 },
      parentReferralId: shareResult2.referral._id,
      toLocation: { city: 'Delhi', state: 'Delhi', country: 'India' }
    });

    console.log('✅ Share tracking completed');

    // Test interaction tracking
    console.log('🖱️  Testing interaction tracking...');
    await ComprehensiveReferralTrackingService.trackInteraction({
      postId,
      referrerId: userC._id,
      interactionType: 'scroll',
      duration: 2000,
      scrollDepth: 60,
      parentReferralId: shareResult3.referral._id
    });

    console.log('✅ Interaction tracking completed');

    TEST_CONFIG.TEST_CHAINS.push(shareResult1.chain);
    console.log('✅ Referral chain tracking test completed');
  } catch (error) {
    console.error('❌ Error in referral chain tracking test:', error);
  }
}

async function testCommissionDistribution() {
  console.log('\n💰 Testing commission distribution...');
  
  try {
    const postId = TEST_CONFIG.TEST_POST_ID;
    const buyerUserId = TEST_CONFIG.TEST_USERS[3]._id; // User D buys the product
    const soldPrice = 1000;
    const soldAt = new Date();

    console.log(`🛒 User D (${TEST_CONFIG.TEST_USERS[3].username}) buys the product for $${soldPrice}`);

    const result = await EnhancedCommissionService.distributeCommissions(
      postId,
      buyerUserId,
      soldPrice,
      soldAt
    );

    console.log('✅ Commission distribution result:', {
      success: result.success,
      totalDistributed: result.totalDistributed,
      chainsProcessed: result.chainsProcessed
    });

    // Check commission records
    const commissions = await Commission.find({ post: postId });
    console.log(`📊 Created ${commissions.length} commission records`);

    for (const commission of commissions) {
      const user = await User.findById(commission.recipient);
      console.log(`💰 User ${user.username} earned $${commission.amount} (Level ${commission.level})`);
    }

    console.log('✅ Commission distribution test completed');
  } catch (error) {
    console.error('❌ Error in commission distribution test:', error);
  }
}

async function testAnalytics() {
  console.log('\n📊 Testing analytics...');
  
  try {
    const postId = TEST_CONFIG.TEST_POST_ID;

    // Get post analytics
    const analytics = await ComprehensiveReferralTrackingService.getPostAnalytics(postId);
    console.log('📈 Post Analytics:', {
      totalChains: analytics.totalChains,
      totalClicks: analytics.totalClicks,
      totalViews: analytics.totalViews,
      totalShares: analytics.totalShares,
      uniqueUsers: analytics.uniqueUsers,
      conversionRate: analytics.conversionRate
    });

    // Get commission analytics
    const commissionAnalytics = await EnhancedCommissionService.getCommissionAnalytics(postId);
    console.log('💰 Commission Analytics:', {
      totalChains: commissionAnalytics.totalChains,
      totalCommissions: commissionAnalytics.totalCommissions,
      totalDistributed: commissionAnalytics.totalDistributed,
      conversionRate: commissionAnalytics.conversionRate
    });

    console.log('✅ Analytics test completed');
  } catch (error) {
    console.error('❌ Error in analytics test:', error);
  }
}

async function testUserChains() {
  console.log('\n👥 Testing user chains...');
  
  try {
    for (const user of TEST_CONFIG.TEST_USERS) {
      const chains = await ComprehensiveReferralTrackingService.getUserReferralChains(user._id);
      console.log(`👤 User ${user.username} has ${chains.length} referral chains`);
      
      for (const chain of chains) {
        console.log(`  📊 Chain: ${chain.chainLength} members, ${chain.totalClicks} clicks, ${chain.totalViews} views`);
      }
    }

    console.log('✅ User chains test completed');
  } catch (error) {
    console.error('❌ Error in user chains test:', error);
  }
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    // Delete test users
    await User.deleteMany({ email: { $in: ['testuser1@example.com', 'testuser2@example.com', 'testuser3@example.com', 'testuser4@example.com'] } });
    console.log('✅ Test users deleted');

    // Delete test post
    if (TEST_CONFIG.TEST_POST_ID) {
      await Post.findByIdAndDelete(TEST_CONFIG.TEST_POST_ID);
      console.log('✅ Test post deleted');
    }

    // Delete referral chains
    await ReferralChain.deleteMany({ post: TEST_CONFIG.TEST_POST_ID });
    console.log('✅ Referral chains deleted');

    // Delete referrals
    await Referral.deleteMany({ post: TEST_CONFIG.TEST_POST_ID });
    console.log('✅ Referrals deleted');

    // Delete commissions
    await Commission.deleteMany({ post: TEST_CONFIG.TEST_POST_ID });
    console.log('✅ Commissions deleted');

    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Error in cleanup:', error);
  }
}

async function runTests() {
  console.log('🚀 Starting Enhanced Referral System Tests\n');
  
  try {
    await connectToDatabase();
    await createTestUsers();
    await createTestPost();
    await testReferralChainTracking();
    await testCommissionDistribution();
    await testAnalytics();
    await testUserChains();
    
    console.log('\n✅ All tests completed successfully!');
    
    // Ask if user wants to cleanup
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('\n🧹 Do you want to cleanup test data? (y/n): ', async (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        await cleanup();
      }
      rl.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = {
  runTests,
  connectToDatabase,
  createTestUsers,
  createTestPost,
  testReferralChainTracking,
  testCommissionDistribution,
  testAnalytics,
  testUserChains,
  cleanup
};
