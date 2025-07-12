const mongoose = require('mongoose');

const offerProgressSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    matchId: { type: String, required: true, index: true },
    // 👇 --- ADD THIS NEW FIELD ---
    joinedContests: [{ type: String }], // An array to store the IDs of joined contests
    contestsJoinedCount: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['IN_PROGRESS', 'COMPLETED', 'PROCESSED'],
        default: 'IN_PROGRESS'
    }
}, { timestamps: true });

// A user can only have one progress tracker per match
offerProgressSchema.index({ userId: 1, matchId: 1 }, { unique: true });

module.exports = mongoose.model('OfferProgress', offerProgressSchema);