const mongoose = require('mongoose');
const User = require('./models/User');
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
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrateUsernames();