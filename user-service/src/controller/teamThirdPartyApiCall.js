// In user-service: controllers/userController.js
const User = require('../models/userModel'); // Assuming userModel.js from above
const mongoose = require('mongoose');

/**
 * Get a user by their ID.
 * This endpoint is called by other services (like TeamService) to validate user existence.
 * Responds to GET /api/users/:userId
 */
exports.getUserProfileById = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format.' });
    }

    const user = await User.findById(userId).select('-password'); // Find user by ID, exclude password

    if (!user) {
      // User not found, this is what checkUserExists in team-service expects for a 'false' result
      return res.status(404).json({ message: 'User not found.' });
    }

    // User found, return user data (or just a success status if that's preferred for validation)
    // The team-service's checkUserExists only cares about the 200 status, not the body,
    // but returning some data is standard.
    return res.status(200).json(user);

  } catch (error) {
    console.error('[UserService Server] Error in getUserProfileById:', error);
    if (error.name === 'CastError') { // Should be caught by isValid check, but as a fallback
        return res.status(400).json({ message: 'Invalid user ID format cast error.', error: error.message });
    }
    return res.status(500).json({ message: 'Internal server error while fetching user profile.' });
  }
};

// You would also have other user-related controller functions:
// exports.registerUser = async (req, res) => { ... };
// exports.loginUser = async (req, res) => { ... };
// etc.

// And controllers for UserMatch if those endpoints are also under /api/users or a different path
// For example, if UserMatch is handled by a separate controller:
// const UserMatch = require('../models/userMatchSchema');
// exports.createUserMatchRecord = async (req, res) => { ... } // This is NOT what team-service calls