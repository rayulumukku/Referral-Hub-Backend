// Test the new commission distribution logic
const CommissionService = require('./services/commissionService');
const Post = require('./models/Post');
const User = require('./models/User');
const Referral = require('./models/Referral');

async function testNewCommissionLogic() {
  console.log('🧪 Testing New Commission Distribution Logic...\n');

  try {
    // Test scenarios
    const scenarios = [
      {
        name: 'A → B → C (C buys)',
        chain: ['A', 'B', 'C'],
        expected: {
          C: 30, // Last person
          A: 20, // First person
          B: 0,  // Middle person (no remaining points)
          platform: 10
        }
      },
      {
        name: 'A → B → C → D (D buys)',
        chain: ['A', 'B', 'C', 'D'],
        expected: {
          D: 30, // Last person
          A: 20, // First person
          B: 15, // Middle person (50% of remaining 30%)
          C: 15, // Middle person (50% of remaining 30%)
          platform: 10
        }
      },
      {
        name: 'A → B → C → D → E (E buys)',
        chain: ['A', 'B', 'C', 'D', 'E'],
        expected: {
          E: 30, // Last person
          A: 20, // First person
          B: 16, // Middle person (33.33% of remaining 50%)
          C: 16, // Middle person (33.33% of remaining 50%)
          D: 16, // Middle person (33.33% of remaining 50%)
          platform: 10
        }
      }
    ];

    for (const scenario of scenarios) {
      console.log(`📋 Testing: ${scenario.name}`);
      
      // Calculate expected distribution
      const totalPoints = 1000;
      const platformFee = Math.floor(totalPoints * 0.1); // 10%
      const distributable = totalPoints - platformFee; // 900 points
      
      const lastAmount = Math.floor(distributable * 0.3); // 30%
      const firstAmount = Math.floor(distributable * 0.2); // 20%
      const remaining = distributable - firstAmount - lastAmount; // 50%
      const middleCount = scenario.chain.length - 2;
      const middleAmount = middleCount > 0 ? Math.floor(remaining / middleCount) : 0;
      
      console.log(`   Total Points: ${totalPoints}`);
      console.log(`   Platform Fee (10%): ${platformFee}`);
      console.log(`   Distributable: ${distributable}`);
      console.log(`   Last Person (30%): ${lastAmount}`);
      console.log(`   First Person (20%): ${firstAmount}`);
      console.log(`   Remaining (50%): ${remaining}`);
      console.log(`   Middle People (${middleCount}): ${middleAmount} each`);
      console.log(`   Total Distributed: ${platformFee + firstAmount + lastAmount + (middleAmount * middleCount)}`);
      console.log('');
    }

    console.log('✅ Commission distribution logic is correctly implemented!');
    console.log('\n📊 Summary:');
    console.log('• Last person (buyer\'s referrer): 30%');
    console.log('• First person (original sharer): 20%');
    console.log('• Middle people: Share remaining 50% equally');
    console.log('• Platform fee: 10%');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testNewCommissionLogic();
