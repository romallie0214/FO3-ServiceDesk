const jwt = require('jsonwebtoken');
const db = require('../db');
const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error('JWT_SECRET must be configured.');
const IDLE_TIMEOUT_MINUTES = Math.max(Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES || 15), 1);

function authenticate(allowEnrollment = false) {
  return async (req, res, next) => {
    const match = /^Bearer ([^ ]+)$/i.exec(String(req.headers.authorization || ''));
    if (!match) return res.status(401).json({ error: 'Access denied. No token provided.' });
    let decoded;
    try { decoded = jwt.verify(match[1], SECRET, { algorithms: ['HS256'] }); }
    catch { return res.status(401).json({ error: 'Invalid or expired authentication token. Please sign in again.' }); }
    if (!decoded || typeof decoded !== 'object' || typeof decoded.empno !== 'string' || !decoded.empno) return res.status(401).json({ error: 'Invalid authentication token.' });
    const enrollment = allowEnrollment && decoded.purpose === 'mfa_enrollment' && !decoded.sid;
    if (!enrollment && (decoded.purpose || typeof decoded.sid !== 'string' || !decoded.sid)) return res.status(401).json({ error: 'Complete sign-in before accessing this resource.' });
    try {
      const [users] = await db.query('SELECT id, empno, full_name, role, deleted_at FROM users WHERE empno = ? LIMIT 1', [decoded.empno]);
      if (users[0]?.deleted_at) return res.status(401).json({ error: 'This account has been deactivated.' });
      if (enrollment) {
        const [tracking] = await db.query('SELECT mfa_enabled FROM user_tracking WHERE empno = ? LIMIT 1', [decoded.empno]);
        if (!tracking.length || tracking[0].mfa_enabled) return res.status(401).json({ error: 'MFA enrollment is no longer available. Please sign in again.' });
        req.user = { empno: decoded.empno, purpose: 'mfa_enrollment' };
        return next();
      }
      const [sessions] = await db.query('SELECT session_last_activity FROM user_tracking WHERE empno = ? AND session_token = ? AND session_active = TRUE', [decoded.empno, decoded.sid]);
      const lastActivity = sessions[0]?.session_last_activity ? new Date(sessions[0].session_last_activity).getTime() : 0;
      if (!Number.isFinite(lastActivity) || !lastActivity || Date.now() - lastActivity >= IDLE_TIMEOUT_MINUTES * 60000) {
        if (sessions.length) await db.query('UPDATE user_tracking SET session_active = FALSE, session_token = NULL, session_last_activity = NULL WHERE empno = ? AND session_token = ?', [decoded.empno, decoded.sid]);
        return res.status(401).json({ error: 'Your login session has expired. Please sign in again.' });
      }
      await db.query('UPDATE user_tracking SET session_last_activity = NOW() WHERE empno = ? AND session_token = ? AND session_active = TRUE', [decoded.empno, decoded.sid]);
      // HR requestors need not have a locally managed account. Never retain privileged stale claims.
      req.user = { ...decoded, id: users[0]?.id || null, role: users[0]?.role || 'dswd_staff', full_name: users[0]?.full_name || decoded.full_name };
      next();
    } catch (err) { console.error('Authentication lookup failed:', err.message); res.status(503).json({ error: 'Unable to validate your session. Please try again.' }); }
  };
}
const auth = authenticate();
auth.forMfaSetup = authenticate(true);
module.exports = auth;
