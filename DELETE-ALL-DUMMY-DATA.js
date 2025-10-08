/**
 * ⚠️  DANGER: This script DELETES ALL DATA
 * Run this to remove all old dummy data and start fresh
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Post = require('./models/Post');
const Referral = require('./models/Referral');
const ReferralChain = require('./models/ReferralChain');
const Commission = require('./models/Commission');
const Activity = require('./models/Activity');
const Notification = require('./models/Notification');
const Like = require('./models/Like');
const Comment = require('./models/Comment');
const Bookmark = require('./models/Bookmark');

async function deleteAllDummyData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected!\n');

    console.log('⚠️  WARNING: This will DELETE ALL DATA!\n');
    console.log('Counting current data:');
    
    const counts = {
      users: await User.countDocuments(),
      posts: await Post.countDocuments(),
      referrals: await Referral.countDocuments(),
      chains: await ReferralChain.countDocuments(),
      commissions: await Commission.countDocuments(),
      activities: await Activity.countDocuments(),
      notifications: await Notification.countDocuments(),
      likes: await Like.countDocuments(),
      comments: await Comment.countDocuments(),
      bookmarks: await Bookmark.countDocuments()
    };

    console.log(`  Users: ${counts.users}`);
    console.log(`  Posts: ${counts.posts}`);
    console.log(`  Referrals: ${counts.referrals}`);
    console.log(`  Chains: ${counts.chains}`);
    console.log(`  Commissions: ${counts.commissions}`);
    console.log(`  Activities: ${counts.activities}`);
    console.log(`  Notifications: ${counts.notifications}`);
    console.log(`  Likes: ${counts.likes}`);
    console.log(`  Comments: ${counts.comments}`);
    console.log(`  Bookmarks: ${counts.bookmarks}\n`);

    console.log('🗑️  DELETING ALL DATA IN 3 SECONDS...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Deleting...\n');
    
    await Post.deleteMany({});
    console.log('✓ Deleted all posts');
    
    await Referral.deleteMany({});
    console.log('✓ Deleted all referrals');
    
    await ReferralChain.deleteMany({});
    console.log('✓ Deleted all referral chains');
    
    await Commission.deleteMany({});
    console.log('✓ Deleted all commissions');
    
    await Activity.deleteMany({});
    console.log('✓ Deleted all activities');
    
    await Notification.deleteMany({});
    console.log('✓ Deleted all notifications');
    
    await Like.deleteMany({});
    console.log('✓ Deleted all likes');
    
    await Comment.deleteMany({});
    console.log('✓ Deleted all comments');
    
    await Bookmark.deleteMany({});
    console.log('✓ Deleted all bookmarks');
    
    // Keep only admin users, delete all others
    const nonAdminUsers = await User.find({ role: { $ne: 'admin' } });
    await User.deleteMany({ role: { $ne: 'admin' } });
    console.log(`✓ Deleted ${nonAdminUsers.length} non-admin users\n`);

    console.log('═══════════════════════════════════════════');
    console.log('  ✅ ALL OLD DUMMY DATA DELETED!');
    console.log('═══════════════════════════════════════════\n');

    const remaining = await User.countDocuments();
    console.log(`Remaining users (admins only): ${remaining}\n`);
    console.log('Now you can:');
    console.log('1. Login and create NEW posts');
    console.log('2. Share them using the tracking system');
    console.log('3. See REAL data (no more 74 users, 157 posts, etc.)\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deleteAllDummyData();

