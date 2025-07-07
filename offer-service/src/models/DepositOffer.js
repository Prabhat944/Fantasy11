const mongoose = require('mongoose');

// This sub-schema defines the structure for different bonus tiers
const tierSchema = new mongoose.Schema({
    minDeposit: { type: Number, required: true },    // e.g., 5000
    bonusPercentage: { type: Number, required: true } // e.g., 3 for 3%
}, { _id: false });

const depositOfferSchema = new mongoose.Schema({
    offerName: { type: String, required: true, unique: true }, // e.g., "Monsoon Mania Deposit Offer"
    // ---- NEW FIELD ADDED ----
    type: {
        type: Number,
        required: true
    },
    description: { type: String, required: true },
    isActive: { type: Boolean, default: true, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    tiers: [tierSchema], // An array to hold different tiers
    maxBonusAmount: { type: Number } // A cap on the max bonus a user can get, e.g., 1000
}, { timestamps: true });

module.exports = mongoose.model('DepositOffer', depositOfferSchema);