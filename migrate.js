const mongoose = require('mongoose');
const User = require('./models/User');
const Post = require('./models/Post');
require('dotenv').config();

async function migrateUsernames() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/referral-hub');
    console.log('Connected to MongoDB');

    const users = await User.find({ username: { $exists: false } });
    console.log(`Found ${users.length} users without usernames`);

    let updatedCount = 0;

    for (const user of users) {
      // Generate username from email (part before @)
      const baseUsername = user.email.split('@')[0];
      let username = baseUsername;
      let counter = 1;

      // Ensure uniqueness
      while (await User.findOne({ username })) {
        username = `${baseUsername}${counter}`;
        counter++;
      }

      user.username = username;
      await user.save();
      console.log(`Updated user ${user.email} with username: ${username}`);
      updatedCount++;
    }

    console.log(`Migration completed. Updated ${updatedCount} users with usernames`);
  } catch (error) {
    console.error('Migration error:', error);
  }
}

async function migrateReferralLinks() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/referral-hub');
    console.log('Connected to MongoDB for referral links migration');

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const posts = await Post.find({});
    console.log(`Found ${posts.length} posts to update`);

    let updatedCount = 0;

    for (const post of posts) {
      const newReferralLink = `${baseUrl}/post/${post._id}`;
      if (post.referralLink !== newReferralLink) {
        post.referralLink = newReferralLink;
        await post.save();
        console.log(`Updated post ${post._id} referralLink to: ${newReferralLink}`);
        updatedCount++;
      }
    }

    console.log(`Referral links migration completed. Updated ${updatedCount} posts`);
  } catch (error) {
    console.error('Referral links migration error:', error);
  }
}

async function runMigrations() {
  await migrateUsernames();
  await migrateReferralLinks();
  process.exit(0);
}

runMigrations();