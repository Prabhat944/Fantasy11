const mongoose = require('mongoose');

const userMatchSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  matchId: String,
  matchInfo: Object, // store basic match info like teams, time, etc.
  status: { type: String, enum: ['upcoming', 'live', 'completed'], default: 'upcoming' },
  joinedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserMatch', userMatchSchema);
