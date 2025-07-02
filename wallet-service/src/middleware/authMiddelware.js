// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // ✅ Support internal system tokens
    if (decoded.isSystemInternal) {
      req.user = {
        isSystemInternal: true
        // Optionally include `serviceName: decoded.service` if added during token generation
      };
      return next();
    }

    // ✅ For normal user-based tokens
    if (!decoded.userId) {
      return res.status(401).json({ message: 'Invalid token payload: missing userId' });
    }

    req.user = {
      _id: decoded.userId,
      email: decoded.email || null
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = authMiddleware;
