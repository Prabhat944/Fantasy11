const mongoose = require('mongoose');

const playerInTeamSnapshotSchema = new mongoose.Schema({
  playerId: { // The unique identifier for the player from your system or sports data provider
    type: String, // Or mongoose.Schema.Types.ObjectId if you have an internal Player model
    required: true,
  },
  playerName: { // Storing name for easier display, but playerId is the key reference
    type: String,
  },
  pointsScored: { // Points this specific player contributed to the team's total for this contest
    type: Number,
    required: true,
    default: 0,
  },
  role: { // Fantasy role assigned by the user, if any (e.g., Captain, Vice-Captain)
    type: String,
    enum: ['CAPTAIN', 'VICE_CAPTAIN', 'PLAYER', null], // Add other roles if you have them
    default: 'PLAYER',
  },
  // You could add more player-specific details if needed, like their actual stats in the match
  // e.g., runs: Number, wickets: Number, goals: Number etc.
  // actualStats: { type: Object }
}, { _id: false }); // _id: false because this is a subdocument within an array

const userContestOutcomeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  matchId: {
    type: String,
    required: true,
    index: true,
  },
  contestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contest',
    required: true,
    index: true,
  },
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
  },
  pointsScored: {
    type: Number,
    default: 0,
  },
  rank: {
    type: Number,
  },
  resultStatus: {
    type: String,
    enum: ['WIN', 'LOSS', 'DRAW', 'PENDING_CALCULATION', 'CANCELLED'],
    default: 'PENDING_CALCULATION',
  },
  prizeWon: {
    type: Number,
    default: 0,
  },
  teamSnapshot: { // Detailed snapshot of the team and player scores for this outcome
    players: [playerInTeamSnapshotSchema], // Array of players in the team
    captainId: { type: String }, // or mongoose.Schema.Types.ObjectId
    viceCaptainId: { type: String }, // or mongoose.Schema.Types.ObjectId
    // You can add any other team-level summary info here from the time of calculation
  },
  calculatedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

userContestOutcomeSchema.index({ user: 1, contestId: 1, teamId: 1 }, { unique: true });

const UserContestOutcome = mongoose.model('UserContestOutcome', userContestOutcomeSchema);

module.exports = UserContestOutcome;