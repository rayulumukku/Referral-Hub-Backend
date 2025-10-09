// Comprehensive test of all endpoints
const axios = require('axios');

const BACKEND_URL = 'https://referral-hub-backend-production.up.railway.app';
const FRONTEND_URL = 'https://referral-hub-frontend.vercel.app';

async function comprehensiveTest() {
  console.log('🔍 COMPREHENSIVE TESTING STARTED...\n');

  const tests = [
    {
      name: 'Health Check',
      test: () => axios.get(`${BACKEND_URL}/api/auth/health`)
    },
    {
      name: 'Login with Demo User',
      test: () => axios.post(`${BACKEND_URL}/api/auth/login`, {
        email: 'premium@demo.com',
        password: 'demo123'
      }, {
        headers: { 'Origin': FRONTEND_URL }
      })
    },
    {
      name: 'Posts Endpoint',
      test: () => axios.get(`${BACKEND_URL}/api/posts`)
    },
    {
      name: 'Analytics Endpoint',
      test: () => axios.get(`${BACKEND_URL}/api/analytics/global`)
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`🧪 Testing: ${test.name}...`);
      const response = await test.test();
      console.log(`✅ ${test.name}: SUCCESS (${response.status})`);
      passed++;
    } catch (error) {
      console.log(`❌ ${test.name}: FAILED`);
      console.log(`   Status: ${error.response?.status}`);
      console.log(`   Message: ${error.response?.data?.message || error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 TEST RESULTS:`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Your app is fully functional!');
  } else {
    console.log('\n⚠️ Some tests failed. Issues need to be addressed.');
  }
}

comprehensiveTest().catch(console.error);
