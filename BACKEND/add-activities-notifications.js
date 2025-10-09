const mongoose = require('mongoose');
const User = require('./models/User');
const Activity = require('./models/Activity');
const Notification = require('./models/Notification');

require('dotenv').config();

async function addActivitiesAndNotifications() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find premium users
    const premiumUser = await User.findOne({ email: 'premium@demo.com' });
    const superPremiumUser = await User.findOne({ email: 'superpremium@demo.com' });

    if (!premiumUser || !superPremiumUser) {
      console.log('❌ Premium users not found');
      return;
    }

    console.log('✅ Found premium users');

    // Clear existing activities and notifications for demo users
    await Activity.deleteMany({ user: { $in: [premiumUser._id, superPremiumUser._id] } });
    await Notification.deleteMany({ recipient: { $in: [premiumUser._id, superPremiumUser._id] } });

    console.log('🧹 Cleared existing activities and notifications');

    const users = [premiumUser, superPremiumUser];

    // Create activities for premium users
    const activities = [];

    for (const user of users) {
      // User registration activity
      activities.push({
        type: 'user_registration',
        user: user._id,
        message: `${user.profile.name} joined ReferralHub`,
        metadata: {
          platform: 'web',
          device: 'desktop',
          location: { city: 'Mumbai', state: 'Maharashtra', country: 'India' },
          ip: '127.0.0.1'
        }
      });

      // Multiple login activities
      for (let i = 0; i < 5; i++) {
        const loginDate = new Date();
        loginDate.setDate(loginDate.getDate() - Math.floor(Math.random() * 30));

        activities.push({
          type: 'user_login',
          user: user._id,
          message: `${user.profile.name} logged in`,
          metadata: {
            platform: 'web',
            device: 'desktop',
            location: { city: 'Mumbai', state: 'Maharashtra', country: 'India' },
            ip: '127.0.0.1'
          },
          createdAt: loginDate
        });
      }

      // Commission earned activities
      for (let i = 0; i < 3; i++) {
        const commissionDate = new Date();
        commissionDate.setDate(commissionDate.getDate() - Math.floor(Math.random() * 20));

        activities.push({
          type: 'commission_earned',
          user: user._id,
          message: `${user.profile.name} earned ${Math.floor(Math.random() * 50) + 10} points`,
          metadata: {
            platform: 'web',
            device: 'desktop',
            amount: Math.floor(Math.random() * 50) + 10
          },
          createdAt: commissionDate
        });
      }

      // Referral shared activities
      for (let i = 0; i < 8; i++) {
        const referralDate = new Date();
        referralDate.setDate(referralDate.getDate() - Math.floor(Math.random() * 25));

        activities.push({
          type: 'referral_shared',
          user: user._id,
          message: `${user.profile.name} shared a referral link`,
          metadata: {
            platform: 'web',
            device: 'desktop',
            location: { city: 'Mumbai', state: 'Maharashtra', country: 'India' }
          },
          createdAt: referralDate
        });
      }
    }

    // Save activities
    for (const activity of activities) {
      const newActivity = new Activity(activity);
      await newActivity.save();
    }

    console.log(`📝 Created ${activities.length} activities`);

    // Create notifications for premium users
    const notifications = [];

    for (const user of users) {
      // Commission notifications
      for (let i = 0; i < 3; i++) {
        const notificationDate = new Date();
        notificationDate.setDate(notificationDate.getDate() - Math.floor(Math.random() * 15));

        notifications.push({
          recipient: user._id,
          type: 'commission_earned',
          title: 'Commission Earned!',
          message: `You earned ${Math.floor(Math.random() * 50) + 10} points from your referral network.`,
          data: {
            amount: Math.floor(Math.random() * 50) + 10,
            currency: 'points'
          },
          priority: 'medium',
          createdAt: notificationDate
        });
      }

      // Referral notifications
      for (let i = 0; i < 5; i++) {
        const notificationDate = new Date();
        notificationDate.setDate(notificationDate.getDate() - Math.floor(Math.random() * 20));

        notifications.push({
          recipient: user._id,
          type: 'referral_click',
          title: 'New Referral Activity',
          message: 'Someone clicked on your referral link!',
          data: {
            clicks: Math.floor(Math.random() * 10) + 1
          },
          priority: 'low',
          createdAt: notificationDate
        });
      }

      // Level up notifications
      if (user.status === 'super-premium') {
        const levelUpDate = new Date();
        levelUpDate.setDate(levelUpDate.getDate() - 10);

        notifications.push({
          recipient: user._id,
          type: 'level_up',
          title: 'Congratulations! Level Up!',
          message: 'You have reached Super Premium status!',
          data: {
            level: 25,
            badge: 'Super Premium'
          },
          priority: 'high',
          createdAt: levelUpDate
        });
      }

      // Badge earned notifications
      for (let i = 0; i < 2; i++) {
        const badgeDate = new Date();
        badgeDate.setDate(badgeDate.getDate() - Math.floor(Math.random() * 25));

        notifications.push({
          recipient: user._id,
          type: 'badge_earned',
          title: 'New Badge Unlocked!',
          message: `You earned the "${['Referral Master', 'Network Builder', 'Top Earner'][i]}" badge!`,
          data: {
            badge: ['Referral Master', 'Network Builder', 'Top Earner'][i],
            points: Math.floor(Math.random() * 50) + 25
          },
          priority: 'medium',
          createdAt: badgeDate
        });
      }

      // System announcements
      const announcementDate = new Date();
      announcementDate.setDate(announcementDate.getDate() - 5);

      notifications.push({
        recipient: user._id,
        type: 'system_announcement',
        title: 'Welcome to Premium Features!',
        message: 'As a premium user, you now have access to advanced analytics and priority support.',
        data: {
          url: '/premium-features'
        },
        priority: 'medium',
        createdAt: announcementDate
      });
    }

    // Save notifications
    for (const notification of notifications) {
      const newNotification = new Notification(notification);
      await newNotification.save();
    }

    console.log(`🔔 Created ${notifications.length} notifications`);

    console.log('✅ Successfully added activities and notifications for premium users!');

  } catch (error) {
    console.error('❌ Error adding activities and notifications:', error);
  } finally {
    await mongoose.disconnect();
  }
}

addActivitiesAndNotifications();