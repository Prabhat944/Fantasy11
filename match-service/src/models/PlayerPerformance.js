// In your PlayerPerformanceSchema.js file

const mongoose = require('mongoose');

const playerPerformanceSchema = new mongoose.Schema({
  playerId: { type: String, required: true },
  matchId: { type: String, required: true },
  format: { type: String, enum: ['Test', 'ODI', 'T20', 'T10'], required: true },
  name: { type: String }, // You were saving this, so good to define it

  batting: {
    runs: { type: Number, default: 0 },
    ballsFaced: { type: Number, default: 0 },
    fours: { type: Number, default: 0 },
    sixes: { type: Number, default: 0 },
    isDuck: { type: Boolean, default: false },
    strikeRate: { type: String, default: "0.00"} // Added default based on parseMatchData
  },

  bowling: {
    wickets: { type: Number, default: 0 },
    overs: { type: Number, default: 0 }, // Consider storing as string if it's like "3.2" or total balls as number
    runsConceded: { type: Number, default: 0 },
    maidenOvers: { type: Number, default: 0 },
    economy: { type: String, default: "0.00" }, // Added default based on parseMatchData
    
    // NEW fields for bowling bonuses
    lbwCount: { type: Number, default: 0 },
    bowledCount: { type: Number, default: 0 },
    caughtAndBowledCount: { type: Number, default: 0 }
  },

  fielding: {
    catches: { type: Number, default: 0 },
    stumpings: { type: Number, default: 0 },
    // OLD generic runOuts - decide if you still need it.
    // runOuts: { type: Number, default: 0 }, // If replaced by detailed, you can remove or keep for other purposes

    // NEW detailed run-out fields
    runOutsThrower: { type: Number, default: 0 },
    runOutsCatcher: { type: Number, default: 0 },
    runOutsDirectHit: { type: Number, default: 0 }
  },

  points: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('PlayerPerformance', playerPerformanceSchema);