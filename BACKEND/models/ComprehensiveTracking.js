const mongoose = require('mongoose');

const ComprehensiveTrackingSchema = new mongoose.Schema({
  // Core tracking data
  sessionId: { type: String, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', index: true },
  referralId: { type: mongoose.Schema.Types.ObjectId, ref: 'Referral', index: true },
  
  // User journey tracking
  journey: {
    entryPoint: { type: String, enum: ['direct', 'referral', 'social', 'search', 'email', 'ads'] },
    referrer: { type: String }, // Where they came from
    landingPage: { type: String },
    exitPoint: { type: String },
    pagesVisited: [{ 
      page: String, 
      timestamp: Date, 
      timeSpent: Number,
      scrollDepth: Number,
      interactions: Number
    }],
    totalTimeSpent: { type: Number, default: 0 },
    bounceRate: { type: Number, default: 0 },
    conversionPath: [{ 
      step: Number, 
      action: String, 
      timestamp: Date,
      value: Number
    }]
  },

  // Device and environment tracking
  device: {
    type: { type: String, enum: ['mobile', 'tablet', 'desktop', 'tv', 'watch', 'other'] },
    brand: String,
    model: String,
    os: String,
    osVersion: String,
    browser: String,
    browserVersion: String,
    screenResolution: { width: Number, height: Number },
    colorDepth: Number,
    pixelRatio: Number,
    touchSupport: Boolean,
    orientation: { type: String, enum: ['portrait', 'landscape'] }
  },

  // Network and performance tracking
  network: {
    connectionType: { type: String, enum: ['wifi', 'cellular', 'ethernet', 'bluetooth', 'other'] },
    effectiveType: { type: String, enum: ['slow-2g', '2g', '3g', '4g', '5g'] },
    downlink: Number,
    rtt: Number, // Round trip time
    saveData: Boolean,
    isp: String,
    proxy: Boolean,
    vpn: Boolean
  },

  // Location and geospatial data
  location: {
    coordinates: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      altitude: Number,
      heading: Number,
      speed: Number
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String,
      timezone: String
    },
    ipInfo: {
      ip: String,
      country: String,
      region: String,
      city: String,
      isp: String,
      org: String,
      as: String,
      query: String
    }
  },

  // Engagement and behavior tracking
  engagement: {
    // Page interactions
    clicks: [{
      element: String,
      position: { x: Number, y: Number },
      timestamp: Date,
      duration: Number,
      context: String
    }],
    
    // Scroll behavior
    scrollEvents: [{
      position: Number,
      direction: String,
      timestamp: Date,
      speed: Number
    }],
    maxScrollDepth: { type: Number, default: 0 },
    avgScrollSpeed: { type: Number, default: 0 },
    
    // Mouse/touch behavior
    mouseMovements: [{
      x: Number,
      y: Number,
      timestamp: Date,
      pressure: Number
    }],
    touchEvents: [{
      type: String,
      x: Number,
      y: Number,
      timestamp: Date,
      force: Number
    }],
    
    // Focus and attention
    focusTime: { type: Number, default: 0 },
    attentionScore: { type: Number, default: 0 },
    distractionEvents: [{ 
      type: String, 
      timestamp: Date, 
      duration: Number 
    }],
    
    // Form interactions
    formInteractions: [{
      formId: String,
      fieldName: String,
      action: String,
      timestamp: Date,
      value: String,
      validationErrors: [String]
    }],
    
    // Video/audio interactions
    mediaInteractions: [{
      type: { type: String, enum: ['video', 'audio', 'image'] },
      action: { type: String, enum: ['play', 'pause', 'seek', 'volume', 'fullscreen'] },
      timestamp: Date,
      position: Number,
      duration: Number
    }]
  },

  // Social and sharing behavior
  social: {
    shares: [{
      platform: String,
      timestamp: Date,
      method: String, // native, custom, copy-link
      success: Boolean,
      reach: Number
    }],
    likes: [{
      platform: String,
      timestamp: Date,
      type: String // like, love, laugh, etc.
    }],
    comments: [{
      platform: String,
      timestamp: Date,
      content: String,
      sentiment: String
    }],
    mentions: [{
      platform: String,
      timestamp: Date,
      user: String,
      content: String
    }]
  },

  // Conversion and business metrics
  conversion: {
    funnelStage: { type: String, enum: ['awareness', 'interest', 'consideration', 'intent', 'evaluation', 'purchase'] },
    conversionValue: { type: Number, default: 0 },
    conversionType: { type: String, enum: ['sale', 'signup', 'download', 'contact', 'other'] },
    conversionTimestamp: Date,
    attribution: {
      source: String,
      medium: String,
      campaign: String,
      content: String,
      term: String
    },
    revenue: {
      amount: Number,
      currency: String,
      tax: Number,
      discount: Number
    }
  },

  // AI and predictive analytics
  ai: {
    userIntent: { type: String, enum: ['browse', 'research', 'compare', 'buy', 'learn', 'social'] },
    engagementLevel: { type: String, enum: ['low', 'medium', 'high', 'very-high'] },
    churnRisk: { type: Number, min: 0, max: 1 },
    lifetimeValue: Number,
    nextActionPrediction: String,
    recommendedContent: [String],
    sentimentScore: { type: Number, min: -1, max: 1 },
    emotionDetection: {
      primary: String,
      confidence: Number,
      secondary: [String]
    }
  },

  // Performance and technical metrics
  performance: {
    pageLoadTime: Number,
    domContentLoaded: Number,
    firstContentfulPaint: Number,
    largestContentfulPaint: Number,
    firstInputDelay: Number,
    cumulativeLayoutShift: Number,
    timeToInteractive: Number,
    totalBlockingTime: Number,
    memoryUsage: Number,
    cpuUsage: Number,
    networkLatency: Number,
    bandwidth: Number
  },

  // Security and fraud detection
  security: {
    riskScore: { type: Number, min: 0, max: 1 },
    fraudIndicators: [String],
    botDetection: {
      isBot: Boolean,
      confidence: Number,
      botType: String
    },
    suspiciousActivity: [{
      type: String,
      timestamp: Date,
      severity: String,
      description: String
    }]
  },

  // Custom events and business logic
  customEvents: [{
    name: String,
    category: String,
    action: String,
    label: String,
    value: Number,
    timestamp: Date,
    properties: mongoose.Schema.Types.Mixed
  }],

  // Session management
  session: {
    startTime: { type: Date, default: Date.now },
    endTime: Date,
    duration: Number,
    isActive: { type: Boolean, default: true },
    sessionQuality: { type: String, enum: ['poor', 'fair', 'good', 'excellent'] },
    exitReason: { type: String, enum: ['natural', 'timeout', 'error', 'abandon'] }
  },

  // Metadata and context
  metadata: {
    userAgent: String,
    referrer: String,
    language: String,
    timezone: String,
    utmParams: {
      source: String,
      medium: String,
      campaign: String,
      term: String,
      content: String
    },
    customDimensions: mongoose.Schema.Types.Mixed,
    tags: [String],
    notes: String
  }
}, {
  timestamps: true,
  collection: 'comprehensive_tracking'
});

// Indexes for performance
ComprehensiveTrackingSchema.index({ sessionId: 1, timestamp: -1 });
ComprehensiveTrackingSchema.index({ userId: 1, timestamp: -1 });
ComprehensiveTrackingSchema.index({ postId: 1, timestamp: -1 });
ComprehensiveTrackingSchema.index({ 'location.coordinates.latitude': 1, 'location.coordinates.longitude': 1 });
ComprehensiveTrackingSchema.index({ 'device.type': 1, 'device.browser': 1 });
ComprehensiveTrackingSchema.index({ 'conversion.funnelStage': 1, 'conversion.conversionTimestamp': -1 });
ComprehensiveTrackingSchema.index({ 'ai.userIntent': 1, 'ai.engagementLevel': 1 });
ComprehensiveTrackingSchema.index({ 'security.riskScore': 1, 'security.botDetection.isBot': 1 });

// Static methods for analytics
ComprehensiveTrackingSchema.statics.getUserJourney = async function(userId, timeRange = 30) {
  const startDate = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);
  
  return this.find({
    userId,
    'session.startTime': { $gte: startDate }
  })
  .sort({ 'session.startTime': 1 })
  .populate('postId', 'title description')
  .lean();
};

ComprehensiveTrackingSchema.statics.getPostAnalytics = async function(postId, timeRange = 30) {
  const startDate = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);
  
  return this.aggregate([
    {
      $match: {
        postId: mongoose.Types.ObjectId(postId),
        'session.startTime': { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
        avgEngagementScore: { $avg: '$engagement.attentionScore' },
        totalConversions: {
          $sum: {
            $cond: [{ $ne: ['$conversion.conversionTimestamp', null] }, 1, 0]
          }
        },
        avgSessionDuration: { $avg: '$session.duration' },
        topDevices: {
          $push: {
            type: '$device.type',
            browser: '$device.browser'
          }
        },
        topLocations: {
          $push: {
            city: '$location.address.city',
            country: '$location.address.country'
          }
        }
      }
    }
  ]);
};

ComprehensiveTrackingSchema.statics.getRealTimeStats = async function() {
  const lastHour = new Date(Date.now() - 60 * 60 * 1000);
  
  return this.aggregate([
    {
      $match: {
        'session.startTime': { $gte: lastHour }
      }
    },
    {
      $group: {
        _id: null,
        activeSessions: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
        totalEngagement: { $sum: '$engagement.attentionScore' },
        conversions: {
          $sum: {
            $cond: [{ $ne: ['$conversion.conversionTimestamp', null] }, 1, 0]
          }
        },
        avgPerformance: { $avg: '$performance.pageLoadTime' }
      }
    }
  ]);
};

module.exports = mongoose.model('ComprehensiveTracking', ComprehensiveTrackingSchema);
