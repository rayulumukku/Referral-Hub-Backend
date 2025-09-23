const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema({
  referral: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Referral',
    required: true,
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  percentage: {
    type: Number,
    required: true,
  },
  level: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending',
  },
  paidAt: Date,
}, {
  timestamps: true,
});

module.exports = mongoose.model('Commission', commissionSchema);