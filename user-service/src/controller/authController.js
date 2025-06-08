const User = require('../models/userModel');
const OTP = require('../models/otpModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const sendEmail = require('../utils/sendEmail');
const generateReferCode = require('../utils/referCode');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const { sendOTPViaSMS } = require('../utils/sendSms'); // adjust path if needed
const axios = require('axios');


const JWT_SECRET = process.env.JWT_SECRET;
// Signup
exports.signup = async (req, res) => {
  const { name, email, mobile, password, referCode } = req.body;
  try {
    const existingUser = await User.findOne({ $or: [{ email }, { mobile }] });
    console.log('Existing User:', existingUser);
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      mobile,
      password: hashedPassword,
      referCode: generateReferCode(name),
      signupMode: 'email',
      referralCounted: false,
    });

    if (referCode) {
      const referrer = await User.findOne({ referCode });
      if (referrer) {
        newUser.referredBy = referCode;
        referrer.referralCount += 1;
        newUser.referralCounted = true;
        await referrer.save();
      }
    }

    await newUser.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


// Login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({
      $or: [{ email }]
    });
    if (!user) return res.status(400).json({ message: 'User not found' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Request Password Reset
exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '15m' });
    const resetLink = `http://localhost:5000/api/auth/reset-password/${token}`;
    await sendEmail(email, 'Reset Your Password', `Click here: ${resetLink}`);
    res.json({ message: 'Password reset email sent' });
  } catch (err) {
    res.status(500).json({ message: 'Error sending email' });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const hashed = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(decoded.userId, { password: hashed });
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(400).json({ message: 'Invalid or expired token' });
  }
};

//Send OTP
exports.sendOtp = async (req, res) => {
  const { mobile, referCode } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    // Save OTP to DB
    await OTP.findOneAndUpdate(
      { mobile },
      { otp, createdAt: new Date() },
      { upsert: true, new: true }
    );

    // Send OTP via SMS
    await sendOTPViaSMS(mobile, otp);

    // Create user if not exists
    let user = await User.findOne({ mobile });
    if (!user) {
      user = new User({
        mobile,
        referCode: generateReferCode(),
        signupMode: 'otp'
      });

      if (referCode) {
        const referrer = await User.findOne({ referCode });
        if (referrer) {
          user.referredBy = referCode;
          referrer.referralCount += 1;
          await referrer.save();
          user.referralCounted = true;
        }
      }

      await user.save();
    }

    res.json({ message: 'OTP sent successfully' });

  } catch (err) {
    console.error('❌ sendOtp Error:', err);
    res.status(500).json({ message: err.message || 'Failed to send OTP' });
  }
};


  // Verify OTP 
exports.verifyOtp = async (req, res) => {
    const { mobile, otp } = req.body;
    try {
      const record = await OTP.findOne({ mobile, otp });
  
      if (!record) {
        return res.status(400).json({ message: 'Invalid or expired OTP' });
      }
  
      const user = await User.findOne({ mobile });
  
      if (!user) {
        return res.status(404).json({ message: 'User not found. Please resend OTP.' });
      }
  
      const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1d' });
      res.json({ token });
  
    } catch (err) {
      res.status(500).json({ message: 'OTP verification failed' });
    }
};
  
  // Google Login
exports.googleLogin = async (req, res) => {
    const { idToken } = req.body;
  
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
  
      const { email, name } = ticket.getPayload();
  
      let user = await User.findOne({ email });
      if (!user) user = await User.create({ email, name });
  
      const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1d' });
      res.json({ token });
    } catch (err) {
      res.status(401).json({ message: 'Google login failed' });
    }
  };

  // Facebook Login
exports.facebookLogin = async (req, res) => {
    const { accessToken, userID } = req.body;
  
    if (!accessToken || !userID) {
      return res.status(400).json({ message: 'Access Token and UserID are required' });
    }
  
    try {
      // Verify access token and get user info
      const fbURL = `https://graph.facebook.com/v12.0/${userID}?fields=id,name,email&access_token=${accessToken}`;
      const { data } = await axios.get(fbURL);
  
      if (!data || !data.email) {
        return res.status(400).json({ message: 'Unable to retrieve Facebook user data' });
      }
  
      let user = await User.findOne({ email: data.email });
  
      if (!user) {
        // Create new user
        user = await User.create({
          name: data.name,
          email: data.email,
          password: null, // No password needed
          mobile: null,
        });
      }
  
      const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1d' });
      res.json({ token });
    } catch (err) {
      console.error('Facebook login error:', err.message);
      res.status(500).json({ message: 'Facebook login failed' });
    }
  };

exports.getCurrentUser = async (req, res) => {
    try {
      res.json(req.user);
    } catch (err) {
      res.status(500).json({ message: 'Failed to get user profile' });
    }
  };
  
// user-service/src/controller/authController.js or userController.js
exports.updateUser = async (req, res) => {
    console.log('[updateUser] Request body:', req.body);
    console.log('[updateUser] req.user received from middleware:', req.user);

    if (!req.user || !req.user._id) {
        console.error('[updateUser] ERROR: req.user or req.user._id is missing');
        return res.status(401).json({ message: 'Unauthorized: User not attached from token' });
    }

    const { name, email, mobile } = req.body;

    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            console.error('[updateUser] ERROR: User not found in DB for ID:', req.user._id);
            return res.status(404).json({ message: 'User not found' });
        }

        console.log('[updateUser] Found user:', user.email, 'Updating fields...');

        if (name) user.name = name;
        if (email) user.email = email;
        if (mobile) user.mobile = mobile;

        await user.save();
        console.log('[updateUser] User updated successfully');

        res.json({ message: 'User updated successfully', user });
    } catch (err) {
        console.error('[updateUser] ERROR during update:', err.message);
        res.status(500).json({ message: 'Failed to update user info' });
    }
};

  