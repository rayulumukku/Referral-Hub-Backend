const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "https://referral-hub-frontend.vercel.app"],
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({
  origin: ["http://localhost:3000", "https://referral-hub-frontend.vercel.app"],
  credentials: true
}));
app.use(express.json());

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/referralhub')
.then(() => console.log('MongoDB connected'))
.catch(err => console.log(err));

// Socket IO
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join user room for personalized updates
  socket.on('join_user_room', (userId) => {
    if (userId) {
      socket.join(`user_${userId}`);
      console.log(`User ${userId} joined room user_${userId}`);
    }
  });

  // Join post room for post-specific updates
  socket.on('join_post_room', (postId) => {
    if (postId) {
      socket.join(`post_${postId}`);
      console.log(`User joined room post_${postId}`);
    }
  });

  // Join analytics room for global analytics
  socket.on('join_analytics_room', () => {
    socket.join('analytics');
    console.log('User joined analytics room');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Routes
const authRouter = require('./routes/auth');
authRouter.setIoInstance(io); // Pass io instance to auth router
app.use('/api/auth', authRouter);
const postsRouter = require('./routes/posts');
postsRouter.setIoInstance(io); // Pass io instance to posts router
app.use('/api/posts', postsRouter);
const referralsRouter = require('./routes/referrals');
referralsRouter.setIoInstance(io); // Pass io instance to referrals router
app.use('/api/referrals', referralsRouter);
const analyticsRouter = require('./routes/analytics');
analyticsRouter.setIoInstance && analyticsRouter.setIoInstance(io); // Pass io instance to analytics router if method exists
app.use('/api/analytics', analyticsRouter);
app.use('/api/admin', require('./routes/admin'));
console.log('All routes loaded');

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});