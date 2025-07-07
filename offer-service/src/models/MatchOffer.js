// offer-service/models/MatchOffer.js

const mongoose = require('mongoose');

const matchOfferSchema = new mongoose.Schema({
    matchId: {
        type: String,
        required: true,
        unique: true
    },
    matchName: {
        type: String,
        required: true
    },
    offerName: { type: String, required: true, unique: true },
    requiredContests: {
        type: Number,
        required: true
    },
    conversionPercentage: {
        type: Number,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isProcessed: {
        type: Boolean,
        default: false
    },
    // ---- NEW FIELD ADDED ----
    type: {
        type: Number,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('MatchOffer', matchOfferSchema);