const mongoose = require('mongoose');

const trackingEventSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['view', 'click', 'share', 'engagement', 'time_spent', 'scroll_depth', 'conversion'],
    required: true,
  },
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
  },
  referralId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Referral',
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  platform: {
    type: String,
    enum: ['web', 'whatsapp', 'linkedin', 'twitter', 'telegram', 'email', 'copy'],
  },
  engagementType: {
    type: String,
    enum: ['like', 'bookmark', 'comment', 'view', 'share'],
  },
  data: {
    // Device and browser info
    device: {
      type: String,
      enum: ['mobile', 'desktop', 'tablet'],
    },
    browser: String,
    platform: String,
    userAgent: String,
    screenSize: {
      width: Number,
      height: Number,
    },

    // Location and network
    ipAddress: String,
    coordinates: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
    },
    city: String,
    state: String,
    country: String,
    timezone: String,

    // Session and referrer
    sessionId: String,
    referrer: String,
    referrerUrl: String,

    // Engagement metrics
    timeSpent: Number, // in seconds
    scrollDepth: Number, // percentage
    clickPosition: {
      x: Number,
      y: Number,
    },

    // Conversion data
    conversionValue: Number,
    conversionType: String,

    // Additional metadata
    metadata: mongoose.Schema.Types.Mixed,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  processed: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Indexes for efficient queries
trackingEventSchema.index({ postId: 1, type: 1, timestamp: -1 });
trackingEventSchema.index({ userId: 1, timestamp: -1 });
trackingEventSchema.index({ sessionId: 1, timestamp: -1 });
trackingEventSchema.index({ type: 1, timestamp: -1 });
trackingEventSchema.index({ 'data.ipAddress': 1 });

// Static method to aggregate tracking data
trackingEventSchema.statics.getPostAnalytics = async function(postId, startDate, endDate) {
  const match = { postId };
  if (startDate && endDate) {
    match.timestamp = { $gte: startDate, $lte: endDate };
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        uniqueSessions: { $addToSet: '$data.sessionId' },
        uniqueUsers: { $addToSet: '$userId' },
        avgTimeSpent: { $avg: '$data.timeSpent' },
        maxScrollDepth: { $max: '$data.scrollDepth' },
        devices: { $addToSet: '$data.device' },
        browsers: { $addToSet: '$data.browser' },
        platforms: { $push: '$platform' },
      },
    },
  ]);
};

// Instance method to process event
trackingEventSchema.methods.process = async function() {
  if (this.processed) return;

  try {
    // Update post statistics based on event type
    if (this.postId) {
      const Post = require('./Post');
      const update = {};

      switch (this.type) {
        case 'view':
          update.$inc = { reach: 1 };
          break;
        case 'share':
          update.$inc = { shares: 1 };
          break;
        case 'conversion':
          update.$inc = { conversions: 1 };
          update.status = 'sold';
          break;
      }

      if (Object.keys(update).length > 0) {
        await Post.findByIdAndUpdate(this.postId, update);
      }
    }

    this.processed = true;
    await this.save();
  } catch (error) {
    console.error('Error processing tracking event:', error);
  }
};

module.exports = mongoose.model('TrackingEvent', trackingEventSchema);