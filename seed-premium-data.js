require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Post = require('./models/Post');
const Referral = require('./models/Referral');
const Commission = require('./models/Commission');
const Activity = require('./models/Activity');
const TrackingEvent = require('./models/TrackingEvent');
const bcrypt = require('bcryptjs');

async function seedPremiumUserData() {
  try {
    console.log('🌱 Starting comprehensive premium user data seeding...');

    // Find premium users
    const premiumUser = await User.findOne({ email: 'premium@demo.com' });
    const superPremiumUser = await User.findOne({ email: 'superpremium@demo.com' });

    if (!premiumUser || !superPremiumUser) {
      console.log('❌ Premium users not found. Please run server first to create demo users.');
      return;
    }

    console.log('✅ Found premium users:', premiumUser.username, superPremiumUser.username);

    // Clear existing data for demo users
    await Post.deleteMany({ creator: { $in: [premiumUser._id, superPremiumUser._id] } });
    await Referral.deleteMany({ $or: [{ referrer: { $in: [premiumUser._id, superPremiumUser._id] } }, { referee: { $in: [premiumUser._id, superPremiumUser._id] } }] });
    await Commission.deleteMany({ recipient: { $in: [premiumUser._id, superPremiumUser._id] } });
    await Activity.deleteMany({ user: { $in: [premiumUser._id, superPremiumUser._id] } });
    await TrackingEvent.deleteMany({ user: { $in: [premiumUser._id, superPremiumUser._id] } });

    // Clear existing dummy users
    await User.deleteMany({ email: { $regex: /^user\d+@demo\.com$/ } });

    console.log('🧹 Cleared existing demo data');

    // Create dummy users for referral network
    const dummyUsers = [];
    const userTypes = ['individual', 'company', 'enterprise'];
    const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Pune', 'Hyderabad', 'Kolkata', 'Ahmedabad'];

    for (let i = 1; i <= 50; i++) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('password123', salt);

      const dummyUser = new User({
        email: `user${i}@demo.com`,
        username: `user${i}`,
        password: hashedPassword,
        type: userTypes[Math.floor(Math.random() * userTypes.length)],
        credits: Math.floor(Math.random() * 100) + 10,
        profile: {
          name: `Demo User ${i}`,
          company: Math.random() > 0.5 ? `Company ${i}` : '',
          location: cities[Math.floor(Math.random() * cities.length)]
        },
        location: {
          city: cities[Math.floor(Math.random() * cities.length)],
          state: 'Maharashtra',
          country: 'India',
          timezone: 'Asia/Kolkata'
        },
        coordinates: { lat: 19.0760 + (Math.random() - 0.5) * 2, lng: 72.8777 + (Math.random() - 0.5) * 2 },
        deviceInfo: {
          browser: 'Chrome',
          os: 'Windows',
          device: 'desktop',
          userAgent: 'Mozilla/5.0',
          screenSize: { width: 1920, height: 1080 }
        },
        isVerified: Math.random() > 0.3,
        gamification: {
          totalPoints: Math.floor(Math.random() * 1000) + 100,
          level: Math.floor(Math.random() * 10) + 1,
          experience: Math.floor(Math.random() * 5000) + 500
        }
      });

      await dummyUser.save();
      dummyUsers.push(dummyUser);
    }

    console.log('👥 Created 50 dummy users for referral network');

    // Create posts for premium users
    const categories = ['job', 'product', 'digital', 'service'];
    const postTitles = [
      'Premium Wireless Headphones - Brand New',
      'Designer Handbag - Limited Edition',
      'Gaming Laptop - High Performance',
      'Smart Watch - Latest Model',
      'Professional Camera Kit',
      'Luxury Watch Collection',
      'Fitness Equipment Set',
      'Home Office Desk Setup',
      'Vintage Guitar - Collectible',
      'Drone with 4K Camera'
    ];

    const posts = [];
    const premiumUsers = [premiumUser, superPremiumUser];

    for (const creator of premiumUsers) {
      const numPosts = creator.status === 'super-premium' ? 8 : 5;

      for (let i = 0; i < numPosts; i++) {
        const postDate = new Date();
        postDate.setDate(postDate.getDate() - Math.floor(Math.random() * 30)); // Posts from last 30 days

        const post = new Post({
          creator: creator._id,
          title: postTitles[Math.floor(Math.random() * postTitles.length)] + ` (${i + 1})`,
          description: `High-quality ${categories[Math.floor(Math.random() * categories.length)]} item. Perfect condition, ready to use. Great value for money with excellent features.`,
          category: categories[Math.floor(Math.random() * categories.length)],
          originalPrice: Math.floor(Math.random() * 500) + 100,
          price: Math.floor(Math.random() * 300) + 50,
          photos: [
            'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
            'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
            'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
          ],
          pointsPool: creator.status === 'super-premium' ? 2000 : 1000,
          distributablePoints: creator.status === 'super-premium' ? 1800 : 900,
          platformFee: creator.status === 'super-premium' ? 200 : 100,
          reach: Math.floor(Math.random() * 1000) + 100,
          conversions: Math.floor(Math.random() * 50) + 5,
          status: Math.random() > 0.7 ? 'sold' : 'active',
          location: {
            latitude: 19.0760 + (Math.random() - 0.5) * 2,
            longitude: 72.8777 + (Math.random() - 0.5) * 2,
            city: cities[Math.floor(Math.random() * cities.length)],
            state: 'Maharashtra',
            country: 'India',
            timezone: 'Asia/Kolkata'
          },
          creationMetadata: {
            platform: 'web',
            device: 'desktop',
            browser: 'Chrome',
            userAgent: 'Mozilla/5.0',
            screenSize: { width: 1920, height: 1080 },
            ipAddress: '127.0.0.1',
            coordinates: { latitude: 19.0760, longitude: 72.8777, accuracy: 100 },
            networkInfo: { isp: 'Demo ISP', connectionType: 'wifi' },
            timezone: 'Asia/Kolkata',
            language: 'en-US',
            referrer: 'direct',
            sessionId: `session_${creator._id}_${i}`
          },
          createdAt: postDate
        });

        // Generate QR code (simplified for demo)
        post.referralLink = `http://localhost:3000/post/${post._id}`;
        post.qrCode = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

        await post.save();
        posts.push(post);

        // Create activity for post creation
        const activity = new Activity({
          user: creator._id,
          type: 'post_created',
          message: `Created post: ${post.title}`,
          details: {
            postId: post._id,
            postTitle: post.title,
            category: post.category,
            price: post.price
          },
          metadata: {
            platform: 'web',
            device: 'desktop',
            location: {
              city: post.location.city,
              state: post.location.state,
              country: post.location.country
            }
          }
        });
        await activity.save();
      }
    }

    console.log('📝 Created posts for premium users');

    // Create referral network
    const referrals = [];
    let referralChainIndex = 1;

    // Premium user referrals
    for (let i = 0; i < 15; i++) {
      const referee = dummyUsers[i];
      const referralDate = new Date();
      referralDate.setDate(referralDate.getDate() - Math.floor(Math.random() * 20));

      const referral = new Referral({
        post: posts[Math.floor(Math.random() * posts.length)]._id,
        referrer: premiumUser._id,
        referee: referee._id,
        level: 1,
        platform: 'web',
        device: 'desktop',
        location: {
          latitude: referee.coordinates.lat,
          longitude: referee.coordinates.lng,
          city: referee.location.city,
          state: referee.location.state,
          country: referee.location.country,
          timezone: referee.location.timezone,
          accuracy: 100
        },
        browser: 'Chrome',
        userAgent: referee.deviceInfo.userAgent,
        screenSize: referee.deviceInfo.screenSize,
        ipAddress: '127.0.0.1',
        coordinates: referee.coordinates,
        sessionId: `session_ref_${referralChainIndex++}`,
        chainPosition: 1,
        createdAt: referralDate
      });

      await referral.save();
      referrals.push(referral);

      // Update referee's referrer
      await User.findByIdAndUpdate(referee._id, { referrer: premiumUser._id });

      // Add to premium user's network
      await User.findByIdAndUpdate(premiumUser._id, {
        $addToSet: { 'network.directReferrals': referee._id }
      });

      // Create activity for referral
      const activity = new Activity({
        user: premiumUser._id,
        type: 'referral_shared',
        message: `Earned referral from ${referee.username}`,
        details: {
          refereeId: referee._id,
          refereeUsername: referee.username,
          referralLevel: 1
        },
        metadata: {
          platform: 'web',
          device: 'desktop',
          location: {
            city: referee.location.city,
            state: referee.location.state,
            country: referee.location.country
          }
        }
      });
      await activity.save();
    }

    // Super premium user referrals (more extensive network)
    for (let i = 15; i < 35; i++) {
      const referee = dummyUsers[i];
      const referralDate = new Date();
      referralDate.setDate(referralDate.getDate() - Math.floor(Math.random() * 25));

      const referral = new Referral({
        post: posts[Math.floor(Math.random() * posts.length)]._id,
        referrer: superPremiumUser._id,
        referee: referee._id,
        level: 1,
        platform: 'web',
        device: 'desktop',
        location: {
          latitude: referee.coordinates.lat,
          longitude: referee.coordinates.lng,
          city: referee.location.city,
          state: referee.location.state,
          country: referee.location.country,
          timezone: referee.location.timezone,
          accuracy: 100
        },
        browser: 'Chrome',
        userAgent: referee.deviceInfo.userAgent,
        screenSize: referee.deviceInfo.screenSize,
        ipAddress: '127.0.0.1',
        coordinates: referee.coordinates,
        sessionId: `session_ref_${referralChainIndex++}`,
        chainPosition: 1,
        createdAt: referralDate
      });

      await referral.save();
      referrals.push(referral);

      // Update referee's referrer
      await User.findByIdAndUpdate(referee._id, { referrer: superPremiumUser._id });

      // Add to super premium user's network
      await User.findByIdAndUpdate(superPremiumUser._id, {
        $addToSet: { 'network.directReferrals': referee._id }
      });

      // Create activity for referral
      const activity = new Activity({
        user: superPremiumUser._id,
        type: 'referral_shared',
        message: `Earned referral from ${referee.username}`,
        details: {
          refereeId: referee._id,
          refereeUsername: referee.username,
          referralLevel: 1
        },
        metadata: {
          platform: 'web',
          device: 'desktop',
          location: {
            city: referee.location.city,
            state: referee.location.state,
            country: referee.location.country
          }
        }
      });
      await activity.save();
    }

    console.log('🔗 Created level 1 referral networks');

    // Create multi-level referral chains (level 2 and 3)
    console.log('🔗 Creating multi-level referral chains...');

    // Level 2 referrals (referrals of referrals)
    for (let i = 0; i < 20; i++) {
      const level1Referee = dummyUsers[Math.floor(Math.random() * 35)]; // First 35 users who were referred
      const level2Referee = dummyUsers[35 + Math.floor(Math.random() * 15)]; // Next 15 users

      const referralDate = new Date();
      referralDate.setDate(referralDate.getDate() - Math.floor(Math.random() * 15));

      const referral = new Referral({
        post: posts[Math.floor(Math.random() * posts.length)]._id,
        referrer: level1Referee._id,
        referee: level2Referee._id,
        level: 2,
        platform: 'web',
        device: 'desktop',
        location: {
          latitude: level2Referee.coordinates.lat,
          longitude: level2Referee.coordinates.lng,
          city: level2Referee.location.city,
          state: level2Referee.location.state,
          country: level2Referee.location.country,
          timezone: level2Referee.location.timezone,
          accuracy: 100
        },
        browser: 'Chrome',
        userAgent: level2Referee.deviceInfo.userAgent,
        screenSize: level2Referee.deviceInfo.screenSize,
        ipAddress: '127.0.0.1',
        coordinates: level2Referee.coordinates,
        sessionId: `session_ref_level2_${referralChainIndex++}`,
        chainPosition: 2,
        createdAt: referralDate
      });

      await referral.save();
      referrals.push(referral);

      // Update referee's referrer
      await User.findByIdAndUpdate(level2Referee._id, { referrer: level1Referee._id });

      // Add to referrer's network
      await User.findByIdAndUpdate(level1Referee._id, {
        $addToSet: { 'network.directReferrals': level2Referee._id }
      });

      // Create activity for level 2 referral
      const activity = new Activity({
        user: level1Referee._id,
        type: 'referral_shared',
        message: `Earned level 2 referral from ${level2Referee.username}`,
        details: {
          refereeId: level2Referee._id,
          refereeUsername: level2Referee.username,
          referralLevel: 2
        },
        metadata: {
          platform: 'web',
          device: 'desktop',
          location: {
            city: level2Referee.location.city,
            state: level2Referee.location.state,
            country: level2Referee.location.country
          }
        }
      });
      await activity.save();
    }

    // Level 3 referrals (referrals of level 2 referrals)
    for (let i = 0; i < 10; i++) {
      const level2Referee = dummyUsers[35 + Math.floor(Math.random() * 15)]; // Level 2 users
      const level3Referee = dummyUsers[45 + Math.floor(Math.random() * 5)]; // Last 5 users

      const referralDate = new Date();
      referralDate.setDate(referralDate.getDate() - Math.floor(Math.random() * 10));

      const referral = new Referral({
        post: posts[Math.floor(Math.random() * posts.length)]._id,
        referrer: level2Referee._id,
        referee: level3Referee._id,
        level: 3,
        platform: 'web',
        device: 'mobile',
        location: {
          latitude: level3Referee.coordinates.lat,
          longitude: level3Referee.coordinates.lng,
          city: level3Referee.location.city,
          state: level3Referee.location.state,
          country: level3Referee.location.country,
          timezone: level3Referee.location.timezone,
          accuracy: 100
        },
        browser: 'Chrome',
        userAgent: level3Referee.deviceInfo.userAgent,
        screenSize: level3Referee.deviceInfo.screenSize,
        ipAddress: '127.0.0.1',
        coordinates: level3Referee.coordinates,
        sessionId: `session_ref_level3_${referralChainIndex++}`,
        chainPosition: 3,
        createdAt: referralDate
      });

      await referral.save();
      referrals.push(referral);

      // Update referee's referrer
      await User.findByIdAndUpdate(level3Referee._id, { referrer: level2Referee._id });

      // Add to referrer's network
      await User.findByIdAndUpdate(level2Referee._id, {
        $addToSet: { 'network.directReferrals': level3Referee._id }
      });

      // Create activity for level 3 referral
      const activity = new Activity({
        user: level2Referee._id,
        type: 'referral_shared',
        message: `Earned level 3 referral from ${level3Referee.username}`,
        details: {
          refereeId: level3Referee._id,
          refereeUsername: level3Referee.username,
          referralLevel: 3
        },
        metadata: {
          platform: 'web',
          device: 'mobile',
          location: {
            city: level3Referee.location.city,
            state: level3Referee.location.state,
            country: level3Referee.location.country
          }
        }
      });
      await activity.save();
    }

    console.log('🔗 Created multi-level referral chains');

    // Create commissions from sold posts
    const soldPosts = posts.filter(post => post.status === 'sold');
    const commissions = [];

    for (const post of soldPosts) {
      const saleDate = new Date();
      saleDate.setDate(saleDate.getDate() - Math.floor(Math.random() * 10));

      // Find a buyer from dummy users
      const buyer = dummyUsers[Math.floor(Math.random() * dummyUsers.length)];

      const commission = new Commission({
        post: post._id,
        recipient: post.creator,
        amount: Math.floor(post.price * 0.1), // 10% commission
        percentage: 10,
        distributionType: 'direct_share',
        totalPointsPool: post.pointsPool,
        platformFee: post.platformFee,
        distributableAmount: post.distributablePoints,
        saleDetails: {
          soldAt: saleDate,
          buyerInfo: {
            name: buyer.profile.name,
            email: buyer.email,
            phone: '+91-9876543210',
            address: `${buyer.location.city}, ${buyer.location.state}`
          },
          soldPrice: post.price
        },
        createdAt: saleDate
      });

      await commission.save();
      commissions.push(commission);

      // Update post with sale details
      await Post.findByIdAndUpdate(post._id, {
        soldDetails: {
          soldAt: saleDate,
          buyer: {
            name: buyer.profile.name,
            email: buyer.email,
            phone: '+91-9876543210',
            address: `${buyer.location.city}, ${buyer.location.state}`
          },
          soldPrice: post.price
        }
      });

      // Create activity for sale
      const activity = new Activity({
        user: post.creator,
        type: 'commission_earned',
        message: `Post sold: ${post.title}`,
        details: {
          postId: post._id,
          postTitle: post.title,
          soldPrice: post.price,
          commission: commission.amount
        },
        metadata: {
          platform: 'web',
          device: 'desktop',
          location: {
            city: post.location.city,
            state: post.location.state,
            country: post.location.country
          }
        }
      });
      await activity.save();
    }

    console.log('💰 Created commissions from sold posts');

    // Create tracking events
    const trackingEvents = [];
    const eventTypes = ['view', 'click', 'share', 'engagement', 'time_spent', 'scroll_depth', 'conversion'];

    for (const user of [premiumUser, superPremiumUser]) {
      for (let i = 0; i < 20; i++) {
        const eventDate = new Date();
        eventDate.setDate(eventDate.getDate() - Math.floor(Math.random() * 30));

        const trackingEvent = new TrackingEvent({
          type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
          userId: user._id,
          platform: 'web',
          data: {
            device: user.deviceInfo.device,
            browser: user.deviceInfo.browser,
            platform: 'web',
            userAgent: user.deviceInfo.userAgent,
            screenSize: user.deviceInfo.screenSize,
            ipAddress: '127.0.0.1',
            coordinates: user.coordinates,
            city: user.location.city,
            state: user.location.state,
            country: user.location.country,
            timezone: user.location.timezone,
            sessionId: `session_${user._id}_${i}`,
            referrer: Math.random() > 0.5 ? 'google.com' : 'direct',
            timeSpent: Math.floor(Math.random() * 300) + 10,
            scrollDepth: Math.floor(Math.random() * 100) + 1
          },
          timestamp: eventDate
        });

        await trackingEvent.save();
        trackingEvents.push(trackingEvent);
      }
    }

    // Update post analytics with comprehensive detailed data
    console.log('📊 Updating post analytics with detailed metrics...');

    for (const post of posts) {
      // Add realistic view counts and engagement
      const viewCount = Math.floor(Math.random() * 1000) + 100;
      const conversionCount = Math.floor(viewCount * 0.08) + 1; // 8% conversion rate

      // Generate detailed analytics data
      const analyticsData = {
        views: viewCount,
        uniqueViewers: [], // Would be populated with actual user IDs
        shares: Math.floor(viewCount * 0.02),
        sharesByPlatform: {
          whatsapp: Math.floor(viewCount * 0.015),
          linkedin: Math.floor(viewCount * 0.003),
          twitter: Math.floor(viewCount * 0.002)
        },
        conversions: conversionCount,
        engagement: {
          likes: Math.floor(viewCount * 0.06),
          comments: Math.floor(viewCount * 0.03),
          bookmarks: Math.floor(viewCount * 0.04),
          reports: Math.floor(viewCount * 0.001)
        },
        totalTimeSpent: viewCount * 45, // 45 seconds average per view
        maxScrollDepth: Math.floor(Math.random() * 100) + 60,
        viewHistory: [],
        shareHistory: [],
        conversionHistory: [],
        engagementHistory: [],
        timeTracking: [],
        scrollTracking: []
      };

      // Generate detailed view history
      for (let i = 0; i < Math.min(viewCount, 50); i++) {
        const viewDate = new Date();
        viewDate.setDate(viewDate.getDate() - Math.floor(Math.random() * 30));

        analyticsData.viewHistory.push({
          userId: dummyUsers[Math.floor(Math.random() * dummyUsers.length)]._id,
          timestamp: viewDate,
          platform: ['web', 'mobile'][Math.floor(Math.random() * 2)],
          device: ['desktop', 'mobile', 'tablet'][Math.floor(Math.random() * 3)],
          browser: ['Chrome', 'Firefox', 'Safari', 'Edge'][Math.floor(Math.random() * 4)],
          ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
          referrer: Math.random() > 0.5 ? 'google.com' : 'direct',
          sessionId: `session_${Math.random().toString(36).substr(2, 9)}`
        });

        // Add time tracking
        analyticsData.timeTracking.push({
          userId: dummyUsers[Math.floor(Math.random() * dummyUsers.length)]._id,
          timeSpent: Math.floor(Math.random() * 300) + 30,
          timestamp: viewDate,
          sessionId: `session_${Math.random().toString(36).substr(2, 9)}`
        });

        // Add scroll tracking
        analyticsData.scrollTracking.push({
          userId: dummyUsers[Math.floor(Math.random() * dummyUsers.length)]._id,
          scrollDepth: Math.floor(Math.random() * 100) + 20,
          timestamp: viewDate,
          sessionId: `session_${Math.random().toString(36).substr(2, 9)}`
        });
      }

      // Generate engagement history
      for (let i = 0; i < analyticsData.engagement.likes; i++) {
        analyticsData.engagementHistory.push({
          userId: dummyUsers[Math.floor(Math.random() * dummyUsers.length)]._id,
          type: 'like',
          timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          metadata: { postId: post._id }
        });
      }

      for (let i = 0; i < analyticsData.engagement.comments; i++) {
        analyticsData.engagementHistory.push({
          userId: dummyUsers[Math.floor(Math.random() * dummyUsers.length)]._id,
          type: 'comment',
          timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          metadata: { postId: post._id, comment: 'Great post!' }
        });
      }

      await Post.findByIdAndUpdate(post._id, {
        reach: viewCount,
        conversions: conversionCount,
        'analytics.views': analyticsData.views,
        'analytics.uniqueViewers': analyticsData.uniqueViewers,
        'analytics.shares': analyticsData.shares,
        'analytics.sharesByPlatform': analyticsData.sharesByPlatform,
        'analytics.conversions': analyticsData.conversions,
        'analytics.engagement.likes': analyticsData.engagement.likes,
        'analytics.engagement.comments': analyticsData.engagement.comments,
        'analytics.engagement.bookmarks': analyticsData.engagement.bookmarks,
        'analytics.engagement.reports': analyticsData.engagement.reports,
        'analytics.totalTimeSpent': analyticsData.totalTimeSpent,
        'analytics.maxScrollDepth': analyticsData.maxScrollDepth,
        'analytics.viewHistory': analyticsData.viewHistory,
        'analytics.shareHistory': analyticsData.shareHistory,
        'analytics.conversionHistory': analyticsData.conversionHistory,
        'analytics.engagementHistory': analyticsData.engagementHistory,
        'analytics.timeTracking': analyticsData.timeTracking,
        'analytics.scrollTracking': analyticsData.scrollTracking
      });
    }

    console.log('📊 Enhanced post analytics with detailed metrics');

    // Create journey map data for premium users
    console.log('🗺️ Creating journey map data...');

    const journeyMapData = {};

    for (const user of [premiumUser, superPremiumUser]) {
      const userReferrals = await Referral.find({ referrer: user._id })
        .populate('referee', 'username profile location coordinates deviceInfo')
        .sort({ createdAt: 1 });

      const locations = [];

      // Add the hub (original user)
      locations.push({
        coords: [user.coordinates.lat, user.coordinates.lng],
        person: user.username,
        name: user.location.city,
        state: user.location.state,
        level: 0,
        time: user.createdAt.toISOString().split('T')[0],
        device: user.deviceInfo.device,
        earnings: 0,
        clicks: 0
      });

      // Add referral locations
      for (let i = 0; i < userReferrals.length; i++) {
        const referral = userReferrals[i];
        const referee = referral.referee;

        locations.push({
          coords: [referee.coordinates.lat, referee.coordinates.lng],
          person: referee.username,
          name: referee.location.city,
          state: referee.location.state,
          level: referral.level,
          time: referral.createdAt.toISOString().split('T')[0],
          device: referral.device,
          earnings: referral.level * 50, // Points based on level
          clicks: Math.floor(Math.random() * 100) + 10
        });
      }

      journeyMapData[user._id.toString()] = locations;
    }

    // Save journey map data to a simple JSON file or database
    // For demo purposes, we'll create a simple endpoint to serve this data
    const fs = require('fs');
    const path = require('path');

    const journeyDataPath = path.join(__dirname, 'journey-map-data.json');
    fs.writeFileSync(journeyDataPath, JSON.stringify(journeyMapData, null, 2));

    console.log('🗺️ Created journey map data');

    // Update user statistics
    const premiumStats = await calculateUserStats(premiumUser._id);
    const superPremiumStats = await calculateUserStats(superPremiumUser._id);

    await User.findByIdAndUpdate(premiumUser._id, {
      credits: premiumStats.totalCredits,
      'gamification.totalPoints': premiumStats.totalPoints,
      'gamification.level': Math.floor(premiumStats.totalPoints / 100) + 1,
      'gamification.experience': premiumStats.totalPoints * 10,
      'network.level': premiumStats.networkLevel,
      'network.directReferrals': premiumStats.directReferrals
    });

    await User.findByIdAndUpdate(superPremiumUser._id, {
      credits: superPremiumStats.totalCredits,
      'gamification.totalPoints': superPremiumStats.totalPoints,
      'gamification.level': Math.floor(superPremiumStats.totalPoints / 100) + 1,
      'gamification.experience': superPremiumStats.totalPoints * 10,
      'network.level': superPremiumStats.networkLevel,
      'network.directReferrals': superPremiumStats.directReferrals
    });

    console.log('📈 Updated user statistics');

    console.log('🎉 Premium user data seeding completed successfully!');
    console.log('📊 Summary:');
    console.log(`   👥 Dummy users: ${dummyUsers.length}`);
    console.log(`   📝 Posts: ${posts.length}`);
    console.log(`   🔗 Referrals: ${referrals.length}`);
    console.log(`   💰 Commissions: ${commissions.length}`);
    console.log(`   📊 Tracking events: ${trackingEvents.length}`);

  } catch (error) {
    console.error('❌ Error seeding premium user data:', error);
  }
}

async function calculateUserStats(userId) {
  const posts = await Post.find({ creator: userId });
  const referrals = await Referral.find({ referrer: userId });
  const commissions = await Commission.find({ recipient: userId });
  const activities = await Activity.find({ user: userId });

  const totalCredits = commissions.reduce((sum, comm) => sum + comm.amount, 0) + 2500; // Base credits
  const totalPoints = activities.reduce((sum, act) => sum + (act.points || 0), 0);
  const networkLevel = Math.max(1, Math.floor(referrals.length / 5) + 1);
  const directReferrals = referrals.map(ref => ref.referee);

  return {
    totalCredits,
    totalPoints,
    networkLevel,
    directReferrals
  };
}

// Run the seeding
if (require.main === module) {
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/referralhub')
    .then(() => {
      console.log('Connected to MongoDB');
      return seedPremiumUserData();
    })
    .then(() => {
      console.log('Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedPremiumUserData };