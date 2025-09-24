const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');

async function setupAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/referralhub');
    console.log('Connected to MongoDB');

    // Check if admin user exists
    const existingAdmin = await User.findOne({ email: 'admin@referralhub.com' });

    if (existingAdmin) {
      console.log('✅ Admin user already exists:');
      console.log('   Email: admin@referralhub.com');
      console.log('   Username:', existingAdmin.username);
      console.log('   Role:', existingAdmin.role);
      console.log('   Type:', existingAdmin.type);

      // Ensure admin role is set
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        await existingAdmin.save();
        console.log('✅ Admin role updated');
      }
    } else {
      console.log('📝 Creating admin user...');

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);

      const adminUser = new User({
        email: 'admin@referralhub.com',
        username: 'admin',
        password: hashedPassword,
        type: 'enterprise',
        credits: 100,
        role: 'admin'
      });

      await adminUser.save();
      console.log('✅ Admin user created successfully!');
      console.log('   Email: admin@referralhub.com');
      console.log('   Password: admin123');
      console.log('   Username: admin');
      console.log('   Role: admin');
    }

    await mongoose.disconnect();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error setting up admin:', error);
    process.exit(1);
  }
}

setupAdmin();