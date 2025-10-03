const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');
const Post = require('../models/Post');
const Referral = require('../models/Referral');
const Commission = require('../models/Commission');
const Activity = require('../models/Activity');
const Comment = require('../models/Comment');
const Like = require('../models/Like');
const Badge = require('../models/Badge');
const PostAnalytics = require('../models/PostAnalytics');
const TrackingEvent = require('../models/TrackingEvent');

async function seedData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/referralhub');
    console.log('Connected to MongoDB');

    // Clear existing data
    console.log('Clearing existing data...');
    await Promise.all([
      User.deleteMany({}),
      Post.deleteMany({}),
      Referral.deleteMany({}),
      Commission.deleteMany({}),
      Activity.deleteMany({}),
      Comment.deleteMany({}),
      Like.deleteMany({}),
      Badge.deleteMany({}),
      PostAnalytics.deleteMany({}),
      TrackingEvent.deleteMany({})
    ]);

    // Create badges first
    console.log('Creating badges...');
    const badges = await createBadges();

    // Create users
    console.log('Creating users...');
    const users = await createUsers();

    // Create posts
    console.log('Creating posts...');
    const posts = await createPosts(users);

    // Create referral chains
    console.log('Creating referral chains...');
    const referrals = await createReferrals(users, posts);

    // Create commissions
    console.log('Creating commissions...');
    await createCommissions(referrals, posts);

    // Create activities
    console.log('Creating activities...');
    await createActivities(users, posts, referrals);

    // Create comments and likes
    console.log('Creating comments and likes...');
    await createCommentsAndLikes(users, posts);

    // Create analytics data for premium users
    console.log('Creating analytics data...');
    await createAnalyticsData(users, posts);

    // Assign badges to users
    console.log('Assigning badges...');
    await assignBadges(users, badges);

    console.log('✅ Dummy data seeded successfully!');
    console.log(`Created ${users.length} users, ${posts.length} posts, ${referrals.length} referrals`);

  } catch (error) {
    console.error('❌ Error seeding data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
  }
}

async function createBadges() {
  const badgeData = [
    {
      name: 'First Referral',
      description: 'Made your first referral',
      icon: '🎯',
      category: 'referral',
      criteria: { type: 'referrals_count', value: 1 },
      rarity: 'common',
      points: 10
    },
    {
      name: 'Referral Master',
      description: 'Made 10 referrals',
      icon: '🏆',
      category: 'referral',
      criteria: { type: 'referrals_count', value: 10 },
      rarity: 'rare',
      points: 50
    },
    {
      name: 'Network Builder',
      description: 'Built a network of 5 direct referrals',
      icon: '🌐',
      category: 'referral',
      criteria: { type: 'network_size', value: 5 },
      rarity: 'epic',
      points: 100
    },
    {
      name: 'Content Creator',
      description: 'Created 5 posts',
      icon: '✍️',
      category: 'engagement',
      criteria: { type: 'posts_created', value: 5 },
      rarity: 'common',
      points: 25
    },
    {
      name: 'Top Earner',
      description: 'Earned 1000 points',
      icon: '💰',
      category: 'earning',
      criteria: { type: 'earnings_amount', value: 1000 },
      rarity: 'legendary',
      points: 200
    },
    {
      name: 'Engagement King',
      description: 'Received 50 likes on posts',
      icon: '❤️',
      category: 'engagement',
      criteria: { type: 'special_action', value: 50 },
      rarity: 'rare',
      points: 75
    }
  ];

  const createdBadges = [];
  for (const badge of badgeData) {
    const newBadge = new Badge(badge);
    await newBadge.save();
    createdBadges.push(newBadge);
  }
  return createdBadges;
}

async function createUsers() {
  const userData = [
    {
      email: 'admin@referralhub.com',
      username: 'admin',
      password: 'admin123',
      type: 'enterprise',
      role: 'admin',
      profile: { name: 'Admin User', company: 'ReferralHub' },
      credits: 1000,
      gamification: { totalPoints: 500, level: 5, experience: 2500 }
    },
    // Premium Demo User - High activity, excellent badges
    {
      email: 'premium@demo.com',
      username: 'premium_user',
      password: 'demo123',
      type: 'enterprise',
      status: 'premium',
      profile: { name: 'Premium Demo User', company: 'Tech Innovators Inc.' },
      credits: 2500,
      gamification: { totalPoints: 2500, level: 15, experience: 12500 }
    },
    // Super Premium Demo User - Maximum activity, all badges
    {
      email: 'superpremium@demo.com',
      username: 'super_premium',
      password: 'demo123',
      type: 'enterprise',
      status: 'super-premium',
      profile: { name: 'Super Premium Demo', company: 'Global Solutions Ltd.' },
      credits: 5000,
      gamification: { totalPoints: 5000, level: 25, experience: 25000 }
    },
    {
      email: 'john@techcorp.com',
      username: 'john_tech',
      password: 'password123',
      type: 'enterprise',
      profile: { name: 'John Smith', company: 'TechCorp' },
      credits: 500,
      gamification: { totalPoints: 300, level: 3, experience: 1500 }
    },
    {
      email: 'sarah@designstudio.com',
      username: 'sarah_design',
      password: 'password123',
      type: 'company',
      profile: { name: 'Sarah Johnson', company: 'Design Studio' },
      credits: 300,
      gamification: { totalPoints: 200, level: 2, experience: 1000 }
    },
    {
      email: 'mike@startup.io',
      username: 'mike_startup',
      password: 'password123',
      type: 'company',
      profile: { name: 'Mike Chen', company: 'Startup.io' },
      credits: 200,
      gamification: { totalPoints: 150, level: 2, experience: 750 }
    },
    {
      email: 'emma@freelancer.com',
      username: 'emma_free',
      password: 'password123',
      type: 'individual',
      profile: { name: 'Emma Wilson' },
      credits: 100,
      gamification: { totalPoints: 100, level: 1, experience: 500 }
    },
    {
      email: 'alex@consultant.com',
      username: 'alex_consult',
      password: 'password123',
      type: 'individual',
      profile: { name: 'Alex Brown' },
      credits: 150,
      gamification: { totalPoints: 120, level: 1, experience: 600 }
    },
    {
      email: 'lisa@marketing.com',
      username: 'lisa_market',
      password: 'password123',
      type: 'company',
      profile: { name: 'Lisa Davis', company: 'Marketing Pro' },
      credits: 250,
      gamification: { totalPoints: 180, level: 2, experience: 900 }
    },
    {
      email: 'david@developer.com',
      username: 'david_dev',
      password: 'password123',
      type: 'individual',
      profile: { name: 'David Lee' },
      credits: 80,
      gamification: { totalPoints: 80, level: 1, experience: 400 }
    },
    {
      email: 'anna@agency.com',
      username: 'anna_agency',
      password: 'password123',
      type: 'enterprise',
      profile: { name: 'Anna Taylor', company: 'Digital Agency' },
      credits: 400,
      gamification: { totalPoints: 250, level: 3, experience: 1250 }
    },
    {
      email: 'tom@retail.com',
      username: 'tom_retail',
      password: 'password123',
      type: 'company',
      profile: { name: 'Tom Wilson', company: 'Retail Plus' },
      credits: 180,
      gamification: { totalPoints: 140, level: 1, experience: 700 }
    }
  ];

  const createdUsers = [];
  for (const user of userData) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(user.password, salt);

    const newUser = new User({
      ...user,
      password: hashedPassword,
      location: { city: 'Mumbai', state: 'Maharashtra', country: 'India', timezone: 'Asia/Kolkata' },
      coordinates: { lat: 19.0760, lng: 72.8777 },
      deviceInfo: { browser: 'Chrome', os: 'Windows', device: 'desktop', userAgent: 'Mozilla/5.0' },
      network: { directReferrals: [], level: 1 }
    });

    await newUser.save();
    createdUsers.push(newUser);
  }

  // Set up referral relationships
  const john = createdUsers.find(u => u.username === 'john_tech');
  const sarah = createdUsers.find(u => u.username === 'sarah_design');
  const mike = createdUsers.find(u => u.username === 'mike_startup');
  const emma = createdUsers.find(u => u.username === 'emma_free');
  const alex = createdUsers.find(u => u.username === 'alex_consult');

  // John refers Sarah and Mike
  john.network.directReferrals = [sarah._id, mike._id];
  await john.save();

  // Sarah refers Emma
  sarah.network.directReferrals = [emma._id];
  await sarah.save();

  // Mike refers Alex
  mike.network.directReferrals = [alex._id];
  await mike.save();

  // Update referrer fields
  sarah.referrer = john._id;
  mike.referrer = john._id;
  emma.referrer = sarah._id;
  alex.referrer = mike._id;

  await sarah.save();
  await mike.save();
  await emma.save();
  await alex.save();

  return createdUsers;
}

async function createPosts(users) {
  const postData = [
    // Premium User Posts - High value, multiple posts
    {
      title: 'Enterprise Software Development Suite',
      description: 'Complete enterprise-grade software development platform with cloud deployment',
      category: 'digital',
      originalPrice: 25000,
      price: 22500,
      pointsPool: 2000,
      creator: users.find(u => u.username === 'premium_user')._id
    },
    {
      title: 'AI-Powered Business Analytics Platform',
      description: 'Advanced analytics platform with machine learning capabilities for enterprise',
      category: 'digital',
      originalPrice: 35000,
      price: 31500,
      pointsPool: 2000,
      creator: users.find(u => u.username === 'premium_user')._id
    },
    {
      title: 'Cloud Infrastructure Consulting',
      description: 'Expert cloud architecture and migration services for large enterprises',
      category: 'service',
      originalPrice: 15000,
      price: 13500,
      pointsPool: 2000,
      creator: users.find(u => u.username === 'premium_user')._id
    },
    {
      title: 'Cybersecurity Assessment Package',
      description: 'Comprehensive security audit and implementation for enterprise systems',
      category: 'service',
      originalPrice: 20000,
      price: 18000,
      pointsPool: 2000,
      creator: users.find(u => u.username === 'premium_user')._id
    },
    {
      title: 'Digital Transformation Strategy',
      description: 'Complete digital transformation roadmap and implementation services',
      category: 'service',
      originalPrice: 30000,
      price: 27000,
      pointsPool: 2000,
      creator: users.find(u => u.username === 'premium_user')._id
    },

    // Super Premium User Posts - Maximum value, diverse offerings
    {
      title: 'Global Enterprise Solutions Platform',
      description: 'World-class enterprise software solutions with 24/7 support and customization',
      category: 'digital',
      originalPrice: 50000,
      price: 45000,
      pointsPool: 2000,
      creator: users.find(u => u.username === 'super_premium')._id
    },
    {
      title: 'Blockchain & Web3 Development Suite',
      description: 'Complete blockchain development platform with smart contracts and DeFi solutions',
      category: 'digital',
      originalPrice: 75000,
      price: 67500,
      pointsPool: 2000,
      creator: users.find(u => u.username === 'super_premium')._id
    },
    {
      title: 'AI & Machine Learning Consulting',
      description: 'Expert AI/ML consulting with custom model development and deployment',
      category: 'service',
      originalPrice: 40000,
      price: 36000,
      pointsPool: 2000,
      creator: users.find(u => u.username === 'super_premium')._id
    },
    {
      title: 'Quantum Computing Solutions',
      description: 'Next-generation quantum computing platform and consulting services',
      category: 'digital',
      originalPrice: 100000,
      price: 90000,
      pointsPool: 2000,
      creator: users.find(u => u.username === 'super_premium')._id
    },
    {
      title: 'Global Expansion Strategy Services',
      description: 'Complete international market expansion and localization services',
      category: 'service',
      originalPrice: 60000,
      price: 54000,
      pointsPool: 2000,
      creator: users.find(u => u.username === 'super_premium')._id
    },
    {
      title: 'IoT Ecosystem Development',
      description: 'End-to-end IoT platform development with hardware and software integration',
      category: 'digital',
      originalPrice: 80000,
      price: 72000,
      pointsPool: 2000,
      creator: users.find(u => u.username === 'super_premium')._id
    },

    // Regular user posts
    {
      title: 'Premium Web Development Course',
      description: 'Complete full-stack web development course with React, Node.js, and MongoDB',
      category: 'digital',
      originalPrice: 5000,
      price: 4500,
      pointsPool: 1000,
      creator: users.find(u => u.username === 'john_tech')._id
    },
    {
      title: 'Professional Logo Design Service',
      description: 'Custom logo design with unlimited revisions and brand guidelines',
      category: 'service',
      originalPrice: 3000,
      price: 2700,
      pointsPool: 1000,
      creator: users.find(u => u.username === 'sarah_design')._id
    },
    {
      title: 'Smartphone Accessories Bundle',
      description: 'Complete smartphone protection kit - case, screen protector, and wireless charger',
      category: 'product',
      originalPrice: 2000,
      price: 1800,
      pointsPool: 1000,
      creator: users.find(u => u.username === 'mike_startup')._id
    },
    {
      title: 'Freelance Writing Services',
      description: 'Professional content writing, blog posts, and copywriting services',
      category: 'service',
      originalPrice: 1500,
      price: 1350,
      pointsPool: 1000,
      creator: users.find(u => u.username === 'emma_free')._id
    },
    {
      title: 'Digital Marketing Course',
      description: 'Learn SEO, social media marketing, and Google Ads from industry experts',
      category: 'digital',
      originalPrice: 4000,
      price: 3600,
      pointsPool: 1000,
      creator: users.find(u => u.username === 'lisa_market')._id
    },
    {
      title: 'Mobile App Development',
      description: 'Custom mobile app development for iOS and Android platforms',
      category: 'digital',
      originalPrice: 15000,
      price: 13500,
      pointsPool: 2000,
      creator: users.find(u => u.username === 'david_dev')._id
    },
    {
      title: 'Brand Identity Package',
      description: 'Complete brand identity design including logo, business cards, and stationery',
      category: 'service',
      originalPrice: 8000,
      price: 7200,
      pointsPool: 2000,
      creator: users.find(u => u.username === 'anna_agency')._id
    },
    {
      title: 'E-commerce Store Setup',
      description: 'Complete e-commerce website setup with payment integration and inventory management',
      category: 'digital',
      originalPrice: 10000,
      price: 9000,
      pointsPool: 2000,
      creator: users.find(u => u.username === 'tom_retail')._id
    },
    {
      title: 'Social Media Management',
      description: 'Professional social media management and content creation services',
      category: 'service',
      originalPrice: 2500,
      price: 2250,
      pointsPool: 1000,
      creator: users.find(u => u.username === 'alex_consult')._id
    },
    {
      title: 'Data Analysis Course',
      description: 'Learn data analysis with Python, pandas, and visualization tools',
      category: 'digital',
      originalPrice: 3500,
      price: 3150,
      pointsPool: 1000,
      creator: users.find(u => u.username === 'john_tech')._id
    }
  ];

  const createdPosts = [];
  for (const post of postData) {
    const platformFee = Math.floor(post.pointsPool * 0.1);
    const distributablePoints = post.pointsPool - platformFee;

    const newPost = new Post({
      ...post,
      platformFee,
      distributablePoints,
      referralLink: `https://referralhub.com/ref/${Math.random().toString(36).substr(2, 9)}`,
      location: {
        latitude: 19.0760 + (Math.random() - 0.5) * 2,
        longitude: 72.8777 + (Math.random() - 0.5) * 2,
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        timezone: 'Asia/Kolkata'
      },
      analytics: {
        views: Math.floor(Math.random() * 100) + 10,
        uniqueViewers: [],
        shares: Math.floor(Math.random() * 20),
        conversions: Math.floor(Math.random() * 5),
        engagement: {
          likes: 0,
          comments: 0,
          bookmarks: Math.floor(Math.random() * 10)
        }
      }
    });

    await newPost.save();
    createdPosts.push(newPost);
  }

  return createdPosts;
}

async function createReferrals(users, posts) {
  const referrals = [];
  const platforms = ['web', 'whatsapp', 'linkedin', 'twitter', 'email'];
  const devices = ['desktop', 'mobile', 'tablet'];
  const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];

  // Create referrals for each post
  for (const post of posts) {
    let referralCount;

    // Premium users get many more referrals
    const creator = users.find(u => u._id.toString() === post.creator.toString());
    if (creator.username === 'super_premium') {
      referralCount = Math.floor(Math.random() * 15) + 20; // 20-35 referrals per post
    } else if (creator.username === 'premium_user') {
      referralCount = Math.floor(Math.random() * 12) + 15; // 15-27 referrals per post
    } else {
      referralCount = Math.floor(Math.random() * 8) + 3; // 3-10 referrals per post
    }

    for (let i = 0; i < referralCount; i++) {
      const referrer = users[Math.floor(Math.random() * users.length)];
      const referee = users[Math.floor(Math.random() * users.length)];

      // Avoid self-referral
      if (referrer._id.toString() === referee._id.toString()) continue;

      const referral = new Referral({
        post: post._id,
        referrer: referrer._id,
        referee: referee._id,
        level: 1,
        platform: platforms[Math.floor(Math.random() * platforms.length)],
        location: {
          latitude: 19.0760 + (Math.random() - 0.5) * 5,
          longitude: 72.8777 + (Math.random() - 0.5) * 5,
          city: ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Pune', 'Hyderabad', 'Kolkata'][Math.floor(Math.random() * 7)],
          state: 'Maharashtra',
          country: 'India',
          timezone: 'Asia/Kolkata'
        },
        device: devices[Math.floor(Math.random() * devices.length)],
        browser: browsers[Math.floor(Math.random() * browsers.length)],
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        coordinates: {
          latitude: 19.0760 + (Math.random() - 0.5) * 5,
          longitude: 72.8777 + (Math.random() - 0.5) * 5
        },
        ipAddress: '127.0.0.1',
        networkInfo: { isp: 'Test ISP', connectionType: '4g' },
        clicks: Math.floor(Math.random() * 20) + 5, // More clicks for premium users
        shares: Math.floor(Math.random() * 5) + 1
      });

      await referral.save();
      referrals.push(referral);
    }
  }

  return referrals;
}

async function createCommissions(referrals, posts) {
  for (const referral of referrals) {
    const post = posts.find(p => p._id.toString() === referral.post.toString());
    if (!post) continue;

    const commission = new Commission({
      post: post._id,
      referral: referral._id,
      recipient: referral.referrer,
      amount: 25, // Fixed commission per referral
      percentage: 2.5, // 2.5% of distributable points
      distributionType: 'direct_share',
      chainPosition: 1,
      totalPointsPool: post.pointsPool,
      platformFee: post.platformFee,
      distributableAmount: post.distributablePoints,
      status: Math.random() > 0.3 ? 'paid' : 'pending'
    });

    await commission.save();
  }
}

async function createActivities(users, posts, referrals) {
  const activities = [];

  // User registration activities
  for (const user of users) {
    activities.push({
      type: 'user_registration',
      user: user._id,
      message: `${user.profile.name} joined ReferralHub`,
      metadata: {
        platform: 'web',
        device: 'desktop',
        location: { city: 'Mumbai', state: 'Maharashtra', country: 'India' },
        ip: '127.0.0.1'
      }
    });
  }

  // Post creation activities
  for (const post of posts) {
    const creator = users.find(u => u._id.toString() === post.creator.toString());
    activities.push({
      type: 'post_created',
      user: creator._id,
      post: post._id,
      message: `${creator.profile.name} created a new post: ${post.title}`,
      metadata: {
        platform: 'web',
        device: 'desktop',
        location: { city: 'Mumbai', state: 'Maharashtra', country: 'India' }
      }
    });
  }

  // Referral activities
  for (const referral of referrals.slice(0, 20)) { // Limit to 20 activities
    const referrer = users.find(u => u._id.toString() === referral.referrer.toString());
    activities.push({
      type: 'referral_shared',
      user: referrer._id,
      post: referral.post,
      referral: referral._id,
      message: `${referrer.profile.name} shared a referral link`,
      metadata: {
        platform: referral.platform,
        device: referral.device,
        location: referral.location
      }
    });
  }

  // Commission activities
  const commissions = await Commission.find({}).limit(15);
  for (const commission of commissions) {
    const recipient = users.find(u => u._id.toString() === commission.recipient.toString());
    activities.push({
      type: 'commission_earned',
      user: recipient._id,
      commission: commission._id,
      message: `${recipient.profile.name} earned ${commission.amount} points`,
      metadata: {
        platform: 'web',
        device: 'desktop'
      }
    });
  }

  // Save activities
  for (const activity of activities) {
    const newActivity = new Activity(activity);
    await newActivity.save();
  }
}

async function createCommentsAndLikes(users, posts) {
  // Create comments
  for (const post of posts) {
    const commentCount = Math.floor(Math.random() * 5) + 1; // 1-5 comments per post

    for (let i = 0; i < commentCount; i++) {
      const commenter = users[Math.floor(Math.random() * users.length)];
      const comment = new Comment({
        post: post._id,
        author: commenter._id,
        content: [
          'Great post! Very helpful information.',
          'Thanks for sharing this amazing content!',
          'This looks really promising. Will definitely try it out.',
          'Excellent work! Keep it up.',
          'Very informative and well explained.',
          'This is exactly what I was looking for.',
          'Impressive! The quality is outstanding.'
        ][Math.floor(Math.random() * 7)],
        metadata: {
          platform: 'web',
          device: 'desktop',
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0'
        }
      });

      await comment.save();

      // Update post analytics
      post.analytics.engagement.comments += 1;
      await post.save();
    }
  }

  // Create likes
  for (const post of posts) {
    const likeCount = Math.floor(Math.random() * 8) + 2; // 2-9 likes per post
    const likedUsers = new Set();

    for (let i = 0; i < likeCount; i++) {
      let liker;
      do {
        liker = users[Math.floor(Math.random() * users.length)];
      } while (likedUsers.has(liker._id.toString()));

      likedUsers.add(liker._id.toString());

      const like = new Like({
        user: liker._id,
        post: post._id,
        type: ['like', 'love', 'laugh'][Math.floor(Math.random() * 3)],
        metadata: {
          platform: 'web',
          device: 'desktop',
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0'
        }
      });

      await like.save();

      // Update post analytics
      post.analytics.engagement.likes += 1;
      await post.save();
    }
  }
}

async function assignBadges(users, badges) {
  for (const user of users) {
    const userReferrals = await Referral.countDocuments({ referrer: user._id });
    const userPosts = await Post.countDocuments({ creator: user._id });
    const userLikes = await Like.countDocuments({ user: user._id });

    // Premium and Super Premium users get ALL badges
    if (user.username === 'premium_user' || user.username === 'super_premium') {
      user.badges = badges.map(badge => ({ badge: badge._id, earnedAt: new Date() }));
    } else {
      // Regular users get badges based on achievements
      if (userReferrals >= 1) {
        user.badges.push({ badge: badges.find(b => b.name === 'First Referral')._id });
      }
      if (userReferrals >= 10) {
        user.badges.push({ badge: badges.find(b => b.name === 'Referral Master')._id });
      }
      if (user.network.directReferrals.length >= 5) {
        user.badges.push({ badge: badges.find(b => b.name === 'Network Builder')._id });
      }
      if (userPosts >= 5) {
        user.badges.push({ badge: badges.find(b => b.name === 'Content Creator')._id });
      }
      if (user.gamification.totalPoints >= 1000) {
        user.badges.push({ badge: badges.find(b => b.name === 'Top Earner')._id });
      }
      if (userLikes >= 50) {
        user.badges.push({ badge: badges.find(b => b.name === 'Engagement King')._id });
      }
    }

    await user.save();
  }
}

async function createAnalyticsData(users, posts) {
  const premiumUser = users.find(u => u.username === 'premium_user');
  const superPremiumUser = users.find(u => u.username === 'super_premium');

  // Create analytics data only for premium users' posts
  const premiumPosts = posts.filter(p =>
    p.creator.toString() === premiumUser._id.toString() ||
    p.creator.toString() === superPremiumUser._id.toString()
  );

  for (const post of premiumPosts) {
    const isSuperPremium = post.creator.toString() === superPremiumUser._id.toString();
    const eventMultiplier = isSuperPremium ? 3 : 2; // Super premium gets 3x more events

    // Create PostAnalytics events
    const eventCount = Math.floor(Math.random() * 50) + 100; // 100-150 events per post

    for (let i = 0; i < eventCount * eventMultiplier; i++) {
      const eventType = ['view', 'click', 'share', 'conversion', 'interaction'][Math.floor(Math.random() * 5)];
      const platforms = ['web', 'whatsapp', 'linkedin', 'twitter', 'email', 'facebook', 'instagram', 'telegram'];
      const devices = ['desktop', 'mobile', 'tablet'];
      const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];

      const analyticsEvent = new PostAnalytics({
        post: post._id,
        user: users[Math.floor(Math.random() * users.length)]._id,
        sessionId: `session_${Math.random().toString(36).substr(2, 9)}`,
        type: eventType,
        platform: platforms[Math.floor(Math.random() * platforms.length)],
        device: devices[Math.floor(Math.random() * devices.length)],
        browser: browsers[Math.floor(Math.random() * browsers.length)],
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        screenSize: { width: 1920, height: 1080 },
        location: {
          latitude: 19.0760 + (Math.random() - 0.5) * 10,
          longitude: 72.8777 + (Math.random() - 0.5) * 10,
          city: ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Pune', 'Hyderabad', 'Kolkata', 'Ahmedabad'][Math.floor(Math.random() * 8)],
          state: 'Maharashtra',
          country: 'India',
          timezone: 'Asia/Kolkata'
        },
        ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
        referrer: 'https://google.com',
        language: 'en-US',
        networkInfo: {
          isp: 'Test ISP',
          connectionType: '4g'
        },
        timeSpent: Math.floor(Math.random() * 300) + 30, // 30-330 seconds
        scrollDepth: Math.floor(Math.random() * 100) + 1, // 1-100%
        timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Last 30 days
      });

      await analyticsEvent.save();
    }

    // Create TrackingEvent records
    const trackingCount = Math.floor(Math.random() * 30) + 50; // 50-80 tracking events per post

    for (let i = 0; i < trackingCount * eventMultiplier; i++) {
      const trackingType = ['view', 'click', 'share', 'engagement', 'time_spent', 'scroll_depth', 'conversion'][Math.floor(Math.random() * 7)];
      const platforms = ['web', 'whatsapp', 'linkedin', 'twitter', 'telegram', 'email', 'copy'];

      const trackingEvent = new TrackingEvent({
        type: trackingType,
        postId: post._id,
        userId: users[Math.floor(Math.random() * users.length)]._id,
        platform: platforms[Math.floor(Math.random() * platforms.length)],
        engagementType: ['like', 'bookmark', 'comment', 'view', 'share'][Math.floor(Math.random() * 5)],
        data: {
          device: ['mobile', 'desktop', 'tablet'][Math.floor(Math.random() * 3)],
          browser: ['Chrome', 'Firefox', 'Safari', 'Edge'][Math.floor(Math.random() * 4)],
          platform: 'web',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          screenSize: { width: 1920, height: 1080 },
          ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
          coordinates: {
            latitude: 19.0760 + (Math.random() - 0.5) * 10,
            longitude: 72.8777 + (Math.random() - 0.5) * 10
          },
          city: ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Pune'][Math.floor(Math.random() * 5)],
          state: 'Maharashtra',
          country: 'India',
          timezone: 'Asia/Kolkata',
          sessionId: `session_${Math.random().toString(36).substr(2, 9)}`,
          referrer: 'https://google.com',
          timeSpent: Math.floor(Math.random() * 300) + 30,
          scrollDepth: Math.floor(Math.random() * 100) + 1
        },
        timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
      });

      await trackingEvent.save();
    }
  }
}

seedData();