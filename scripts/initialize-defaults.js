const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');
const Referral = require('../models/Referral');
require('dotenv').config();

async function initializeDefaults() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/referralhub');
    console.log('Connected to MongoDB');

    let updatedCount = 0;

    // Update users with missing required fields
    const users = await User.find({
      $or: [
        { username: { $exists: false } },
        { username: null },
        { username: '' },
        { 'location.city': { $exists: false } },
        { 'deviceInfo.browser': { $exists: false } }
      ]
    });

    console.log(`Found ${users.length} users with missing data`);

    for (const user of users) {
      const updates = {};

      // Set username if missing
      if (!user.username) {
        updates.username = user.email.split('@')[0];
      }

      // Set location if missing
      if (!user.location || !user.location.city) {
        updates.location = {
          city: 'Unknown',
          state: 'Unknown',
          country: 'Unknown',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
      }

      // Set device info if missing
      if (!user.deviceInfo || !user.deviceInfo.browser) {
        updates.deviceInfo = {
          browser: 'Chrome',
          os: 'Unknown',
          device: 'desktop',
          userAgent: 'Mozilla/5.0',
          screenSize: { width: 1920, height: 1080 }
        };
      }

      // Set coordinates if missing
      if (!user.coordinates || !user.coordinates.lat) {
        updates.coordinates = { lat: 0, lng: 0 };
      }

      // Set gamification if missing
      if (!user.gamification) {
        updates.gamification = {
          totalPoints: 0,
          level: 1,
          experience: 0,
          streak: {
            current: 0,
            longest: 0,
            lastActivity: null
          }
        };
      }

      if (Object.keys(updates).length > 0) {
        await User.findByIdAndUpdate(user._id, updates);
        updatedCount++;
        console.log(`Updated user ${user.email} with missing data`);
      }
    }

    // Update posts with missing fields
    const posts = await Post.find({
      $or: [
        { reach: { $exists: false } },
        { conversions: { $exists: false } },
        { 'location.city': { $exists: false } }
      ]
    });

    console.log(`Found ${posts.length} posts with missing data`);

    for (const post of posts) {
      const updates = {};

      if (typeof post.reach !== 'number') {
        updates.reach = 0;
      }

      if (typeof post.conversions !== 'number') {
        updates.conversions = 0;
      }

      if (!post.location || !post.location.city) {
        updates.location = {
          latitude: 0,
          longitude: 0,
          city: 'Unknown',
          state: 'Unknown',
          country: 'Unknown',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
      }

      if (Object.keys(updates).length > 0) {
        await Post.findByIdAndUpdate(post._id, updates);
        updatedCount++;
        console.log(`Updated post ${post.title} with missing data`);
      }
    }

    // Update referrals with missing fields
    const referrals = await Referral.find({
      $or: [
        { platform: { $exists: false } },
        { device: { $exists: false } },
        { browser: { $exists: false } },
        { 'location.city': { $exists: false } }
      ]
    });

    console.log(`Found ${referrals.length} referrals with missing data`);

    for (const referral of referrals) {
      const updates = {};

      if (!referral.platform) {
        updates.platform = 'web';
      }

      if (!referral.device) {
        updates.device = 'desktop';
      }

      if (!referral.browser) {
        updates.browser = 'Chrome';
      }

      if (!referral.location || !referral.location.city) {
        updates.location = {
          city: 'Unknown',
          state: 'Unknown',
          country: 'Unknown',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
      }

      if (Object.keys(updates).length > 0) {
        await Referral.findByIdAndUpdate(referral._id, updates);
        updatedCount++;
        console.log(`Updated referral with missing data`);
      }
    }

    console.log(`Successfully updated ${updatedCount} records with complete data`);
    process.exit(0);
  } catch (error) {
    console.error('Initialization error:', error);
    process.exit(1);
  }
}

initializeDefaults();