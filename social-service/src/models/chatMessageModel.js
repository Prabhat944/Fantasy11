const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const chatMessageSchema = new mongoose.Schema({
  // Make both optional, but one must exist
  chatRoomId: {
    type: Schema.Types.ObjectId,
    ref: 'ChatRoom',
    required: true,
    index: true,
},
  leagueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'League',
    required: false, // No longer required
  },
  contestId: {
    type: String, // Or ObjectId if you have a Contest model in this service
    required: false,
    index: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  messageType: {
    type: String,
    enum: ['text', 'team_share', 'predefined', 'contest_invite'], // You can add more later!
    default: 'text',
},
  content: {
    type: String,
    required: true,
    trim: true,
  },
}, { 
  timestamps: { createdAt: true, updatedAt: false },
  // Add a validator to ensure one of the two room types exists
  validate: {
    validator: function() {
      return this.leagueId || this.contestId;
    },
    message: 'A message must belong to either a league or a contest.'
  }
});

module.exports = mongoose.model('ChatMessage', chatMessageSchema);