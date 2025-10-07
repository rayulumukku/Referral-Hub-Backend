const mongoose = require('mongoose');

const referralChainSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },
  chainId: {
    type: String,
    required: true,
    unique: true
  },
  originalCreator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  chainHead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  chainMembers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    position: {
      type: Number,
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    platform: {
      type: String,
      enum: ['web', 'whatsapp', 'linkedin', 'twitter', 'telegram', 'instagram', 'facebook', 'email', 'sms', 'copy']
    },
    device: {
      type: String,
      enum: ['mobile', 'desktop', 'tablet']
    },
    browser: String,
    location: {
      from: {
        city: String,
        state: String,
        country: String,
        coordinates: {
          lat: Number,
          lng: Number
        }
      },
      to: {
        city: String,
        state: String,
        country: String,
        coordinates: {
          lat: Number,
          lng: Number
        }
      }
    },
    referralLink: String,
    clickCount: {
      type: Number,
      default: 0
    },
    shareCount: {
      type: Number,
      default: 0
    },
    engagementScore: {
      type: Number,
      default: 0
    }
  }],
  totalClicks: {
    type: Number,
    default: 0
  },
  totalShares: {
    type: Number,
    default: 0
  },
  conversionOccurred: {
    type: Boolean,
    default: false
  },
  conversionUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  conversionDate: Date,
  commissionDistributed: {
    type: Boolean,
    default: false
  },
  commissionDistribution: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    amount: Number,
    percentage: Number,
    position: Number,
    distributionType: {
      type: String,
      enum: ['last_person', 'chain_head', 'middle_members']
    }
  }],
  analytics: {
    platformDistribution: mongoose.Schema.Types.Mixed,
    deviceDistribution: mongoose.Schema.Types.Mixed,
    browserDistribution: mongoose.Schema.Types.Mixed,
    locationDistribution: mongoose.Schema.Types.Mixed,
    timeDistribution: mongoose.Schema.Types.Mixed,
    engagementMetrics: mongoose.Schema.Types.Mixed
  },
  status: {
    type: String,
    enum: ['active', 'converted', 'expired'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
referralChainSchema.index({ post: 1, chainId: 1 });
referralChainSchema.index({ originalCreator: 1 });
referralChainSchema.index({ chainHead: 1 });
referralChainSchema.index({ 'chainMembers.user': 1 });
referralChainSchema.index({ conversionOccurred: 1 });

module.exports = mongoose.model('ReferralChain', referralChainSchema);
