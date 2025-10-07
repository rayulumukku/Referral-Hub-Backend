const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  const Post = require('../models/Post');

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const targetBase = 'https://referral-hub-frontend.vercel.app';

    const posts = await Post.find({});
    console.log(`Scanning ${posts.length} posts...`);

    let updates = 0;
    for (const p of posts) {
      const desired = `${targetBase}/post/${p._id}`;
      if (p.referralLink !== desired) {
        p.referralLink = desired;
        updates++;
        await p.save();
        console.log(`Updated ${p._id} -> ${desired}`);
      }
    }

    console.log(`Done. Updated ${updates} posts.`);
  } catch (e) {
    console.error('Error fixing referral links:', e);
  } finally {
    await mongoose.disconnect();
  }
}

run();








