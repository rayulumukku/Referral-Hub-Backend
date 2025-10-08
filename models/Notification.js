const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: [
      'referral_click',
      'referral_conversion',
      'commission_earned',
      'post_shared',
      'new_follower',
      'comment_received',
      'like_received',
      'system_announcement',
      'admin_message',
      'milestone_achieved',
      'level_up',
      'badge_earned',
      'engagement_reminder'
    ],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  data: {
    postId: mongoose.Schema.Types.ObjectId,
    referralId: mongoose.Schema.Types.ObjectId,
    commissionId: mongoose.Schema.Types.ObjectId,
    userId: mongoose.Schema.Types.ObjectId,
    amount: Number,
    level: Number,
    badge: String,
    url: String,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  },
  metadata: {
    platform: String,
    device: String,
    ipAddress: String,
    userAgent: String,
  },
}, {
  timestamps: true,
});

// Index for efficient queries
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to create notification
notificationSchema.statics.createNotification = async function(data) {
  const notification = new this(data);
  await notification.save();

  // Emit real-time notification
  const io = require('../server').getIo();
  if (io) {
    io.to(`notifications_${data.recipient}`).emit('notification', {
      ...notification.toObject(),
      recipient: notification.recipient,
    });
  }

  return notification;
};

// Instance method to mark as read
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  return this.save();
};

module.exports = mongoose.model('Notification', notificationSchema);