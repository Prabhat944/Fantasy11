const mongoose = require('mongoose');

const contestSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true }, // e.g., "Head-to-Head Clash #1"
  matchId: { type: String, required: true, index: true }, // Assuming it's an external Match ID as string
  // If Match is another collection:
  // matchObjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true, index: true },
  
  contestTemplateId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'ContestTemplate', 
    required: true,
    index: true,
  },
  baseContestId: { // For linking clones to the very first instance
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Contest', 
    default: null, // Null if this is the first instance
    index: true,
  },
  entryFee: { type: Number, required: true, min: 0 },
  totalSpots: { type: Number, required: true, min: 2 },
  filledSpots: { type: Number, default: 0, min: 0 },
  prize: { type: Number, required: true, min: 0 }, // Total prize pool for this contest instance

  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  prizeBreakupType: {
    type: String,
    enum: ['winnerTakesAll', 'percentageSplit', 'fixedAmountSplit'],
    required: true,
  },
  prizeDistribution: {
    type: mongoose.Schema.Types.Mixed,
    default: [],
  },
  
  status: { 
    type: String, 
    enum: ['upcoming', 'live', 'processing', 'completed', 'cancelled'], 
    default: 'upcoming',
    index: true,
  },
  // winnerAnnounced: { type: Boolean, default: false },
  // winners: [{ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User'}, rank: Number, prizeAmount: Number }],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

contestSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  // Basic validation for filledSpots
  if (this.filledSpots < 0) this.filledSpots = 0;
  if (this.filledSpots > this.totalSpots) this.filledSpots = this.totalSpots;
  next();
});

contestSchema.index({ matchId: 1, contestTemplateId: 1 });
contestSchema.index({ status: 1, filledSpots: 1, totalSpots: 1 });


module.exports = mongoose.model('Contest', contestSchema);