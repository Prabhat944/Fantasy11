// models/leagueModel.js
const mongoose = require('mongoose');

const leagueSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to the User who created the league
    required: true,
    index: true,
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // An array of User IDs who are in the league
  }],
  maxMembers: {
    type: Number,
    default: 50, // Set a default max size for a league
  },
  // A unique, shareable code for the league
  inviteCode: {
    type: String,
    unique: true,
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active',
  },
  // Optional: Image for the league
  leagueImage: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('League', leagueSchema);