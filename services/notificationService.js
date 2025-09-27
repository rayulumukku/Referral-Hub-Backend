const Notification = require('../models/Notification');

class NotificationService {
  // Create notification for referral click
  static async notifyReferralClick(referral) {
    try {
      const post = await require('../models/Post').findById(referral.post);
      const referrer = await require('../models/User').findById(referral.referrer);

      if (referrer) {
        await Notification.createNotification({
          recipient: referrer._id,
          type: 'referral_click',
          title: 'New Referral Click',
          message: `Someone clicked on your referral link for "${post?.title || 'a post'}"`,
          data: {
            postId: referral.post,
            referralId: referral._id,
            url: `/post/${referral.post}`,
          },
          priority: 'medium',
        });
      }
    } catch (error) {
      console.error('Error creating referral click notification:', error);
    }
  }

  // Create notification for referral conversion
  static async notifyReferralConversion(referral) {
    try {
      const post = await require('../models/Post').findById(referral.post);
      const referrer = await require('../models/User').findById(referral.referrer);

      if (referrer) {
        await Notification.createNotification({
          recipient: referrer._id,
          type: 'referral_conversion',
          title: 'Referral Conversion!',
          message: `Congratulations! Your referral for "${post?.title || 'a post'}" resulted in a conversion`,
          data: {
            postId: referral.post,
            referralId: referral._id,
            amount: post?.pointsPool || 0,
            url: `/post/${referral.post}`,
          },
          priority: 'high',
        });
      }
    } catch (error) {
      console.error('Error creating referral conversion notification:', error);
    }
  }

  // Create notification for commission earned
  static async notifyCommissionEarned(commission) {
    try {
      const recipient = await require('../models/User').findById(commission.recipient_id);

      if (recipient) {
        await Notification.createNotification({
          recipient: commission.recipient_id,
          type: 'commission_earned',
          title: 'Commission Earned!',
          message: `You earned ${commission.amount} credits as commission`,
          data: {
            commissionId: commission._id,
            amount: commission.amount,
            level: commission.level,
          },
          priority: 'high',
        });
      }
    } catch (error) {
      console.error('Error creating commission notification:', error);
    }
  }

  // Create notification for post shared
  static async notifyPostShared(post, sharer, platform) {
    try {
      const creator = await require('../models/User').findById(post.creator);

      if (creator && creator._id.toString() !== sharer._id.toString()) {
        await Notification.createNotification({
          recipient: creator._id,
          type: 'post_shared',
          title: 'Post Shared',
          message: `${sharer.username} shared your post "${post.title}" on ${platform}`,
          data: {
            postId: post._id,
            userId: sharer._id,
            platform: platform,
            url: `/post/${post._id}`,
          },
          priority: 'low',
        });
      }
    } catch (error) {
      console.error('Error creating post shared notification:', error);
    }
  }

  // Create notification for new follower
  static async notifyNewFollower(follower, followedUser) {
    try {
      await Notification.createNotification({
        recipient: followedUser._id,
        type: 'new_follower',
        title: 'New Follower',
        message: `${follower.username} started following you`,
        data: {
          userId: follower._id,
          url: `/profile/${follower._id}`,
        },
        priority: 'low',
      });
    } catch (error) {
      console.error('Error creating new follower notification:', error);
    }
  }

  // Create notification for comment received
  static async notifyCommentReceived(post, commenter, comment) {
    try {
      const creator = await require('../models/User').findById(post.creator);

      if (creator && creator._id.toString() !== commenter._id.toString()) {
        await Notification.createNotification({
          recipient: creator._id,
          type: 'comment_received',
          title: 'New Comment',
          message: `${commenter.username} commented on your post "${post.title}"`,
          data: {
            postId: post._id,
            userId: commenter._id,
            comment: comment,
            url: `/post/${post._id}`,
          },
          priority: 'medium',
        });
      }
    } catch (error) {
      console.error('Error creating comment notification:', error);
    }
  }

  // Create notification for like received
  static async notifyLikeReceived(post, liker) {
    try {
      const creator = await require('../models/User').findById(post.creator);

      if (creator && creator._id.toString() !== liker._id.toString()) {
        await Notification.createNotification({
          recipient: creator._id,
          type: 'like_received',
          title: 'Post Liked',
          message: `${liker.username} liked your post "${post.title}"`,
          data: {
            postId: post._id,
            userId: liker._id,
            url: `/post/${post._id}`,
          },
          priority: 'low',
        });
      }
    } catch (error) {
      console.error('Error creating like notification:', error);
    }
  }

  // Create notification for system announcement
  static async notifySystemAnnouncement(recipients, title, message, data = {}) {
    try {
      const notifications = recipients.map(recipientId => ({
        recipient: recipientId,
        type: 'system_announcement',
        title,
        message,
        data,
        priority: 'medium',
      }));

      await Notification.insertMany(notifications);
    } catch (error) {
      console.error('Error creating system announcement notifications:', error);
    }
  }

  // Create notification for admin message
  static async notifyAdminMessage(recipient, title, message, data = {}) {
    try {
      await Notification.createNotification({
        recipient,
        type: 'admin_message',
        title,
        message,
        data,
        priority: 'high',
      });
    } catch (error) {
      console.error('Error creating admin message notification:', error);
    }
  }

  // Create notification for milestone achieved
  static async notifyMilestoneAchieved(user, milestone) {
    try {
      await Notification.createNotification({
        recipient: user._id,
        type: 'milestone_achieved',
        title: 'Milestone Achieved!',
        message: `Congratulations! You reached ${milestone}`,
        data: {
          milestone,
          url: '/profile',
        },
        priority: 'high',
      });
    } catch (error) {
      console.error('Error creating milestone notification:', error);
    }
  }

  // Create notification for level up
  static async notifyLevelUp(user, newLevel) {
    try {
      await Notification.createNotification({
        recipient: user._id,
        type: 'level_up',
        title: 'Level Up!',
        message: `Congratulations! You reached level ${newLevel}`,
        data: {
          level: newLevel,
          url: '/profile',
        },
        priority: 'high',
      });
    } catch (error) {
      console.error('Error creating level up notification:', error);
    }
  }

  // Create notification for badge earned
  static async notifyBadgeEarned(user, badge) {
    try {
      await Notification.createNotification({
        recipient: user._id,
        type: 'badge_earned',
        title: 'Badge Earned!',
        message: `You earned the "${badge}" badge`,
        data: {
          badge,
          url: '/profile',
        },
        priority: 'medium',
      });
    } catch (error) {
      console.error('Error creating badge notification:', error);
    }
  }

  // Send engagement notifications to active users
  static async sendEngagementNotifications() {
    try {
      const User = require('../models/User');
      const Post = require('../models/Post');

      // Get active users (logged in within last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const activeUsers = await User.find({
        'loginHistory.0': { $exists: true },
        'loginHistory.timestamp': { $gte: sevenDaysAgo }
      }).select('_id username');

      // Get recent posts (last 24 hours)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const recentPosts = await Post.find({
        status: 'active',
        createdAt: { $gte: oneDayAgo }
      })
      .populate('creator', 'username')
      .sort({ createdAt: -1 })
      .limit(5);

      if (recentPosts.length === 0) {
        console.log('No recent posts to notify about');
        return;
      }

      // Send notifications to active users
      for (const user of activeUsers) {
        try {
          // Check if user already received an engagement notification in the last 2 hours
          const twoHoursAgo = new Date();
          twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

          const recentNotification = await Notification.findOne({
            recipient: user._id,
            type: 'engagement_reminder',
            createdAt: { $gte: twoHoursAgo }
          });

          if (!recentNotification) {
            const randomPost = recentPosts[Math.floor(Math.random() * recentPosts.length)];

            await Notification.createNotification({
              recipient: user._id,
              type: 'engagement_reminder',
              title: 'New Posts Available! 🚀',
              message: `Check out "${randomPost.title}" and other fresh posts. Share and earn commissions!`,
              data: {
                postId: randomPost._id,
                postCount: recentPosts.length,
                url: '/marketplace',
              },
              priority: 'medium',
            });
          }
        } catch (userError) {
          console.error(`Error sending engagement notification to user ${user._id}:`, userError);
        }
      }

      console.log(`Sent engagement notifications to ${activeUsers.length} active users`);
    } catch (error) {
      console.error('Error sending engagement notifications:', error);
    }
  }
}

module.exports = NotificationService;