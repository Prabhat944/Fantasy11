const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  matchId: {
    type: String,
    required: true
  },
  players: {
    type: [String],
    validate: [arr => arr.length > 0, 'Team must have at least one player']
  },
  captain: {
    type: String,
    required: true
  },
  viceCaptain: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Team', teamSchema);
