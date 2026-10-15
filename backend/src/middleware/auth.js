const jwt = require('jsonwebtoken');
const db = require('../db');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error('JWT_SECRET must be configured.');
const IDLE_TIMEOUT_MINUTES = Math.max(Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES || 15), 1);

module.exports = async function authMiddleware(req, res, next) {
  // Get token from request header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    // Verify the token is valid and not expired
    const decoded = jwt.verify(token, SECRET);
    const [managedUsers] = await db.query(
      'SELECT deleted_at FROM users WHERE empno = ? LIMIT 1',
      [decoded.empno]
    );
    if (managedUsers[0]?.deleted_at) {
      return res.status(401).json({ error: 'This account has been deactivated. Please contact an administrator.' });
    }
    if (decoded.sid) {
      const [sessions] = await db.query(
        'SELECT session_last_activity FROM user_tracking WHERE empno = ? AND session_token = ? AND session_active = TRUE',
        [decoded.empno, decoded.sid]
      );
      if (!sessions.length) return res.status(401).json({ error: 'This login session is no longer active.' });
      const lastActivity = sessions[0].session_last_activity ? new Date(sessions[0].session_last_activity).getTime() : 0;
      if (!lastActivity || Date.now() - lastActivity >= IDLE_TIMEOUT_MINUTES * 60 * 1000) {
        await db.query(
          'UPDATE user_tracking SET session_active = FALSE, session_token = NULL, session_last_activity = NULL WHERE empno = ? AND session_token = ?',
          [decoded.empno, decoded.sid]
        );
        return res.status(401).json({ error: 'Your session ended after ' + IDLE_TIMEOUT_MINUTES + ' minutes of inactivity. Please sign in again.' });
      }
      await db.query(
        'UPDATE user_tracking SET session_last_activity = NOW() WHERE empno = ? AND session_token = ?',
        [decoded.empno, decoded.sid]
      );
    }
    req.user = decoded; // Attach user info to the request
    next(); // Continue to the route handler
  } catch (err) {
    res.status(401).json({
      error: err?.name === 'TokenExpiredError'
        ? 'Your login session has expired. Please sign in again.'
        : 'Invalid authentication token. Please sign in again.',
    });
  }
};
