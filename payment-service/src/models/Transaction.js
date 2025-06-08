const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // Will refer to User Service's User ID
  amount: { type: Number, required: true },
  currency: { type: String, required: true, default: 'INR' },
  orderId: { type: String, required: true, unique: true, index: true }, // Your internal order/transaction ID
  gateway: { type: String, required: true }, // e.g., 'razorpay', 'stripe'
  gatewayOrderId: { type: String }, // ID from the payment gateway
  gatewayPaymentId: { type: String },
  gatewaySignature: { type: String }, // For verifying callbacks
  status: {
    type: String,
    enum: ['pending', 'success', 'failed', 'refunded'],
    default: 'pending',
    index: true
  },
  purpose: { type: String }, // e.g., 'wallet_topup', 'contest_entry'
  metadata: { type: Object }, // Any additional info
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);