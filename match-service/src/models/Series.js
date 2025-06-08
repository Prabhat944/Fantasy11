const mongoose = require('mongoose');

const seriesSchema = new mongoose.Schema({
  seriesId: { type: String, required: true, unique: true },
  name: String,
  startDate: Date,
  endDate: String,
  matches: Number,
  status: { type: String, enum: ['upcoming', 'ongoing', 'completed'], default: 'upcoming' }
}, { timestamps: true });

module.exports = mongoose.model('Series', seriesSchema);
