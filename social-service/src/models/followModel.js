// models/followModel.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const followSchema = new Schema({
    // The user who is initiating the follow
    follower: {
        type: Schema.Types.ObjectId,
        ref: 'User', // Refers to your User model
        required: true
    },
    // The user who is being followed
    following: {
        type: Schema.Types.ObjectId,
        ref: 'User', // Refers to your User model
        required: true
    }
}, {
    timestamps: true // Adds createdAt and updatedAt timestamps
});

// To ensure a user cannot follow the same person more than once,
// we create a unique compound index.
followSchema.index({ follower: 1, following: 1 }, { unique: true });

const Follow = mongoose.model('Follow', followSchema);

module.exports = Follow;