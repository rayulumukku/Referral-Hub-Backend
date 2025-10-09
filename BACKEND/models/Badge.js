const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    required: true,
  },
  icon: {
    type: String,
    required: true, // Emoji or icon name
  },
  category: {
    type: String,
    enum: ['referral', 'earning', 'engagement', 'achievement', 'special'],
    required: true,
  },
  criteria: {
    type: {
      type: String,
      enum: ['referrals_count', 'earnings_amount', 'posts_created', 'conversions_count', 'network_size', 'streak_days', 'special_action'],
      required: true,
    },
    value: {
      type: Number,
      required: true,
    },
    period: {
      type: String,
      enum: ['all_time', 'monthly', 'weekly', 'daily'],
      default: 'all_time',
    },
  },
  rarity: {
    type: String,
    enum: ['common', 'rare', 'epic', 'legendary'],
    default: 'common',
  },
  points: {
    type: Number,
    default: 0, // Points awarded when badge is earned
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Static method to check if user qualifies for badge
badgeSchema.statics.checkQualification = async function(userId, badgeId) {
  const badge = await this.findById(badgeId);
  if (!badge) return false;

  const User = require('./User');
  const user = await User.findById(userId).populate('network.directReferrals');
  if (!user) return false;

  switch (badge.criteria.type) {
    case 'referrals_count':
      return user.network.directReferrals.length >= badge.criteria.value;
    case 'earnings_amount':
      // This would need to be calculated from commissions
      return false; // Placeholder
    case 'posts_created':
      const Post = require('./Post');
      const postCount = await Post.countDocuments({ creator: userId });
      return postCount >= badge.criteria.value;
    case 'conversions_count':
      // This would need to be calculated from successful referrals
      return false; // Placeholder
    case 'network_size':
      return user.network.directReferrals.length >= badge.criteria.value;
    case 'streak_days':
      // This would need streak tracking
      return false; // Placeholder
    case 'special_action':
      // Custom logic for special badges
      return false; // Placeholder
    default:
      return false;
  }
};

module.exports = mongoose.model('Badge', badgeSchema);