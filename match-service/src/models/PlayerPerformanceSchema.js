const mongoose = require('mongoose');

const playerPerformanceSchema = new mongoose.Schema({
  playerId: { type: String, required: true },
  matchId: { type: String, required: true },
  format: { type: String, enum: ['Test', 'ODI', 'T20', 'T10'], required: true },
  name: { type: String },
  
  // NEW FIELD to track match state
  matchStatus: { type: String, enum: ['LIVE', 'COMPLETED'], default: 'LIVE' },

  batting: {
    runs: { type: Number, default: 0 },
    ballsFaced: { type: Number, default: 0 },
    fours: { type: Number, default: 0 },
    sixes: { type: Number, default: 0 },
    isDuck: { type: Boolean, default: false },
    strikeRate: { type: String, default: "0.00"}
  },

  bowling: {
    wickets: { type: Number, default: 0 },
    overs: { type: Number, default: 0 },
    runsConceded: { type: Number, default: 0 },
    maidenOvers: { type: Number, default: 0 },
    economy: { type: String, default: "0.00" },
    lbwCount: { type: Number, default: 0 },
    bowledCount: { type: Number, default: 0 },
    caughtAndBowledCount: { type: Number, default: 0 }
  },

  fielding: {
    catches: { type: Number, default: 0 },
    stumpings: { type: Number, default: 0 },
    runOutsThrower: { type: Number, default: 0 },
    runOutsCatcher: { type: Number, default: 0 },
    runOutsDirectHit: { type: Number, default: 0 }
  },

  points: { type: Number, default: 0 },
}, { timestamps: true });

// Add a compound index for efficient lookups
playerPerformanceSchema.index({ matchId: 1, playerId: 1 }, { unique: true });
playerPerformanceSchema.index({ matchId: 1, matchStatus: 1 }); // Index for checking status

module.exports = mongoose.model('PlayerPerformance', playerPerformanceSchema);