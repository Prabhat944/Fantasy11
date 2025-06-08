// models/Match.js (Example structure - adapt to your needs)
const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  // _id will be the matchId if it's an ObjectId
  externalMatchId: { type: String, unique: true, sparse: true }, // If you use external IDs
  seriesId: String,
  seriesName: String,
  teamA: String,
  teamB: String,
  teamAShort: String, // e.g., IND
  teamBShort: String, // e.g., AUS
  dateTimeGMT: { type: Date, required: true, index: true },
  matchType: { type: String, enum: ['T20', 'ODI', 'TEST', 'OTHER'], required: true }, // Crucial for template filtering
  status: { type: String, enum: ['Upcoming', 'Live', 'Completed', 'Cancelled'], default: 'Upcoming'}, // Match status
  // any other fields like venue, squad info etc.
});

module.exports = mongoose.model('Match', matchSchema);