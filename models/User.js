const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['enterprise', 'company', 'individual'],
    required: true,
  },
  credits: {
    type: Number,
    default: 0,
  },
  profile: {
    name: String,
    company: String,
    location: String,
  },
  network: {
    directReferrals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    level: Number,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  status: {
    type: String,
    enum: ['regular', 'premium', 'super-premium'],
    default: 'regular',
  },
  bankDetails: {
    accountNumber: String,
    ifsc: String,
    bankName: String,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', userSchema);