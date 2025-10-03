const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/referralhub');
    console.log('Connected to MongoDB');

    // Check if demo users exist
    const premiumUser = await User.findOne({ email: 'premium@demo.com' });
    const superPremiumUser = await User.findOne({ email: 'superpremium@demo.com' });

    console.log('Premium user exists:', !!premiumUser);
    if (premiumUser) {
      console.log('Premium user data:', {
        email: premiumUser.email,
        username: premiumUser.username,
        type: premiumUser.type,
        status: premiumUser.status,
        passwordHashLength: premiumUser.password.length,
        credits: premiumUser.credits,
        gamification: premiumUser.gamification
      });
    }

    console.log('Super Premium user exists:', !!superPremiumUser);
    if (superPremiumUser) {
      console.log('Super Premium user data:', {
        email: superPremiumUser.email,
        username: superPremiumUser.username,
        type: superPremiumUser.type,
        status: superPremiumUser.status,
        passwordHashLength: superPremiumUser.password.length,
        credits: superPremiumUser.credits,
        gamification: superPremiumUser.gamification
      });
    }

    // Check total users
    const totalUsers = await User.countDocuments();
    console.log('Total users in database:', totalUsers);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkUsers();