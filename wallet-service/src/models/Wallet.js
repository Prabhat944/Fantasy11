// models/Wallet.js
const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    user: { // Changed from userId to user as per your controller's req.user._id usage
        type: mongoose.Schema.Types.ObjectId, // Assuming user._id is an ObjectId
        ref: 'User', // Reference to your User model (if you have one)
        required: true,
        unique: true,
        index: true
    },
    deposit_balance: {
        type: Number,
        default: 0,
        min: 0
    },
    withdrawal_balance: { // Often referred to as winning balance
        type: Number,
        default: 0,
        min: 0
    },
    cashback_balance: {
        type: Number,
        default: 0,
        min: 0
    },
    signup_bonus_balance: { // Added this field based on your controller code
        type: Number,
        default: 0,
        min: 0
    },
    signup_bonus_expiry: {
        type: Date,
        default: () => new Date(Date.now() + 30*24*60*60*1000) // 30 days from now
      },
    isFirstDepositBonusGiven: {
        type: Boolean,
        default: false
      },      
    // totalCash is derived, not stored directly in schema
}, {
    timestamps: true // Adds createdAt and updatedAt fields automatically
});

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;
