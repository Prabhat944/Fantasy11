const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const walletTransactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true // Important for efficient querying by user
    },
    type: { // e.g., 'deposit', 'withdraw', 'deduct', 'winning', 'cashback', 'bonus', 'refund'
        type: String,
        required: true,
        enum: ['deposit', 'withdraw', 'deduct', 'winning', 'cashback', 'bonus', 'refund', 'conversion', 'tds']
    },
    amount: { // The total amount involved in this transaction (e.g., contest entry fee, withdrawal amount)
        type: Number,
        required: true,
        min: 0
    },
    reason: { // A brief description of the transaction (e.g., 'Contest Entry', 'Withdrawal', 'Deposit')
        type: String,
        trim: true
    },
    breakdown: { // Details of how the amount was deducted from/added to different wallet balances
        deposit_balance: { type: Number, default: 0 },
        cashback_balance: { type: Number, default: 0 },
        withdrawal_balance: { type: Number, default: 0 },
        signup_bonus_balance: { type: Number, default: 0 }
    },
    // Optional: Link to related entities for richer history display
    contestId: { // If type is 'deduct' (for contest join) or 'winning' (for contest winning)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contest', // Assuming you have a Contest model
        index: true
    },
    matchId: { // If type is 'deduct' or 'winning'
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Match', // Assuming you have a Match model
        index: true
    },
    // For refunds, to link back to the original transaction
    refundedTransactionId: {
        type: String, // String because it's an ID from *another* transaction
        unique: true, // A refunded transaction ID should only appear once as a refunded marker
        sparse: true // Allows nulls, ensuring uniqueness only applies to non-null values
    },
    // Optional: Status for withdrawals (e.g., 'Pending', 'Processing', 'Completed', 'Failed')
    withdrawalStatus: {
        type: String,
        enum: ['Pending', 'Processing', 'Completed', 'Failed'],
        default: null // Only set for 'withdraw' type transactions
    }
}, { timestamps: true }); // `createdAt` will be the transaction date

walletTransactionSchema.plugin(mongoosePaginate); // Add this line

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);