const User = require('../models/userModel'); // Adjust path as needed
const UserContestOutcome = require('../models/UserContestOutcome'); // Adjust path as needed
// const ContestParticipation = require('../models/contestParticipationModel'); // If still needed for just "played" count before outcomes are processed

// Helper function to calculate stats for a given userId
const calculateUserStats = async (userId) => {
  const totalContestsParticipated = await UserContestOutcome.countDocuments({
    user: userId,
    resultStatus: { $in: ['WIN', 'LOSS', 'DRAW'] } // Only count completed & processed contests
  });
  const totalWins = await UserContestOutcome.countDocuments({ user: userId, resultStatus: 'WIN' });
  const totalLosses = await UserContestOutcome.countDocuments({ user: userId, resultStatus: 'LOSS' });
  // const totalDraws = await UserContestOutcome.countDocuments({ user: userId, resultStatus: 'DRAW' }); // Optional

  let winningPercentage = 0;
  if (totalContestsParticipated > 0) {
    winningPercentage = parseFloat(((totalWins / totalContestsParticipated) * 100).toFixed(2));
  }

  return {
    totalContestsParticipated,
    totalWins,
    totalLosses,
    // totalDraws, // Optional
    winningPercentage,
  };
};

exports.getDetailedUserProfile = async (req, res) => {
  try {
    const userId = req.user._id; // Assuming req.user is populated by auth middleware
console.log('Fetching detailed profile for user:', userId);
    const currentUser = await User.findById(userId).select('-password'); // Exclude password
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get stats for the current user
    const currentUserStats = await calculateUserStats(userId);

    // Find users referred by the current user
    const referredUsers = await User.find({ referredBy: currentUser.referCode }).select('-password');

    const referredUsersWithStats = [];
    for (const referredUser of referredUsers) {
      const stats = await calculateUserStats(referredUser._id);
      referredUsersWithStats.push({
        _id: referredUser._id,
        name: referredUser.name,
        email: referredUser.email, // Or other identifying info
        mobile: referredUser.mobile,
        signupMode: referredUser.signupMode,
        stats: stats,
      });
    }

    res.json({
      user: {
        _id: currentUser._id,
        name: currentUser.name,
        email: currentUser.email,
        mobile: currentUser.mobile,
        referCode: currentUser.referCode,
        referralCount: currentUser.referralCount, // This is the count from your userModel
        // Add any other fields from userModel you want to return
      },
      stats: currentUserStats,
      referredUsers: referredUsersWithStats,
    });

  } catch (error) {
    console.error('Error in getDetailedUserProfile:', error);
    res.status(500).json({ message: 'Failed to fetch detailed user profile', error: error.message });
  }
};