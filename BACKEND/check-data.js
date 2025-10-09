const mongoose = require('mongoose');
const User = require('./models/User');
const Post = require('./models/Post');
const Referral = require('./models/Referral');
const Commission = require('./models/Commission');
const Activity = require('./models/Activity');
const Notification = require('./models/Notification');

require('dotenv').config();

async function checkData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check users
    const users = await User.find({ email: { $in: ['premium@demo.com', 'superpremium@demo.com'] } });
    console.log('Demo users found:', users.length);
    users.forEach(user => {
      console.log(`- ${user.email}: ${user.username}, credits: ${user.credits}`);
    });

    // Check posts
    const posts = await Post.find({ creator: { $in: users.map(u => u._id) } });
    console.log('Posts found:', posts.length);
    posts.forEach(post => {
      console.log(`- ${post.title} by ${post.creator}`);
    });

    // Check referrals
    const referrals = await Referral.find({ referrer: { $in: users.map(u => u._id) } });
    console.log('Referrals found:', referrals.length);

    // Check commissions
    const commissions = await Commission.find({ recipient: { $in: users.map(u => u._id) } });
    console.log('Commissions found:', commissions.length);
    commissions.forEach(comm => {
      console.log(`- Commission: ${comm.amount} points`);
    });

    // Check activities
    const activities = await Activity.find({ user: { $in: users.map(u => u._id) } });
    console.log('Activities found:', activities.length);
    activities.slice(0, 5).forEach(activity => {
      console.log(`- ${activity.type}: ${activity.message}`);
    });

    // Check notifications
    const notifications = await Notification.find({ recipient: { $in: users.map(u => u._id) } });
    console.log('Notifications found:', notifications.length);
    notifications.slice(0, 5).forEach(notification => {
      console.log(`- ${notification.type}: ${notification.title}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkData();