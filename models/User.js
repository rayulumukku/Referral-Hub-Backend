const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
    minlength: 3,
    maxlength: 30,
    default: function() {
      return this.email ? this.email.split('@')[0] : 'user';
    }
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
  coordinates: {
    lat: Number,
    lng: Number,
  },
  location: {
    city: String,
    state: String,
    country: String,
    timezone: String,
  },
  deviceInfo: {
    browser: String,
    os: String,
    device: String,
    userAgent: String,
    screenSize: {
      width: Number,
      height: Number,
    },
  },
  ipAddress: String,
  signupData: {
    coordinates: {
      lat: Number,
      lng: Number,
    },
    location: {
      city: String,
      state: String,
      country: String,
      timezone: String,
    },
    deviceInfo: {
      browser: String,
      os: String,
      device: String,
      userAgent: String,
      screenSize: {
        width: Number,
        height: Number,
      },
    },
    ipAddress: String,
    timestamp: Date,
  },
  loginHistory: [{
    timestamp: Date,
    coordinates: {
      lat: Number,
      lng: Number,
    },
    location: {
      city: String,
      state: String,
      country: String,
      timezone: String,
    },
    deviceInfo: {
      browser: String,
      os: String,
      device: String,
      userAgent: String,
      screenSize: {
        width: Number,
        height: Number,
      },
    },
    ipAddress: String,
  }],
  referrer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  kyc: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    documents: {
      idType: String, // 'passport', 'driving_license', 'national_id'
      idNumber: String,
      idFront: String, // URL to uploaded document
      idBack: String, // URL to uploaded document
      selfie: String, // URL to selfie with ID
    },
    submittedAt: Date,
    reviewedAt: Date,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectionReason: String,
  },
  badges: [{
    badge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Badge',
    },
    earnedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  gamification: {
    totalPoints: {
      type: Number,
      default: 0,
    },
    level: {
      type: Number,
      default: 1,
    },
    experience: {
      type: Number,
      default: 0,
    },
    streak: {
      current: {
        type: Number,
        default: 0,
      },
      longest: {
        type: Number,
        default: 0,
      },
      lastActivity: Date,
    },
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', userSchema);