const mongoose = require('mongoose');
const User = require('./models/User');
const Post = require('./models/Post');
const Activity = require('./models/Activity');
const Notification = require('./models/Notification');

require('dotenv').config();

async function createPostsForPremiumUsers() {
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

    // Clear existing posts, activities, and notifications for demo users
    await Post.deleteMany({ creator: { $in: [premiumUser._id, superPremiumUser._id] } });
    await Activity.deleteMany({ user: { $in: [premiumUser._id, superPremiumUser._id] } });
    await Notification.deleteMany({ recipient: { $in: [premiumUser._id, superPremiumUser._id] } });

    console.log('🧹 Cleared existing data');

    const users = [premiumUser, superPremiumUser];

    // Create posts for premium users
    const posts = [];
    const postTitles = [
      'Premium Wireless Headphones - Brand New',
      'Designer Handbag - Limited Edition',
      'Gaming Laptop - High Performance',
      'Smart Watch - Latest Model',
      'Professional Camera Kit',
      'Luxury Watch Collection',
      'Fitness Equipment Set',
      'Home Office Desk Setup',
      'Vintage Guitar - Collectible',
      'Drone with 4K Camera'
    ];

    const categories = ['job', 'product', 'digital', 'service'];

    for (const user of users) {
      const numPosts = user.status === 'super-premium' ? 5 : 3;

      for (let i = 0; i < numPosts; i++) {
        const postDate = new Date();
        postDate.setDate(postDate.getDate() - Math.floor(Math.random() * 30)); // Posts from last 30 days

        const post = new Post({
          creator: user._id,
          title: postTitles[Math.floor(Math.random() * postTitles.length)] + ` (${i + 1})`,
          description: `High-quality item perfect for your needs. Excellent condition with great features.`,
          category: categories[Math.floor(Math.random() * categories.length)],
          originalPrice: Math.floor(Math.random() * 500) + 100,
          price: Math.floor(Math.random() * 300) + 50,
          pointsPool: user.status === 'super-premium' ? 2000 : 1000,
          platformFee: user.status === 'super-premium' ? 200 : 100,
          distributablePoints: user.status === 'super-premium' ? 1800 : 900,
          photos: [
            'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
          ],
          reach: Math.floor(Math.random() * 1000) + 100,
          conversions: Math.floor(Math.random() * 50) + 5,
          status: Math.random() > 0.7 ? 'sold' : 'active',
          location: {
            latitude: 19.0760 + (Math.random() - 0.5) * 2,
            longitude: 72.8777 + (Math.random() - 0.5) * 2,
            city: 'Mumbai',
            state: 'Maharashtra',
            country: 'India',
            timezone: 'Asia/Kolkata'
          },
          analytics: {
            views: Math.floor(Math.random() * 500) + 50,
            shares: Math.floor(Math.random() * 20),
            conversions: Math.floor(Math.random() * 10),
            engagement: {
              likes: Math.floor(Math.random() * 30) + 5,
              comments: Math.floor(Math.random() * 15) + 2,
              bookmarks: Math.floor(Math.random() * 10)
            }
          },
          createdAt: postDate
        });

        // Generate QR code (simplified for demo)
        post.referralLink = `http://localhost:3000/post/${post._id}`;
        post.qrCode = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

        await post.save();
        posts.push(post);

        // Create activity for post creation
        const activity = new Activity({
          user: user._id,
          type: 'post_created',
          message: `Created post: ${post.title}`,
          details: {
            postId: post._id,
            postTitle: post.title,
            category: post.category,
            price: post.price
          },
          metadata: {
            platform: 'web',
            device: 'desktop',
            location: {
              city: post.location.city,
              state: post.location.state,
              country: post.location.country
            }
          },
          createdAt: postDate
        });
        await activity.save();
      }
    }

    console.log(`📝 Created ${posts.length} posts for premium users`);

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
      for (let i = 0; i < 3; i++) {
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
      for (let i = 0; i < 2; i++) {
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
      for (let i = 0; i < 2; i++) {
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

      // Level up notifications for super premium
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

    console.log('✅ Successfully created posts and dummy data for premium users!');

  } catch (error) {
    console.error('❌ Error creating posts and data:', error);
  } finally {
    await mongoose.disconnect();
  }
}

createPostsForPremiumUsers();