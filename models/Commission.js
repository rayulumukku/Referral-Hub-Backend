const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
  },
  referral: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Referral',
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
  distributionType: {
    type: String,
    enum: ['platform_fee', 'direct_share', 'chain_first', 'chain_last', 'chain_remaining'],
    required: true,
  },
  chainPosition: Number, // Position in the referral chain
  totalPointsPool: Number, // Total points available for distribution
  platformFee: Number, // 10% deducted
  distributableAmount: Number, // Amount after platform fee
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending',
  },
  paidAt: Date,
  saleDetails: {
    soldAt: Date,
    buyerInfo: {
      name: String,
      email: String,
      phone: String,
      address: String,
    },
    soldPrice: Number,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Commission', commissionSchema);