// models/chatRoomModel.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const chatRoomSchema = new Schema({
    // For direct messages, this will always be 'directMessage'
    // For contests/leagues, this would be 'group'
    type: {
        type: String,
        enum: ['directMessage', 'group'],
        required: true,
    },
    
    // An array of all users in the chat room.
    // For DMs, it will contain exactly two user IDs.
    participants: [{
        type: Schema.Types.ObjectId,
        ref: 'User', // Refers to your User model
        required: true,
    }],

    // For group chats, you might link to the original league or contest
    groupSourceId: {
        type: String, // Can hold a leagueId or contestId
        default: null,
    },

}, { timestamps: true });

const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);

module.exports = ChatRoom;