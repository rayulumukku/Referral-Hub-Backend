const mongoose = require('mongoose');

const ReferralChainMemberSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  position: {
    type: Number,
    required: true
  },
  sharedAt: {
    type: Date,
    default: Date.now
  },
  sharedTo: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    username: String,
    email: String,
    platform: String, // whatsapp, linkedin, twitter, telegram, etc.
    sharedAt: Date,
    device: String,
    browser: String,
    location: {
      city: String,
      state: String,
      country: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    },
    ipAddress: String,
    userAgent: String
  }],
  totalClicks: {
    type: Number,
    default: 0
  },
  totalShares: {
    type: Number,
    default: 0
  },
  totalViews: {
    type: Number,
    default: 0
  },
  engagementScore: {
    type: Number,
    default: 0
  },
  commissionEarned: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

const EnhancedReferralChainSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
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
  chainMembers: [ReferralChainMemberSchema],
  totalClicks: {
    type: Number,
    default: 0
  },
  totalShares: {
    type: Number,
    default: 0
  },
  totalViews: {
    type: Number,
    default: 0
  },
  conversionOccurred: {
    type: Boolean,
    default: false
  },
  conversionValue: {
    type: Number,
    default: 0
  },
  conversionDate: Date,
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  commissions: [{
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    amount: Number,
    percentage: Number,
    position: Number,
    status: {
      type: String,
      enum: ['pending', 'paid'],
      default: 'pending'
    },
    paidAt: Date
  }],
  status: {
    type: String,
    enum: ['active', 'converted', 'expired'],
    default: 'active'
  },
  platformDistribution: {
    whatsapp: { type: Number, default: 0 },
    linkedin: { type: Number, default: 0 },
    twitter: { type: Number, default: 0 },
    telegram: { type: Number, default: 0 },
    facebook: { type: Number, default: 0 },
    instagram: { type: Number, default: 0 },
    email: { type: Number, default: 0 },
    sms: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  },
  deviceDistribution: {
    mobile: { type: Number, default: 0 },
    desktop: { type: Number, default: 0 },
    tablet: { type: Number, default: 0 }
  },
  locationDistribution: {
    type: Map,
    of: Number
  },
  timeDistribution: {
    type: Map,
    of: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for better performance
EnhancedReferralChainSchema.index({ post: 1, createdAt: -1 });
EnhancedReferralChainSchema.index({ originalCreator: 1 });
EnhancedReferralChainSchema.index({ chainHead: 1 });
EnhancedReferralChainSchema.index({ status: 1 });
EnhancedReferralChainSchema.index({ 'chainMembers.userId': 1 });

module.exports = mongoose.model('EnhancedReferralChain', EnhancedReferralChainSchema);
