// middleware/adminAuth.js
const jwt = require('jsonwebtoken');

// Get secrets from your environment variables
const JWT_SECRET = process.env.JWT_SECRET;
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN;

const adminAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  // --- ✅ NEW: Check for Internal Service Token ---
  // First, check if the token exactly matches our shared internal secret.
  if (INTERNAL_API_TOKEN && token === INTERNAL_API_TOKEN) {
    // This is a trusted internal service call (e.g., the cron job).
    // We grant access immediately and bypass the JWT verification.
    req.user = { userId: 'SYSTEM', isAdmin: true }; // Identify as system admin
    return next();
  }
  // --- END OF NEW LOGIC ---

  // If it's not the internal token, proceed with verifying it as a user's JWT.
  try {
    // 1. Verify the token is a valid JWT
    const decoded = jwt.verify(token, JWT_SECRET);

    // 2. CRITICAL CHECK: Check if the 'isAdmin' flag is true in the token's payload
    if (!decoded.isAdmin) {
      return res.status(403).json({ message: 'Forbidden: Admin access required.' });
    }

    // 3. Attach admin info to the request and proceed
    req.user = { userId: decoded.userId, isAdmin: true };
    next();

  } catch (err) {
    // Handle JWT-specific errors
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    // This will catch invalid signatures, malformed tokens, etc.
    return res.status(401).json({ message: 'Invalid user token' });
  }
};

module.exports = adminAuthMiddleware;