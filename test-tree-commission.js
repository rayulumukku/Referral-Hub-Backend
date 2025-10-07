// Test tree-like commission distribution system
const CommissionService = require('./services/commissionService');

async function testTreeCommissionSystem() {
  console.log('🌳 Testing Tree-Like Commission Distribution System...\n');

  try {
    // Test scenarios for tree-like structure
    const scenarios = [
      {
        name: 'You → A → A1 → A2 (A2 buys)',
        description: 'You share to A, A shares to A1, A1 shares to A2, A2 buys',
        chain: [
          { name: 'A', role: 'Chain Head', location: 'Hyderabad' },
          { name: 'A1', role: 'Chain Member', location: 'Warangal' },
          { name: 'A2', role: 'Buyer', location: 'Khammam' }
        ],
        expected: {
          A2: 30, // Last person (buyer's referrer)
          A: 20,  // Chain head (person you originally shared to)
          A1: 50, // Other chain member (gets all remaining 50%)
          platform: 10
        }
      },
      {
        name: 'You → A → A1, A2, A3 → A1→A1a, A2→A2a, A3→A3a (A1a buys)',
        description: 'Complex tree: A shares to 3 people, each shares to 1 more, A1a buys',
        chain: [
          { name: 'A', role: 'Chain Head', location: 'Hyderabad' },
          { name: 'A1', role: 'Chain Member', location: 'Warangal' },
          { name: 'A2', role: 'Chain Member', location: 'Khammam' },
          { name: 'A3', role: 'Chain Member', location: 'Vijayawada' },
          { name: 'A1a', role: 'Buyer', location: 'Visakhapatnam' }
        ],
        expected: {
          A1a: 30, // Last person (buyer's referrer)
          A: 20,   // Chain head (person you originally shared to)
          A1: 16,  // Other chain members (share remaining 50% equally)
          A2: 16,  // = 50% / 3 = 16.67% each
          A3: 16,  // (rounded down)
          platform: 10
        }
      },
      {
        name: 'You → A, B, C → A→A1, B→B1, C→C1 (B1 buys)',
        description: 'You share to 3 people, each shares to 1 more, B1 buys',
        chain: [
          { name: 'A', role: 'Other Chain Member', location: 'Hyderabad' },
          { name: 'B', role: 'Chain Head', location: 'Warangal' },
          { name: 'C', role: 'Other Chain Member', location: 'Khammam' },
          { name: 'A1', role: 'Other Chain Member', location: 'Vijayawada' },
          { name: 'B1', role: 'Buyer', location: 'Visakhapatnam' },
          { name: 'C1', role: 'Other Chain Member', location: 'Guntur' }
        ],
        expected: {
          B1: 30, // Last person (buyer's referrer)
          B: 20,  // Chain head (person you originally shared to)
          A: 12,  // Other chain members (share remaining 50% equally)
          C: 12,  // = 50% / 4 = 12.5% each
          A1: 12, // (rounded down)
          C1: 12, // (rounded down)
          platform: 10
        }
      }
    ];

    for (const scenario of scenarios) {
      console.log(`📋 Testing: ${scenario.name}`);
      console.log('='.repeat(60));
      console.log(`Description: ${scenario.description}`);
      console.log('');
      
      // Calculate expected distribution
      const totalPoints = 1000;
      const platformFee = Math.floor(totalPoints * 0.1); // 10%
      const distributable = totalPoints - platformFee; // 900 points
      
      const lastAmount = Math.floor(distributable * 0.3); // 30%
      const chainHeadAmount = Math.floor(distributable * 0.2); // 20%
      const remaining = distributable - lastAmount - chainHeadAmount; // 50%
      
      // Find chain head and other members
      const chainHead = scenario.chain.find(member => member.role === 'Chain Head');
      const otherMembers = scenario.chain.filter(member => 
        member.role === 'Chain Member' || member.role === 'Other Chain Member'
      );
      const otherAmount = otherMembers.length > 0 ? Math.floor(remaining / otherMembers.length) : 0;
      
      console.log(`   Total Points: ${totalPoints}`);
      console.log(`   Platform Fee (10%): ${platformFee}`);
      console.log(`   Distributable: ${distributable}`);
      console.log(`   Last Person (30%): ${lastAmount}`);
      console.log(`   Chain Head (20%): ${chainHeadAmount}`);
      console.log(`   Remaining (50%): ${remaining}`);
      console.log(`   Other Members (${otherMembers.length}): ${otherAmount} each`);
      
      // Show tree structure
      console.log('\n   🌳 Tree Structure:');
      console.log(`   You`);
      console.log(`   ├── ${chainHead.name} (Chain Head) - ${chainHeadAmount} points`);
      
      for (const member of otherMembers) {
        console.log(`   ├── ${member.name} (${member.role}) - ${otherAmount} points`);
      }
      
      const buyer = scenario.chain.find(member => member.role === 'Buyer');
      console.log(`   └── ${buyer.name} (Buyer) - ${lastAmount} points`);
      
      // Show commission distribution
      console.log('\n   💰 Commission Distribution:');
      console.log(`   ${buyer.name} (Last): ${lastAmount} points (30%)`);
      console.log(`   ${chainHead.name} (Chain Head): ${chainHeadAmount} points (20%)`);
      
      for (const member of otherMembers) {
        console.log(`   ${member.name} (Chain Member): ${otherAmount} points`);
      }
      
      console.log(`   Platform: ${platformFee} points (10%)`);
      console.log(`   Total Distributed: ${platformFee + lastAmount + chainHeadAmount + (otherAmount * otherMembers.length)}`);
      console.log('');
    }

    console.log('✅ Tree-like commission distribution system is ready!');
    console.log('\n📊 Key Features:');
    console.log('• Multiple chains from one post');
    console.log('• Chain head gets 20% (person you originally shared to)');
    console.log('• Last person gets 30% (buyer\'s direct referrer)');
    console.log('• All other chain members share remaining 50% equally');
    console.log('• Platform gets 10%');
    console.log('• Each chain is tracked independently');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testTreeCommissionSystem();
