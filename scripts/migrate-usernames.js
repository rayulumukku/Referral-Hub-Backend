const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function migrateUsernames() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/referralhub');
    console.log('Connected to MongoDB');

    // Find users who don't have username field, or have null/empty username
    const users = await User.find({
      $or: [
        { username: { $exists: false } },
        { username: null },
        { username: '' }
      ]
    });

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
      updatedCount++;
      console.log(`Updated user ${user.email} with username: ${username}`);
    }

    console.log(`Successfully updated ${updatedCount} users with usernames`);
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrateUsernames();