/**
 * Comprehensive Test for Referral Chain System
 * 
 * This test simulates the complete flow:
 * 1. User A creates a post (views = 1, clicks = 1)
 * 2. User A shares to User B
 * 3. User B clicks and registers
 * 4. User B shares to User C
 * 5. User C clicks and registers
 * 6. User C shares to User D
 * 7. User D clicks and registers
 * 8. User D purchases the product
 * 9. Commission distribution: B gets 20%, C gets 30%, remaining 50% split
 */

const axios = require('axios');
require('dotenv').config();

const API_BASE = process.env.API_URL || 'http://localhost:5001/api';

// Test users
const users = {
  A: { email: 'userA@test.com', username: 'userA', password: 'test123', name: 'User A' },
  B: { email: 'userB@test.com', username: 'userB', password: 'test123', name: 'User B' },
  C: { email: 'userC@test.com', username: 'userC', password: 'test123', name: 'User C' },
  D: { email: 'userD@test.com', username: 'userD', password: 'test123', name: 'User D' }
};

let tokens = {};
let userIds = {};
let postId = null;
let chainId = null;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function registerUser(userKey) {
  try {
    const user = users[userKey];
    console.log(`\n📝 Registering ${userKey}: ${user.email}`);
    
    const response = await axios.post(`${API_BASE}/auth/register`, {
      email: user.email,
      username: user.username,
      password: user.password,
      profile: { name: user.name },
      location: {
        city: 'Test City',
        state: 'Test State',
        country: 'Test Country'
      }
    });

    tokens[userKey] = response.data.token;
    userIds[userKey] = response.data.user._id;
    console.log(`✓ ${userKey} registered successfully (ID: ${userIds[userKey]})`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
      console.log(`⚠ ${userKey} already exists, logging in instead...`);
      return await loginUser(userKey);
    }
    console.error(`✗ Error registering ${userKey}:`, error.response?.data || error.message);
    throw error;
  }
}

async function loginUser(userKey) {
  try {
    const user = users[userKey];
    const response = await axios.post(`${API_BASE}/auth/login`, {
      email: user.email,
      password: user.password
    });

    tokens[userKey] = response.data.token;
    userIds[userKey] = response.data.user._id;
    console.log(`✓ ${userKey} logged in successfully`);
    return response.data;
  } catch (error) {
    console.error(`✗ Error logging in ${userKey}:`, error.response?.data || error.message);
    throw error;
  }
}

async function createPost(userKey) {
  try {
    console.log(`\n📝 ${userKey} creating a post...`);
    
    const response = await axios.post(
      `${API_BASE}/posts`,
      {
        title: 'Test Product - Premium Laptop',
        description: 'High-end laptop for testing referral system',
        category: 'product',
        price: 50000,
        pointsPool: 1000,
        location: {
          city: 'Test City',
          state: 'Test State',
          country: 'Test Country'
        }
      },
      {
        headers: { Authorization: `Bearer ${tokens[userKey]}` }
      }
    );

    postId = response.data._id;
    console.log(`✓ Post created successfully (ID: ${postId})`);
    
    // Initialize post view
    await sleep(500);
    await axios.post(
      `${API_BASE}/comprehensive-referrals/post-created`,
      {
        postId,
        metadata: {
          platform: 'web',
          device: 'desktop',
          browser: 'Chrome',
          sessionId: `session_${userKey}_${Date.now()}`
        }
      },
      {
        headers: { Authorization: `Bearer ${tokens[userKey]}` }
      }
    );
    console.log(`✓ Post initialized with ${userKey}'s view (clicks: 1, views: 1)`);
    
    return response.data;
  } catch (error) {
    console.error(`✗ Error creating post:`, error.response?.data || error.message);
    throw error;
  }
}

async function sharePost(sharerKey, platform = 'web') {
  try {
    console.log(`\n📤 ${sharerKey} sharing post via ${platform}...`);
    
    const response = await axios.post(
      `${API_BASE}/comprehensive-referrals/share`,
      {
        postId,
        sharerId: userIds[sharerKey],
        platform,
        device: 'desktop',
        browser: 'Chrome',
        location: {
          city: 'Test City',
          state: 'Test State',
          country: 'Test Country',
          coordinates: { latitude: 19.0760, longitude: 72.8777 }
        },
        coordinates: { latitude: 19.0760, longitude: 72.8777 },
        parentChainId: chainId
      },
      {
        headers: {
          Authorization: `Bearer ${tokens[sharerKey]}`,
          'x-session-id': `session_${sharerKey}_${Date.now()}`
        }
      }
    );

    if (!chainId) {
      chainId = response.data.chainId;
      console.log(`✓ New chain created (Chain ID: ${chainId})`);
    }
    
    console.log(`✓ Share tracked successfully`);
    console.log(`  Share URL: ${response.data.shareUrl}`);
    
    return response.data;
  } catch (error) {
    console.error(`✗ Error sharing post:`, error.response?.data || error.message);
    throw error;
  }
}

async function clickPost(clickerKey, referrerKey) {
  try {
    console.log(`\n👆 ${clickerKey} clicking on ${referrerKey}'s shared link...`);
    
    const response = await axios.post(
      `${API_BASE}/comprehensive-referrals/click`,
      {
        postId,
        chainId,
        clickerId: userIds[clickerKey] || null,
        referrerId: userIds[referrerKey],
        platform: 'web',
        device: 'desktop',
        browser: 'Chrome',
        location: {
          city: 'Test City',
          state: 'Test State',
          country: 'Test Country',
          coordinates: { latitude: 19.0760, longitude: 72.8777 }
        },
        coordinates: { latitude: 19.0760, longitude: 72.8777 }
      }
    );

    console.log(`✓ Click tracked successfully`);
    return response.data;
  } catch (error) {
    console.error(`✗ Error tracking click:`, error.response?.data || error.message);
    throw error;
  }
}

async function trackRegistration(newUserKey, referrerKey, registrationType = 'register') {
  try {
    console.log(`\n🔐 ${newUserKey} ${registrationType}ing via ${referrerKey}'s link...`);
    
    const response = await axios.post(
      `${API_BASE}/comprehensive-referrals/register`,
      {
        postId,
        chainId,
        newUserId: userIds[newUserKey],
        referrerId: userIds[referrerKey],
        platform: 'web',
        device: 'desktop',
        browser: 'Chrome',
        location: {
          city: 'Test City',
          state: 'Test State',
          country: 'Test Country',
          coordinates: { latitude: 19.0760, longitude: 72.8777 }
        },
        coordinates: { latitude: 19.0760, longitude: 72.8777 },
        registrationType
      }
    );

    console.log(`✓ Registration tracked - ${newUserKey} added to chain`);
    return response.data;
  } catch (error) {
    console.error(`✗ Error tracking registration:`, error.response?.data || error.message);
    throw error;
  }
}

async function viewChain(userKey) {
  try {
    console.log(`\n👀 Viewing ${userKey}'s referral chain...`);
    
    const response = await axios.get(
      `${API_BASE}/comprehensive-referrals/user/${userIds[userKey]}/chains?postId=${postId}`,
      {
        headers: { Authorization: `Bearer ${tokens[userKey]}` }
      }
    );

    const chain = response.data.chains[0];
    if (chain) {
      console.log(`✓ Chain: ${chain.chainString}`);
      console.log(`  Total Clicks: ${chain.totalClicks}`);
      console.log(`  Total Views: ${chain.totalViews}`);
      console.log(`  Total Shares: ${chain.totalShares}`);
      console.log(`  ${userKey}'s Position: ${chain.yourPosition}`);
    }
    
    return response.data;
  } catch (error) {
    console.error(`✗ Error viewing chain:`, error.response?.data || error.message);
    throw error;
  }
}

async function processPurchase(buyerKey) {
  try {
    console.log(`\n💳 ${buyerKey} purchasing the product...`);
    
    const response = await axios.post(
      `${API_BASE}/comprehensive-referrals/purchase`,
      {
        postId,
        buyerUserId: userIds[buyerKey]
      },
      {
        headers: { Authorization: `Bearer ${tokens[buyerKey]}` }
      }
    );

    console.log(`✓ Purchase processed successfully!`);
    console.log(`  Total Distributed: ${response.data.totalDistributed} points`);
    console.log(`  Platform Fee: ${response.data.platformFee} points`);
    console.log(`  Commissions: ${response.data.commissionsCount} people received commission`);
    
    if (response.data.distribution?.commissions) {
      console.log('\n💰 Commission Distribution:');
      response.data.distribution.commissions.forEach(comm => {
        console.log(`  ${comm.username}: ${comm.amount.toFixed(2)} points (${comm.percentage.toFixed(2)}%) - ${comm.reason}`);
      });
    }
    
    return response.data;
  } catch (error) {
    console.error(`✗ Error processing purchase:`, error.response?.data || error.message);
    throw error;
  }
}

async function getPostAnalytics() {
  try {
    console.log(`\n📊 Getting post analytics...`);
    
    const response = await axios.get(
      `${API_BASE}/comprehensive-referrals/analytics/${postId}`,
      {
        headers: { Authorization: `Bearer ${tokens.A}` }
      }
    );

    const analytics = response.data.analytics;
    console.log(`✓ Post Analytics:`);
    console.log(`  Total Chains: ${analytics.totalChains}`);
    console.log(`  Total People: ${analytics.totalPeopleInChains}`);
    console.log(`  Total Clicks: ${analytics.totalClicks}`);
    console.log(`  Total Views: ${analytics.totalViews}`);
    console.log(`  Total Shares: ${analytics.totalShares}`);
    console.log(`  Conversions: ${analytics.conversions}`);
    console.log(`  Longest Chain: ${analytics.longestChain} people`);
    
    return response.data;
  } catch (error) {
    console.error(`✗ Error getting analytics:`, error.response?.data || error.message);
    throw error;
  }
}

async function runComprehensiveTest() {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  COMPREHENSIVE REFERRAL CHAIN SYSTEM TEST');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`API Base: ${API_BASE}`);
    
    // Step 1: Register/Login all users
    console.log('\n\n═══ STEP 1: User Registration ═══');
    await registerUser('A');
    await sleep(500);
    
    // Step 2: User A creates post
    console.log('\n\n═══ STEP 2: Post Creation ═══');
    await createPost('A');
    await sleep(500);
    
    // Step 3: User A shares to User B
    console.log('\n\n═══ STEP 3: User A → User B ═══');
    await sharePost('A', 'whatsapp');
    await sleep(500);
    
    // Step 4: User B registers and clicks
    await registerUser('B');
    await sleep(500);
    await clickPost('B', 'A');
    await sleep(500);
    await trackRegistration('B', 'A', 'register');
    await sleep(500);
    await viewChain('A');
    await sleep(500);
    
    // Step 5: User B shares to User C
    console.log('\n\n═══ STEP 4: User B → User C ═══');
    await sharePost('B', 'linkedin');
    await sleep(500);
    
    // Step 6: User C registers and clicks
    await registerUser('C');
    await sleep(500);
    await clickPost('C', 'B');
    await sleep(500);
    await trackRegistration('C', 'B', 'register');
    await sleep(500);
    await viewChain('A');
    await sleep(500);
    await viewChain('B');
    await sleep(500);
    
    // Step 7: User C shares to User D
    console.log('\n\n═══ STEP 5: User C → User D ═══');
    await sharePost('C', 'twitter');
    await sleep(500);
    
    // Step 8: User D registers and clicks
    await registerUser('D');
    await sleep(500);
    await clickPost('D', 'C');
    await sleep(500);
    await trackRegistration('D', 'C', 'register');
    await sleep(500);
    
    // View all chains
    console.log('\n\n═══ STEP 6: View All Chains ═══');
    await viewChain('A');
    await sleep(500);
    await viewChain('B');
    await sleep(500);
    await viewChain('C');
    await sleep(500);
    await viewChain('D');
    await sleep(500);
    
    // Step 9: User D purchases
    console.log('\n\n═══ STEP 7: Purchase & Commission Distribution ═══');
    await processPurchase('D');
    await sleep(500);
    
    // Step 10: Get analytics
    console.log('\n\n═══ STEP 8: Post Analytics ═══');
    await getPostAnalytics();
    
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('  ✓ TEST COMPLETED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\nExpected Results:');
    console.log('- Chain: A(you) → B → C → D (in A\'s view)');
    console.log('- Chain: A → B(you) → C → D (in B\'s view)');
    console.log('- Chain: A → B → C(you) → D (in C\'s view)');
    console.log('- Chain: A → B → C → D(you) (in D\'s view)');
    console.log('- B gets 20% commission (first person)');
    console.log('- C gets 30% commission (second from last)');
    console.log('- Remaining 50% split among others');
    console.log('\n');
    
  } catch (error) {
    console.error('\n\n✗ TEST FAILED:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
runComprehensiveTest();

