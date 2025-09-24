const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['user_registration', 'user_login', 'post_created', 'referral_shared', 'commission_earned', 'referral_click'],
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  },
  referral: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Referral'
  },
  commission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Commission'
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  message: {
    type: String,
    required: true
  },
  metadata: {
    platform: String,
    device: String,
    location: {
      city: String,
      state: String,
      country: String
    },
    ip: String,
    userAgent: String
  }
}, {
  timestamps: true
});

// Index for efficient queries
activitySchema.index({ type: 1, createdAt: -1 });
activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);