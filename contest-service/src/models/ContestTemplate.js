// models/ContestTemplate.js
const mongoose = require('mongoose');

const contestTemplateSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true }, // e.g., "Head-to-Head Clash", "Daily 100 Winner"
  type: { type: String, enum: ['GRAND', 'MEDIUM', 'SMALL', 'H2H'], required: true }, // Added H2H for clarity
  entryFee: { type: Number, required: true, min: 0 },
  totalSpots: { type: Number, required: true, min: 2 },
  prize: { type: Number, required: true, min: 0 }, // Total prize pool
  matchType: { type: String, enum: ['ALL', 'T20', 'ODI', 'TEST'], default: 'ALL' },
  
  prizeBreakupType: {
    type: String,
    enum: ['winnerTakesAll', 'percentageSplit', 'fixedAmountSplit'], // More descriptive enums
    required: true,
    default: 'winnerTakesAll',
  },
  // Example: For 'percentageSplit': [{ rank: 1, percentage: 70 }, { rank: 2, percentage: 30 }]
  // Example: For 'fixedAmountSplit': [{ rank: 1, amount: 500 }, { rank: 2, amount: 200 }]
  // For 'winnerTakesAll', this can be empty or not used.
  prizeDistribution: { 
    type: mongoose.Schema.Types.Mixed, // Flexible for different structures
    default: [],
   },
  // customPrizeBreakup could be an alternative or specific implementation of prizeDistribution
  // For simplicity, I'm using prizeDistribution as a more generic term.
  // You can adapt 'customPrizeBreakup' from your original Contest schema here if preferred.

  isActive: { type: Boolean, default: true }, // To easily enable/disable templates
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

contestTemplateSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('ContestTemplate', contestTemplateSchema);