const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: String,
  category: {
    type: String,
    enum: ['job', 'product', 'digital', 'service'],
    required: true,
  },
  originalPrice: Number,
  price: Number,
  pointsPool: {
    type: Number,
    enum: [1000, 2000],
    required: true,
    default: 1000,
  },
  platformFee: {
    type: Number,
    default: 0, // Will be calculated as 10% of pointsPool
  },
  distributablePoints: {
    type: Number,
    default: 0, // Will be pointsPool - platformFee
  },
  referralLink: {
    type: String,
    unique: true,
  },
  qrCode: String, // QR code data URL for referral link
  photos: [{
    type: String, // File paths or URLs
    max: 4
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'sold'],
    default: 'active',
  },
  soldDetails: {
    soldAt: Date,
    buyer: {
      name: String,
      email: String,
      phone: String,
      address: String
    },
    soldPrice: Number
  },
  conversions: {
    type: Number,
    default: 0,
  },
  reach: {
    type: Number,
    default: 0,
  },
  location: {
    latitude: Number,
    longitude: Number,
    city: String,
    state: String,
    country: String,
    timezone: String,
  },
  creationMetadata: {
    platform: {
      type: String,
      enum: ['web', 'mobile', 'desktop'],
      default: 'web'
    },
    device: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet'],
      default: 'desktop'
    },
    browser: String,
    userAgent: String,
    screenSize: {
      width: Number,
      height: Number
    },
    ipAddress: String,
    coordinates: {
      latitude: Number,
      longitude: Number,
      accuracy: Number
    },
    networkInfo: {
      isp: String,
      connectionType: String
    },
    timezone: String,
    language: String,
    referrer: String,
    sessionId: String
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Post', postSchema);