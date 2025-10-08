const axios = require('axios');

async function emergencyTest() {
  console.log('🚨 EMERGENCY TEST - CHECKING ALL ENDPOINTS\n');
  
  const API = 'http://localhost:5001';
  
  try {
    // Test 1: Server running?
    console.log('1. Testing server...');
    const serverTest = await axios.get(`${API}/api/posts`).catch(e => ({ error: e.message }));
    if (serverTest.error) {
      console.log('❌ SERVER NOT RUNNING!');
      console.log('   Run: npm start in BACKEND folder!');
      return;
    }
    console.log('✅ Server is running!\n');

    // Test 2: Login works?
    console.log('2. Testing login...');
    const login = await axios.post(`${API}/api/auth/login`, {
      email: 'admin@referralhub.com',
      password: 'admin123'
    }).catch(e => ({ error: e.response?.data?.message || e.message }));
    
    if (login.error) {
      console.log('❌ Login failed:', login.error);
      return;
    }
    
    const token = login.data.token;
    console.log('✅ Login works! Token:', token.substring(0, 20) + '...\n');

    // Test 3: Get user posts
    console.log('3. Testing posts...');
    const posts = await axios.get(`${API}/api/dashboard/user-stats`, {
      headers: { Authorization: `Bearer ${token}` }
    }).catch(e => ({ error: e.message }));
    
    if (posts.error) {
      console.log('❌ Posts failed:', posts.error);
      return;
    }
    
    console.log('✅ Posts loaded:', posts.data.stats.recentPosts.length, 'posts\n');
    
    if (posts.data.stats.recentPosts.length === 0) {
      console.log('⚠️  NO POSTS! Create a post first!\n');
      return;
    }
    
    const postId = posts.data.stats.recentPosts[0]._id;
    console.log('📄 Test post:', posts.data.stats.recentPosts[0].title, '\n');

    // Test 4: Share endpoint works?
    console.log('4. Testing share endpoint...');
    const share = await axios.post(`${API}/api/comprehensive-referrals/share`, {
      postId: postId,
      sharerId: login.data.userId,
      platform: 'test',
      device: 'desktop',
      browser: 'Chrome',
      location: { city: 'Test', country: 'Test' }
    }, {
      headers: { Authorization: `Bearer ${token}` }
    }).catch(e => ({ error: e.response?.data?.message || e.message }));
    
    if (share.error) {
      console.log('❌ Share failed:', share.error);
      console.log('\n🔧 PROBLEM FOUND! Share endpoint not working!\n');
      return;
    }
    
    console.log('✅ Share works! Chain ID:', share.data.chainId);
    console.log('✅ Share URL:', share.data.shareUrl, '\n');

    // Test 5: Get chains
    console.log('5. Testing get chains...');
    const chains = await axios.get(`${API}/api/comprehensive-referrals/post/${postId}/chains`, {
      headers: { Authorization: `Bearer ${token}` }
    }).catch(e => ({ error: e.message }));
    
    if (chains.error) {
      console.log('❌ Get chains failed:', chains.error);
      return;
    }
    
    console.log('✅ Chains retrieved:', chains.data.count, 'chains\n');

    console.log('═'.repeat(60));
    console.log('🎉 ALL TESTS PASSED! REFERRAL SYSTEM WORKS!');
    console.log('═'.repeat(60));
    
  } catch (error) {
    console.log('❌ CRITICAL ERROR:', error.message);
  }
}

emergencyTest();

