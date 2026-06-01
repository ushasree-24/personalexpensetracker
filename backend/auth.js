const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'developer-secret-aura-finance-key-12345';

// Signs session JWT tokens valid for 30 days
function generateToken(user) {
  return jwt.sign(
    { 
      userId: user.id || user._id, 
      username: user.username, 
      email: user.email 
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// Authentication middleware to secure private/user-scoped endpoints
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: "Access denied. No authorization header provided." });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: "Access denied. Invalid authorization format. Use 'Bearer <token>'." });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Access denied. Invalid or expired token." });
  }
}

module.exports = {
  generateToken,
  authMiddleware
};
