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
  price: Number,
  creditsCost: {
    type: Number,
    default: 1000,
  },
  referralLink: {
    type: String,
    unique: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
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
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Post', postSchema);