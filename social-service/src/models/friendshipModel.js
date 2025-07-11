// models/friendshipModel.js (in your new Social Service)
const mongoose = require('mongoose');

const friendshipSchema = new mongoose.Schema({
  // The user who sent the friend request
  requester: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  // The user who will receive the request
  recipient: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  // The status of the friendship
  status: {
    type: String,
    enum: [
      'pending',  // Request sent, waiting for recipient to respond
      'accepted', // Request accepted, they are now friends
      'declined', // Request was declined by the recipient
      'blocked'   // One user has blocked the other
    ],
    default: 'pending',
  }
}, { timestamps: true });

// A compound index to ensure a unique relationship between two users
friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });

module.exports = mongoose.model('Friendship', friendshipSchema);