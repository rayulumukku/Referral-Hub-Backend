const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Use a safe JWT secret fallback to avoid crashes if env var is missing
const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_change_me_in_production';

const auth = async (req, res, next) => {
  try {
    console.log('=== AUTH MIDDLEWARE HIT ===');
    console.log('JWT_SECRET set:', !!process.env.JWT_SECRET);
    const authHeader = req.header('Authorization');
    console.log('Authorization header present:', !!authHeader);
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Missing or invalid Authorization header');
      return res.status(401).json({ message: 'Please authenticate' });
    }
    const token = authHeader.replace('Bearer ', '');
    console.log('Token extracted, length:', token.length);
    console.log('Verifying token with JWT_SECRET...');
    const decoded = jwt.verify(token, jwtSecret);
    console.log('Token decoded successfully, user ID:', decoded.id);
    const user = await User.findById(decoded.id);
    console.log('User lookup result:', !!user);

    if (!user) {
      console.log('User not found for ID:', decoded.id);
      throw new Error();
    }

    req.user = user;
    console.log('Auth middleware passed for user:', user.email);
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    res.status(401).json({ message: 'Please authenticate' });
  }
};

module.exports = auth;