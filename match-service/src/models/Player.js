const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  playerId: { type: String, required: true },
  name: String,
  image: String,
  teamName: String,
  role: String,
  seriesId: { type: String, required: true },
  totalPoints: { type: Number, default: 0 }
}, { timestamps: true });

playerSchema.index({ playerId: 1, seriesId: 1 }, { unique: true });

module.exports = mongoose.model('Player', playerSchema);
