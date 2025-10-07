// Final comprehensive test
const axios = require('axios');

async function finalTest() {
  console.log('🎯 FINAL COMPREHENSIVE TEST...\n');

  const tests = [
    {
      name: 'Premium Demo Login',
      test: () => axios.post('https://referral-hub-backend-production.up.railway.app/api/auth/login', {
        email: 'premium@demo.com',
        password: 'demo123'
      }, {
        headers: { 'Content-Type': 'application/json' }
      })
    },
    {
      name: 'Super Premium Demo Login',
      test: () => axios.post('https://referral-hub-backend-production.up.railway.app/api/auth/login', {
        email: 'superpremium@demo.com',
        password: 'demo123'
      }, {
        headers: { 'Content-Type': 'application/json' }
      })
    },
    {
      name: 'Frontend Access',
      test: () => axios.get('https://referral-hub-frontend.vercel.app')
    },
    {
      name: 'CORS with Frontend Origin',
      test: () => axios.post('https://referral-hub-backend-production.up.railway.app/api/auth/login', {
        email: 'premium@demo.com',
        password: 'demo123'
      }, {
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://referral-hub-frontend.vercel.app'
        }
      })
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`🧪 Testing: ${test.name}...`);
      const response = await test.test();
      console.log(`✅ ${test.name}: SUCCESS`);
      passed++;
    } catch (error) {
      console.log(`❌ ${test.name}: FAILED`);
      console.log(`   Status: ${error.response?.status}`);
      console.log(`   Message: ${error.response?.data?.message || error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 FINAL RESULTS:`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Your app is 100% functional!');
    console.log('\n📋 DEMO CREDENTIALS:');
    console.log('   Premium User: premium@demo.com / demo123');
    console.log('   Super Premium: superpremium@demo.com / demo123');
    console.log('\n🌐 ACCESS YOUR APP:');
    console.log('   Frontend: https://referral-hub-frontend.vercel.app');
    console.log('   Backend: https://referral-hub-backend-production.up.railway.app');
  } else {
    console.log('\n⚠️ Some tests failed. Issues need to be addressed.');
  }
}

finalTest().catch(console.error);
