const User = require('../models/User');
const Referral = require('../models/Referral');

class NetworkService {
  // Calculate network levels for a user
  static async calculateNetworkLevels(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return { level1: 0, level2: 0, level3: 0, total: 0 };

      // Level 1: Direct referrals (users who have this user as referrer)
      const level1Users = await User.find({ referrer: userId }).select('_id');
      const level1 = level1Users.length;

      // Level 2: Users referred by level 1 users
      let level2 = 0;
      const level2Users = [];
      for (const level1User of level1Users) {
        const referrals = await User.find({ referrer: level1User._id }).select('_id');
        level2 += referrals.length;
        level2Users.push(...referrals);
      }

      // Level 3: Users referred by level 2 users
      let level3 = 0;
      for (const level2User of level2Users) {
        const referrals = await User.find({ referrer: level2User._id }).select('_id');
        level3 += referrals.length;
      }

      const total = level1 + level2 + level3;

      return { level1, level2, level3, total };
    } catch (error) {
      console.error('Error calculating network levels:', error);
      return { level1: 0, level2: 0, level3: 0, total: 0 };
    }
  }

  // Get complete referral chain for a user (for visualization)
  static async getReferralChain(userId) {
    try {
      const chain = [];
      const visited = new Set();

      const buildChain = async (currentUserId, level = 0) => {
        if (visited.has(currentUserId.toString())) return;
        visited.add(currentUserId.toString());

        const user = await User.findById(currentUserId)
          .select('username profile location createdAt')
          .populate('referrer', 'username');

        if (user) {
          chain.push({
            userId: user._id,
            username: user.username,
            name: user.profile?.name || user.username,
            location: user.profile?.location || 'Unknown',
            level,
            referrer: user.referrer?.username || null,
            joinedAt: user.createdAt
          });

          // Get direct referrals
          const referrals = await User.find({ referrer: currentUserId }).select('_id');
          for (const referral of referrals) {
            await buildChain(referral._id, level + 1);
          }
        }
      };

      await buildChain(userId, 0);
      return chain.sort((a, b) => a.level - b.level || a.joinedAt - b.joinedAt);
    } catch (error) {
      console.error('Error getting referral chain:', error);
      return [];
    }
  }

  // Get network growth data for analytics
  static async getNetworkGrowthData() {
    try {
      const allUsers = await User.find({}).select('referrer createdAt');
      const usersByMonth = {};

      // Group users by month
      allUsers.forEach(user => {
        const month = user.createdAt.toISOString().slice(0, 7); // YYYY-MM
        if (!usersByMonth[month]) {
          usersByMonth[month] = { total: 0, referred: 0 };
        }
        usersByMonth[month].total++;
        if (user.referrer) {
          usersByMonth[month].referred++;
        }
      });

      // Calculate levels for each month
      const growthData = [];
      for (const [month, data] of Object.entries(usersByMonth)) {
        const level1 = data.referred;
        // For simplicity, estimate level 2 and 3 as fractions of level 1
        // In a real implementation, you'd calculate actual levels
        const level2 = Math.floor(level1 * 0.6);
        const level3 = Math.floor(level2 * 0.4);

        growthData.push({
          month,
          level1,
          level2,
          level3,
          total: data.total
        });
      }

      return growthData.sort((a, b) => a.month.localeCompare(b.month));
    } catch (error) {
      console.error('Error getting network growth data:', error);
      return [];
    }
  }

  // Update user's network level in the database
  static async updateUserNetworkLevel(userId) {
    try {
      const levels = await this.calculateNetworkLevels(userId);
      await User.findByIdAndUpdate(userId, {
        'network.level': levels.total > 0 ? Math.min(3, Math.ceil(levels.total / 10)) : 0
      });
    } catch (error) {
      console.error('Error updating user network level:', error);
    }
  }
}

module.exports = NetworkService;