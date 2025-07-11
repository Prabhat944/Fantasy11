// models/leagueInviteModel.js
const mongoose = require('mongoose');

const leagueInviteSchema = new mongoose.Schema({
  leagueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'League',
    required: true,
  },
  inviter: { // The user who sent the invite
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  invitee: { // The user who received the invite
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending',
  },
}, { timestamps: true });

// Ensure a user can only be invited to the same league once while the invite is pending
leagueInviteSchema.index({ leagueId: 1, invitee: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });

module.exports = mongoose.model('LeagueInvite', leagueInviteSchema);