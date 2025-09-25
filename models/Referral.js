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
    enum: ['web', 'whatsapp', 'linkedin', 'twitter', 'email'],
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
    enum: ['desktop', 'mobile', 'tablet'],
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
  referrer: String,
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
}, {
  timestamps: true,
});

module.exports = mongoose.model('Referral', referralSchema);