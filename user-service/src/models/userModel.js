const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: function () {
      return this.signupMode === 'email';
    },
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    required: function () {
      return this.signupMode === 'email';
    },
  },
  password: {
    type: String,
    required: function () {
      return this.signupMode === 'email';
    },
  },
  mobile: {
    type: String,
    required: function () {
      return this.signupMode === 'otp';
    },
  },
  referCode: {
    type: String,
  },
  referredBy: {
    type: String,
  },
  referralCount: {
    type: Number,
    default: 0,
  },
  referralCounted: {
    type: Boolean,
    default: false,  // ✅ ensures we only count once per user
  },
  signupMode: {
    type: String,
    enum: ['email', 'otp'],
    required: true,
  },
});

module.exports = mongoose.model('User', userSchema);
