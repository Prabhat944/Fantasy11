// In user-service: controllers/userMatchController.js
const UserMatch = require('../models/UserMatchStore');
const mongoose = require('mongoose');

exports.getUserMatchRecord = async (req, res) => {
  try {
    const { userId, matchId } = req.query;
    console.log('chek the user id and match id', userId, '----', matchId);
    // ... (input validation for userId, matchId)
    if (!userId || !matchId) { /* ... */ }
    if (!mongoose.Types.ObjectId.isValid(userId)) { /* ... */ }

    const userMatch = await UserMatch.findOne({ user: userId, matchId: matchId });

    if (!userMatch) {
      return res.status(404).json(null); // Sends null if not found, as expected by client
    }
    return res.status(200).json(userMatch); // Sends the UserMatch data
  } catch (error) {
    // ... (error handling)
  }
};

// In user-service: controllers/userMatchController.js (continued)
exports.createUserMatchRecord = async (req, res) => {
    try {
      const { user, matchId, matchInfo, status } = req.body;
    console.log('chek the user and match id', user, '----', matchId);

      // ... (input validation for user, matchId)
      if (!user || !matchId) { /* ... */ }
      if (!mongoose.Types.ObjectId.isValid(user)) { /* ... */ }
  
      const newUserMatch = new UserMatch({ user, matchId, matchInfo, status });
      const savedUserMatch = await newUserMatch.save(); // Saves the data
      return res.status(201).json(savedUserMatch); // Sends back the saved data
    } catch (error) {
      // ... (error handling, including for duplicate key if index is used)
      if (error.code === 11000) {
          return res.status(409).json({ message: 'UserMatch record already exists for this user and match.'});
      }
    }
  };