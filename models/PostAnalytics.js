const mongoose = require('mongoose');

const postAnalyticsSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  sessionId: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['view', 'click', 'share', 'conversion', 'interaction'],
    required: true,
  },
  platform: {
    type: String,
    enum: ['web', 'whatsapp', 'linkedin', 'twitter', 'email', 'facebook', 'instagram', 'telegram'],
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
  location: {
    latitude: Number,
    longitude: Number,
    city: String,
    state: String,
    country: String,
    timezone: String,
    accuracy: Number,
  },
  ipAddress: String,
  referrer: String,
  language: String,
  networkInfo: {
    isp: String,
    connectionType: String,
    effectiveType: String,
  },
  performance: {
    loadTime: Number, // in milliseconds
    domContentLoaded: Number,
    firstPaint: Number,
    largestContentfulPaint: Number,
  },
  interaction: {
    element: String, // which element was clicked/interacted with
    action: String, // what action was performed
    value: mongoose.Schema.Types.Mixed, // additional data
  },
  timeSpent: Number, // in seconds
  scrollDepth: Number, // percentage of page scrolled
  timestamp: {
    type: Date,
    default: Date.now,
  },
  metadata: {
    campaign: String,
    source: String,
    medium: String,
    term: String,
    content: String,
  },
}, {
  timestamps: true,
});

// Indexes for efficient queries
postAnalyticsSchema.index({ post: 1, type: 1, timestamp: -1 });
postAnalyticsSchema.index({ sessionId: 1, post: 1 });
postAnalyticsSchema.index({ user: 1, post: 1, type: 1 });
postAnalyticsSchema.index({ timestamp: 1 });

// Static methods for analytics
postAnalyticsSchema.statics.getPostStats = async function(postId, startDate, endDate) {
  const match = { post: postId };
  if (startDate && endDate) {
    match.timestamp = { $gte: startDate, $lte: endDate };
  }

  return await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: '$user' },
        uniqueSessions: { $addToSet: '$sessionId' },
        platforms: { $addToSet: '$platform' },
        devices: { $addToSet: '$device' },
        avgTimeSpent: { $avg: '$timeSpent' },
        avgScrollDepth: { $avg: '$scrollDepth' },
      },
    },
  ]);
};

postAnalyticsSchema.statics.getRealtimeStats = async function(postId, minutes = 60) {
  const since = new Date(Date.now() - minutes * 60 * 1000);

  return await this.aggregate([
    {
      $match: {
        post: postId,
        timestamp: { $gte: since },
      },
    },
    {
      $group: {
        _id: {
          type: '$type',
          minute: {
            $dateToString: {
              format: '%Y-%m-%d %H:%M',
              date: '$timestamp',
            },
          },
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { '_id.minute': 1 },
    },
  ]);
};

postAnalyticsSchema.statics.getGeographicStats = async function(postId) {
  return await this.aggregate([
    {
      $match: {
        post: postId,
        'location.country': { $exists: true },
      },
    },
    {
      $group: {
        _id: {
          country: '$location.country',
          city: '$location.city',
        },
        views: {
          $sum: { $cond: [{ $eq: ['$type', 'view'] }, 1, 0] },
        },
        clicks: {
          $sum: { $cond: [{ $eq: ['$type', 'click'] }, 1, 0] },
        },
        conversions: {
          $sum: { $cond: [{ $eq: ['$type', 'conversion'] }, 1, 0] },
        },
        latitude: { $first: '$location.latitude' },
        longitude: { $first: '$location.longitude' },
      },
    },
    {
      $sort: { views: -1 },
    },
  ]);
};

postAnalyticsSchema.statics.getDeviceStats = async function(postId) {
  return await this.aggregate([
    { $match: { post: postId } },
    {
      $group: {
        _id: {
          device: '$device',
          browser: '$browser',
        },
        views: {
          $sum: { $cond: [{ $eq: ['$type', 'view'] }, 1, 0] },
        },
        clicks: {
          $sum: { $cond: [{ $eq: ['$type', 'click'] }, 1, 0] },
        },
        interactions: {
          $sum: { $cond: [{ $eq: ['$type', 'interaction'] }, 1, 0] },
        },
      },
    },
  ]);
};

postAnalyticsSchema.statics.trackEvent = async function(data) {
  const event = new this(data);
  await event.save();

  // Emit real-time analytics update
  const io = require('../server').getIo();
  if (io) {
    io.to(`post_${data.post}`).emit('post_analytics_update', {
      postId: data.post,
      type: data.type,
      event: data,
      timestamp: new Date(),
    });
  }

  return event;
};

module.exports = mongoose.model('PostAnalytics', postAnalyticsSchema);