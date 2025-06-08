// In team-service: controllers/teamController.js

const Team = require('../models/TeamSchema'); // Adjust path as needed
const mongoose = require('mongoose');
const { checkUserExists } = require('../utils/UserThirdPartyApiCall'); // 🟢 Import the validator

exports.getTeamByIdAndUserMatch = async (req, res) => {
  try {
    const { teamId } = req.params; // Get teamId from URL path
    const { userId, matchId } = req.query; // Get userId and matchId from query parameters
console.log('check tema detal here', teamId,'----', userId, '=====', matchId )
    // --- Basic Input Validation ---
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ message: 'Invalid team ID format.' });
    }
    // Assuming userId is also expected to be an ObjectId. Adjust if it's a different format.
    if (!userId || (mongoose.Types.ObjectId.isValid(userId) && !mongoose.Types.ObjectId.isValid(userId))) { // A bit redundant, simplify
      return res.status(400).json({ message: 'User ID is required and must be a valid format.' });
    }
    if (!matchId) {
      return res.status(400).json({ message: 'Match ID is required as a query parameter.' });
    }

    // --- 🟢 Call User Service to Validate User ID 🟢 ---
    const userIsValid = await checkUserExists(userId);
    if (!userIsValid) {
      // If checkUserExists throws an error (e.g. user-service down), the catch block below will handle it.
      // If it returns false, it means the user-service confirmed the user does not exist.
      return res.status(404).json({ message: `User with ID '${userId}' not found in User Service.` });
    }
    // --- End User Validation ---

    // Now that the user is confirmed to exist in User Service, find the team
    const team = await Team.findOne({
      _id: teamId,
      user: userId,     // Ensure the team belongs to the specified (and now validated) user
      matchId: matchId  // Ensure the team is for the specified match
    });
console.log('chcek the team here', team);
    if (!team) {
      // User is valid, but no team matches all criteria for this user.
      return res.status(404).json({ message: 'Team not found for the specified user and match.' });
    }

    // If team is found and validated, send it back
    return res.status(200).json(team);

  } catch (error) {
    console.error('[TeamService Server] Error in getTeamByIdAndUserMatch:', error);
    if (error.name === 'CastError') { // Catches invalid ObjectId formats for teamId or potentially userId if not handled above
        return res.status(400).json({ message: 'Invalid ID format provided.', error: error.message });
    }
    // Handle the error thrown by checkUserExists if User Service communication fails critically
    if (error.message && error.message.includes('Failed to validate user')) {
        // This message comes from the checkUserExists helper if the user-service itself is down or has an issue
        return res.status(503).json({ message: 'User service unavailable or encountered an error. Cannot validate user.' , detailedError: error.message });
    }
    return res.status(500).json({ message: 'Internal server error while fetching team.', error: error.message });
  }
};