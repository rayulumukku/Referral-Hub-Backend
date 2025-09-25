// Test script to add sample referral data
const mongoose = require('mongoose');
const Referral = require('./models/Referral');
const Commission = require('./models/Commission');
const Post = require('./models/Post');
const User = require('./models/User');

async function addTestReferrals() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/referralhub');

    // Get the first user and their posts
    const user = await User.findOne();
    if (!user) {
      console.log('No users found');
      return;
    }

    const posts = await Post.find({ creator: user._id });
    if (posts.length === 0) {
      console.log('No posts found for user');
      return;
    }

    console.log(`Adding test referrals for user: ${user.username}, posts: ${posts.length}`);

    // Add some test referrals for each post
    for (const post of posts.slice(0, 2)) { // Only for first 2 posts
      const referralCount = Math.floor(Math.random() * 5) + 1; // 1-5 referrals per post

      for (let i = 0; i < referralCount; i++) {
        const referral = new Referral({
          post: post._id,
          referrer: user._id,
          platform: ['whatsapp', 'linkedin', 'twitter', 'telegram'][i % 4],
          location: {
            city: ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad'][i % 5],
            state: ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Telangana'][i % 5],
            country: 'India',
            timezone: 'Asia/Kolkata'
          },
          device: ['mobile', 'desktop', 'tablet'][i % 3],
          browser: ['Chrome', 'Firefox', 'Safari', 'Edge'][i % 4],
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          screenSize: { width: 1920, height: 1080 },
          coordinates: {
            latitude: 19.0760 + (Math.random() - 0.5) * 10,
            longitude: 72.8777 + (Math.random() - 0.5) * 10
          },
          ipAddress: '127.0.0.1',
          networkInfo: { isp: 'Test ISP', connectionType: '4g' },
          sessionId: `test_session_${i}`,
          referrer: 'https://example.com',
          language: 'en-US'
        });

        await referral.save();

        // Add commission for this referral
        const commission = new Commission({
          recipient: user._id,
          referral: referral._id,
          amount: 25, // 25 points per referral
          level: 1,
          post: post._id
        });

        await commission.save();

        console.log(`Added referral ${i + 1} for post: ${post.title}`);
      }
    }

    console.log('Test referrals added successfully!');
    console.log('You should now see network growth and referral chains in your Profile page.');

  } catch (error) {
    console.error('Error adding test referrals:', error);
  } finally {
    await mongoose.disconnect();
  }
}

addTestReferrals();