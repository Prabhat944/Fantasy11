// user-service/src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const {
  signup,
  login,
  requestPasswordReset,
  resetPassword,
  sendOtp,
  verifyOtp,
  googleLogin,
  facebookLogin
} = require('../controller/authController'); // Adjusted path
console.log("[User Service] Auth Routes Loaded");
// router.post('/signup', signup); // Path is now relative to the /auth mount point
// ... other auth routes
// Example:
router.post('/signup', signup);
router.post('/login', login);
router.post('/request-reset', requestPasswordReset);
router.post('/reset-password/:token', resetPassword);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/google-login', googleLogin);
router.post('/facebook-login', facebookLogin);

module.exports = router;