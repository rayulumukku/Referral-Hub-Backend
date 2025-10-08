const mongoose = require('mongoose');
require('dotenv').config();

// Database connection
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set. Please configure the environment variable.');
  process.exit(1);
}

async function createIndexes() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // User collection indexes
    console.log('Creating User collection indexes...');
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ username: 1 }, { unique: true });
    await db.collection('users').createIndex({ referrer: 1 });
    await db.collection('users').createIndex({ 'gamification.level': 1 });
    await db.collection('users').createIndex({ createdAt: 1 });
    await db.collection('users').createIndex({ status: 1 });

    // Post collection indexes
    console.log('Creating Post collection indexes...');
    await db.collection('posts').createIndex({ creator: 1 });
    await db.collection('posts').createIndex({ status: 1 });
    await db.collection('posts').createIndex({ category: 1 });
    await db.collection('posts').createIndex({ createdAt: -1 });
    await db.collection('posts').createIndex({ price: 1 });
    await db.collection('posts').createIndex({ reach: -1 });
    await db.collection('posts').createIndex({ conversions: -1 });
    await db.collection('posts').createIndex({ creator: 1, status: 1 });

    // Referral collection indexes
    console.log('Creating Referral collection indexes...');
    await db.collection('referrals').createIndex({ referrer: 1 });
    await db.collection('referrals').createIndex({ referee: 1 });
    await db.collection('referrals').createIndex({ post: 1 });
    await db.collection('referrals').createIndex({ platform: 1 });
    await db.collection('referrals').createIndex({ createdAt: -1 });
    await db.collection('referrals').createIndex({ referrer: 1, createdAt: -1 });
    await db.collection('referrals').createIndex({ referee: 1, createdAt: -1 });

    // Commission collection indexes
    console.log('Creating Commission collection indexes...');
    await db.collection('commissions').createIndex({ recipient: 1 });
    await db.collection('commissions').createIndex({ post: 1 });
    await db.collection('commissions').createIndex({ status: 1 });
    await db.collection('commissions').createIndex({ createdAt: -1 });
    await db.collection('commissions').createIndex({ recipient: 1, status: 1 });

    // Activity collection indexes
    console.log('Creating Activity collection indexes...');
    await db.collection('activities').createIndex({ user: 1 });
    await db.collection('activities').createIndex({ type: 1 });
    await db.collection('activities').createIndex({ createdAt: -1 });
    await db.collection('activities').createIndex({ user: 1, createdAt: -1 });

    // Notification collection indexes
    console.log('Creating Notification collection indexes...');
    await db.collection('notifications').createIndex({ user: 1 });
    await db.collection('notifications').createIndex({ read: 1 });
    await db.collection('notifications').createIndex({ createdAt: -1 });
    await db.collection('notifications').createIndex({ user: 1, read: 1 });

    // PostAnalytics collection indexes
    console.log('Creating PostAnalytics collection indexes...');
    await db.collection('postanalytics').createIndex({ post: 1 });
    await db.collection('postanalytics').createIndex({ type: 1 });
    await db.collection('postanalytics').createIndex({ timestamp: -1 });
    await db.collection('postanalytics').createIndex({ post: 1, type: 1 });
    await db.collection('postanalytics').createIndex({ post: 1, timestamp: -1 });

    // TrackingEvent collection indexes
    console.log('Creating TrackingEvent collection indexes...');
    await db.collection('trackingevents').createIndex({ postId: 1 });
    await db.collection('trackingevents').createIndex({ userId: 1 });
    await db.collection('trackingevents').createIndex({ type: 1 });
    await db.collection('trackingevents').createIndex({ timestamp: -1 });
    await db.collection('trackingevents').createIndex({ postId: 1, timestamp: -1 });

    // ReferralChain collection indexes
    console.log('Creating ReferralChain collection indexes...');
    await db.collection('referralchains').createIndex({ post: 1 });
    await db.collection('referralchains').createIndex({ originalCreator: 1 });
    await db.collection('referralchains').createIndex({ chainHead: 1 });
    await db.collection('referralchains').createIndex({ status: 1 });
    await db.collection('referralchains').createIndex({ createdAt: -1 });

    console.log('All indexes created successfully!');
    
    // Show index information
    console.log('\nIndex Information:');
    const collections = ['users', 'posts', 'referrals', 'commissions', 'activities', 'notifications', 'postanalytics', 'trackingevents', 'referralchains'];
    
    for (const collectionName of collections) {
      try {
        const indexes = await db.collection(collectionName).listIndexes().toArray();
        console.log(`\n${collectionName} collection indexes:`);
        indexes.forEach(index => {
          console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
        });
      } catch (error) {
        console.log(`  Collection ${collectionName} not found or error listing indexes`);
      }
    }

  } catch (error) {
    console.error('Error creating indexes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

createIndexes();
