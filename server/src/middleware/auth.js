const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'code1vs1-secret';

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function generateRefreshToken(user) {
  const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'code1vs1-refresh';
  return jwt.sign(
    { id: user.id },
    REFRESH_SECRET,
    { expiresIn: '30d' }
  );
}

module.exports = { authMiddleware, generateToken, generateRefreshToken };
