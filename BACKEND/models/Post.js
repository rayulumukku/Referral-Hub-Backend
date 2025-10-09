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
  analytics: {
    views: {
      type: Number,
      default: 0,
    },
    uniqueViewers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    shares: {
      type: Number,
      default: 0,
    },
    sharesByPlatform: {
      type: Map,
      of: Number,
      default: {},
    },
    conversions: {
      type: Number,
      default: 0,
    },
    engagement: {
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      bookmarks: { type: Number, default: 0 },
      reports: { type: Number, default: 0 },
    },
    totalTimeSpent: {
      type: Number,
      default: 0, // in seconds
    },
    maxScrollDepth: {
      type: Number,
      default: 0, // percentage
    },
    viewHistory: [{
      userId: mongoose.Schema.Types.ObjectId,
      timestamp: Date,
      platform: String, // web, mobile, desktop
      device: String, // desktop, mobile, tablet, smartphone
      browser: String, // Chrome, Firefox, Safari, etc.
      browserVersion: String,
      ipAddress: String,
      referrer: String,
      sessionId: String,
      userAgent: String, // Full user agent string
      screenSize: {
        width: Number,
        height: Number
      },
      viewport: {
        width: Number,
        height: Number
      },
      os: String, // Windows, macOS, iOS, Android, Linux
      osVersion: String,
      deviceModel: String, // iPhone 14 Pro, Samsung Galaxy S23, etc.
      location: {
        city: String,
        state: String,
        country: String,
        coordinates: {
          latitude: Number,
          longitude: Number,
          accuracy: Number
        },
        timezone: String,
        locale: String
      },
      networkInfo: {
        connectionType: String, // 4g, 5g, wifi, ethernet
        effectiveType: String, // slow-2g, 2g, 3g, 4g
        downlink: Number, // Mbps
        rtt: Number, // Round trip time
        saveData: Boolean
      },
      language: String,
      isIncognito: Boolean,
      colorScheme: String, // light, dark
      touchSupport: Boolean
    }],
    shareHistory: [{
      userId: mongoose.Schema.Types.ObjectId,
      platform: String, // whatsapp, linkedin, twitter, facebook, telegram, email, etc.
      timestamp: Date,
      ipAddress: String,
      userAgent: String,
      device: String,
      browser: String,
      screenSize: {
        width: Number,
        height: Number
      },
      os: String,
      location: {
        city: String,
        state: String,
        country: String,
        coordinates: {
          latitude: Number,
          longitude: Number
        }
      },
      shareMethod: String, // native_share, copy_link, direct_platform
      sharedTo: String, // Platform or contact identifier
      fromLocation: { // Where they shared FROM
        page: String,
        section: String
      }
    }],
    conversionHistory: [{
      userId: mongoose.Schema.Types.ObjectId,
      timestamp: Date,
      amount: Number,
      currency: String,
      source: String,
    }],
    engagementHistory: [{
      userId: mongoose.Schema.Types.ObjectId,
      type: String,
      timestamp: Date,
      metadata: mongoose.Schema.Types.Mixed,
    }],
    timeTracking: [{
      userId: mongoose.Schema.Types.ObjectId,
      timeSpent: Number,
      timestamp: Date,
      sessionId: String,
    }],
    scrollTracking: [{
      userId: mongoose.Schema.Types.ObjectId,
      scrollDepth: Number,
      timestamp: Date,
      sessionId: String,
    }],
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