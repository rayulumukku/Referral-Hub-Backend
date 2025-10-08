const mongoose = require('mongoose');

const referralChainSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
  },
  chainId: {
    type: String,
    required: true,
    unique: true,
  },
  originalSharer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  chain: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    position: {
      type: Number,
      required: true,
    },
    sharedAt: {
      type: Date,
      required: true,
    },
    platform: {
      type: String,
      enum: ['web', 'whatsapp', 'linkedin', 'twitter', 'email', 'telegram', 'instagram', 'facebook', 'mobile_messages', 'sms', 'other'],
      required: true,
    },
    device: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'smartphone', 'laptop', 'other'],
      required: true,
    },
    browser: String,
    userAgent: String,
    location: {
      city: String,
      state: String,
      country: String,
      coordinates: {
        latitude: Number,
        longitude: Number,
        accuracy: Number
      }
    },
    ipAddress: String,
    sessionId: String,
    referralId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Referral',
    },
    clicks: {
      type: Number,
      default: 0,
    },
    views: {
      type: Number,
      default: 0,
    },
    shares: {
      type: Number,
      default: 0,
    },
    engagement: {
      timeSpent: Number,
      scrollDepth: Number,
      interactions: [{
        type: {
          type: String,
          enum: ['click', 'share', 'view', 'scroll', 'hover', 'register', 'login']
        },
        timestamp: Date,
        duration: Number,
        metadata: mongoose.Schema.Types.Mixed
      }]
    }
  }],
  totalClicks: {
    type: Number,
    default: 0,
  },
  totalViews: {
    type: Number,
    default: 0,
  },
  totalShares: {
    type: Number,
    default: 0,
  },
  conversion: {
    converted: {
      type: Boolean,
      default: false,
    },
    convertedAt: Date,
    convertedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    conversionValue: Number,
    commissionDistributed: {
      type: Boolean,
      default: false,
    },
    commissionDetails: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      position: Number,
      commissionAmount: Number,
      commissionPercentage: Number,
      distributedAt: Date,
    }]
  },
  analytics: {
    platformBreakdown: {
      type: Map,
      of: Number,
      default: {},
    },
    deviceBreakdown: {
      type: Map,
      of: Number,
      default: {},
    },
    locationBreakdown: {
      type: Map,
      of: Number,
      default: {},
    },
    timeBreakdown: {
      hourly: {
        type: Map,
        of: Number,
        default: {},
      },
      daily: {
        type: Map,
        of: Number,
        default: {},
      },
    },
    journeyMap: [{
      from: {
        userId: mongoose.Schema.Types.ObjectId,
        location: {
          city: String,
          state: String,
          country: String,
          coordinates: {
            latitude: Number,
            longitude: Number
          }
        },
        timestamp: Date,
        platform: String,
        device: String
      },
      to: {
        userId: mongoose.Schema.Types.ObjectId,
        location: {
          city: String,
          state: String,
          country: String,
          coordinates: {
            latitude: Number,
            longitude: Number
          }
        },
        timestamp: Date,
        platform: String,
        device: String
      },
      distance: Number,
      travelTime: Number,
      clicks: Number,
      views: Number,
      shares: Number
    }]
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastActivity: {
    type: Date,
    default: Date.now,
  }
}, {
  timestamps: true,
});

// Indexes for better performance
referralChainSchema.index({ post: 1, chainId: 1 });
referralChainSchema.index({ originalSharer: 1 });
referralChainSchema.index({ 'chain.userId': 1 });
referralChainSchema.index({ 'conversion.converted': 1 });
referralChainSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ReferralChain', referralChainSchema);