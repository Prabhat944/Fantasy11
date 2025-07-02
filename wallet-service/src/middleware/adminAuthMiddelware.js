// middleware/adminAuthMiddleware.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET; // Ensure this is available

const adminAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token required.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if the token signifies an admin or an internal system
    if (decoded.isAdmin === true || decoded.isSystemInternal === true) {
      req.user = {
        _id: decoded.userId || 'system_internal', // Use userId if available, else a placeholder
        email: decoded.email || 'system@internal.com',
        isAdmin: decoded.isAdmin === true,
        isSystemInternal: decoded.isSystemInternal === true
      };
      return next();
    } else {
      // Token is valid but user is not an admin/system internal
      return res.status(403).json({ message: 'Access denied: Admin privileges required.' });
    }
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

module.exports = adminAuthMiddleware;