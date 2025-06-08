const mongoose = require('mongoose');

const contestParticipationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  matchId: {
    type: String,
    required: true
  },
  contestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contest',
    required: true
  },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  totalPoints: {
    type: Number,
    default: 0
  },
  rank: {
    type: Number,
    default: null
  },
  isWinner: {
    type: Boolean,
    default: false
  },
  prizeWon: {
    type: Number,
    default: 0,
  }
});

contestParticipationSchema.index({ user: 1, matchId: 1, contestId: 1 }, { unique: true });

module.exports = mongoose.model('ContestParticipation', contestParticipationSchema);
