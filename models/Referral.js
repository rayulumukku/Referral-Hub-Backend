const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
  },
  referrer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  referee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  level: {
    type: Number,
    default: 1,
  },
  platform: {
    type: String,
    enum: ['web', 'whatsapp', 'linkedin', 'twitter', 'email', 'telegram', 'instagram', 'facebook', 'mobile_messages', 'sms', 'other'],
    required: true,
  },
  location: {
    latitude: Number,
    longitude: Number,
    city: String,
    state: String,
    country: String,
    timezone: String,
    accuracy: Number,
  },
  device: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet', 'smartphone', 'laptop', 'other'],
    required: true,
  },
  browser: String,
  userAgent: String,
  screenSize: {
    width: Number,
    height: Number,
  },
  ipAddress: String,
  networkInfo: {
    isp: String,
    connectionType: String,
  },
  coordinates: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
  },
  sessionId: String,
  language: String,
  clicks: {
    type: Number,
    default: 1, // Each referral represents at least 1 click
  },
  shares: {
    type: Number,
    default: 0,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  distance: Number, // in km from original post location
  timeTaken: Number, // in minutes from post creation
  chainPosition: Number, // Position in the referral chain
  parentReferral: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Referral',
  }, // Links to the referral that led to this one
  
  // Enhanced tracking fields
  journey: {
    fromLocation: {
      city: String,
      state: String,
      country: String,
      coordinates: {
        latitude: Number,
        longitude: Number
      }
    },
    toLocation: {
      city: String,
      state: String,
      country: String,
      coordinates: {
        latitude: Number,
        longitude: Number
      }
    },
    distance: Number, // Distance between from and to locations
    travelTime: Number // Time taken to travel between locations
  },
  
  // Click and engagement tracking
  engagement: {
    totalClicks: { type: Number, default: 1 },
    uniqueClicks: { type: Number, default: 1 },
    shares: { type: Number, default: 0 },
    timeSpent: Number, // Time spent on the post
    scrollDepth: Number, // How far user scrolled
    interactions: [{
      type: { type: String, enum: ['click', 'share', 'view', 'scroll', 'hover'] },
      timestamp: Date,
      duration: Number
    }]
  },
  
  // Referral chain tracking
  chain: {
    position: Number, // Position in the chain (0 = original sharer)
    totalInChain: Number, // Total people in this chain
    chainId: String, // Unique identifier for this referral chain
    isActive: { type: Boolean, default: true } // Whether this referral is still active
  },
  
  // Conversion tracking
  conversion: {
    converted: { type: Boolean, default: false },
    convertedAt: Date,
    conversionValue: Number,
    commissionEarned: Number
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('Referral', referralSchema);