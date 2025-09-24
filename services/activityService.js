const Activity = require('../models/Activity');
const User = require('../models/User');

class ActivityService {
  // Track user registration
  static async trackUserRegistration(userId, referrerId = null, metadata = {}) {
    try {
      const user = await User.findById(userId).select('username type');
      if (!user) return;

      let message = `${user.username} joined the platform as a ${user.type}`;
      if (referrerId) {
        const referrer = await User.findById(referrerId).select('username');
        if (referrer) {
          message = `${user.username} joined the platform via ${referrer.username}'s referral`;
        }
      }

      await Activity.create({
        type: 'user_registration',
        user: userId,
        targetUser: referrerId,
        message,
        details: {
          userType: user.type,
          referrerId,
          device: metadata.device,
          platform: metadata.platform,
          browser: metadata.browser
        },
        metadata
      });
    } catch (error) {
      console.error('Error tracking user registration:', error);
    }
  }

  // Track user login
  static async trackUserLogin(userId, metadata = {}) {
    try {
      const user = await User.findById(userId).select('username');
      if (!user) return;

      await Activity.create({
        type: 'user_login',
        user: userId,
        message: `${user.username} logged into the platform`,
        metadata
      });
    } catch (error) {
      console.error('Error tracking user login:', error);
    }
  }

  // Track post creation
  static async trackPostCreation(userId, postId, postTitle, metadata = {}) {
    try {
      const user = await User.findById(userId).select('username');
      if (!user) return;

      await Activity.create({
        type: 'post_created',
        user: userId,
        post: postId,
        message: `${user.username} created a new post: "${postTitle}"`,
        details: {
          postTitle,
          platform: metadata.platform,
          device: metadata.device,
          browser: metadata.browser,
          coordinates: metadata.coordinates,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          location: metadata.location
        }
      });
    } catch (error) {
      console.error('Error tracking post creation:', error);
    }
  }

  // Track referral sharing
  static async trackReferralShared(userId, postId, platform, metadata = {}) {
    try {
      const user = await User.findById(userId).select('username');
      const post = await require('../models/Post').findById(postId).select('title');
      if (!user || !post) return;

      await Activity.create({
        type: 'referral_shared',
        user: userId,
        post: postId,
        message: `${user.username} shared "${post.title}" on ${platform}`,
        details: {
          platform,
          postTitle: post.title
        },
        metadata
      });
    } catch (error) {
      console.error('Error tracking referral shared:', error);
    }
  }

  // Track referral click
  static async trackReferralClick(referrerId, postId, platform, metadata = {}) {
    try {
      const referrer = await User.findById(referrerId).select('username');
      const post = await require('../models/Post').findById(postId).select('title');
      if (!referrer || !post) return;

      await Activity.create({
        type: 'referral_click',
        user: referrerId,
        post: postId,
        message: `Someone clicked ${referrer.username}'s referral link for "${post.title}" on ${platform}`,
        details: {
          platform,
          postTitle: post.title
        },
        metadata
      });
    } catch (error) {
      console.error('Error tracking referral click:', error);
    }
  }

  // Track commission earned
  static async trackCommissionEarned(recipientId, amount, referralId, level) {
    try {
      const recipient = await User.findById(recipientId).select('username');
      if (!recipient) return;

      await Activity.create({
        type: 'commission_earned',
        user: recipientId,
        referral: referralId,
        message: `${recipient.username} earned ${amount} points (Level ${level})`,
        details: {
          amount,
          level
        }
      });
    } catch (error) {
      console.error('Error tracking commission earned:', error);
    }
  }

  // Get all activities for admin
  static async getAllActivities(limit = 50, skip = 0) {
    try {
      return await Activity.find()
        .populate('user', 'username email type')
        .populate('targetUser', 'username email type')
        .populate('post', 'title')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);
    } catch (error) {
      console.error('Error getting all activities:', error);
      return [];
    }
  }

  // Get activities for a specific user
  static async getUserActivities(userId, limit = 20) {
    try {
      return await Activity.find({
        $or: [
          { user: userId },
          { targetUser: userId }
        ]
      })
        .populate('user', 'username email type')
        .populate('targetUser', 'username email type')
        .populate('post', 'title')
        .sort({ createdAt: -1 })
        .limit(limit);
    } catch (error) {
      console.error('Error getting user activities:', error);
      return [];
    }
  }

  // Get platform-wide activity feed for users
  static async getPlatformActivityFeed(userId, limit = 20) {
    try {
      // Get activities that are relevant to the user or public activities
      const activities = await Activity.find({
        type: { $in: ['user_registration', 'post_created', 'commission_earned'] }
      })
        .populate('user', 'username email type')
        .populate('targetUser', 'username email type')
        .populate('post', 'title')
        .sort({ createdAt: -1 })
        .limit(limit);

      return activities;
    } catch (error) {
      console.error('Error getting platform activity feed:', error);
      return [];
    }
  }
}

// Get platform distribution from referral activities
ActivityService.getPlatformStats = async function() {
  try {
    const activities = await Activity.find({ type: 'referral_click' });
    const platformMap = {};

    activities.forEach(activity => {
      const platform = activity.details?.platform || 'unknown';
      platformMap[platform] = (platformMap[platform] || 0) + 1;
    });

    return Object.entries(platformMap).map(([platform, count]) => ({
      platform,
      count
    }));
  } catch (error) {
    console.error('Error getting platform stats:', error);
    return [];
  }
};

// Get device distribution from activities
ActivityService.getDeviceStats = async function() {
  try {
    const activities = await Activity.find({
      $or: [
        { type: 'referral_click' },
        { type: 'post_created' },
        { type: 'user_registration' }
      ]
    });

    const deviceMap = {};

    activities.forEach(activity => {
      let device = 'unknown';

      // Check different places for device info
      if (activity.details?.device) {
        device = activity.details.device;
      } else if (activity.metadata?.device) {
        device = activity.metadata.device;
      }

      deviceMap[device] = (deviceMap[device] || 0) + 1;
    });

    return Object.entries(deviceMap).map(([device, count]) => ({
      device,
      count
    }));
  } catch (error) {
    console.error('Error getting device stats:', error);
    return [];
  }
};

// Get post creation platform stats
ActivityService.getPostCreationStats = async function() {
  try {
    const activities = await Activity.find({ type: 'post_created' });
    const platformMap = {};

    activities.forEach(activity => {
      const platform = activity.details?.platform || 'unknown';
      platformMap[platform] = (platformMap[platform] || 0) + 1;
    });

    return Object.entries(platformMap).map(([platform, count]) => ({
      platform,
      count
    }));
  } catch (error) {
    console.error('Error getting post creation stats:', error);
    return [];
  }
};

module.exports = ActivityService;