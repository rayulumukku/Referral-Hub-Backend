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
  },
  device: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet'],
  },
  browser: String,
  screenSize: String,
  clicks: {
    type: Number,
    default: 0,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  distance: Number, // in km
  timeTaken: Number, // in minutes
}, {
  timestamps: true,
});

module.exports = mongoose.model('Referral', referralSchema);