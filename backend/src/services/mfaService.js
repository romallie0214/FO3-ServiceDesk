const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const db = require('../db');

// ─── RECAPTCHA VERIFICATION ───

async function verifyRecaptchaV3(token, minScore = 0.5, expectedAction = 'login') {
  try {
    const axios = require('axios');
    const SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;

    if (!SECRET_KEY) {
      throw new Error('RECAPTCHA_SECRET_KEY not set in .env');
    }

    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: SECRET_KEY,
          response: token,
        },
      }
    );

  const {
    success,
    score,
    action,
    hostname,
    'error-codes': errorCodes = [],
  } = response.data;

  console.log('[reCAPTCHA] Verification:', {
    success,
    score,
    action,
    hostname,
    errorCodes,
  });

    if (!success || action !== expectedAction || score < minScore) {
      return { success: false, score: 0, action };
    }

    return { success: true, score, action };
  } catch (err) {
    console.error('[reCAPTCHA] Verification error:', err.message);
    return { success: false, score: 0, action: null };
  }
}

async function writeAuditEvent({ empno, eventType, reason = null, ipAddress = null, userAgent = null, sessionToken = null, context = null }) {
  await db.query(
    `INSERT INTO auth_audit_log (empno, event_type, reason, ip_address, user_agent, session_token, context)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [empno, eventType, reason, ipAddress, userAgent, sessionToken, context ? JSON.stringify(context) : null]
  );
}

// ─── ACCOUNT LOCKOUT & SECURITY ───

/**
 * Check if account is locked
 */
async function checkAccountLockout(empno) {
  try {
    const [rows] = await db.query(
      `SELECT locked, locked_until, lock_reason, failed_attempts 
       FROM user_tracking 
       WHERE empno = ?`,
      [empno]
    );

    if (!rows.length) return { isLocked: false, lockReason: null, timeRemaining: null };

    const security = rows[0];

    if (!security.locked) {
      return { isLocked: false, lockReason: null, timeRemaining: null };
    }

    // Check if lockout expired
    if (security.locked_until && security.locked_until <= new Date()) {
      // Auto-unlock
      await db.query(
        `UPDATE user_tracking 
         SET locked = FALSE, locked_until = NULL, lock_reason = NULL, failed_attempts = 0
         WHERE empno = ?`,
        [empno]
      );
      console.log(`[SECURITY] Account ${empno} auto-unlocked`);
      return { isLocked: false, lockReason: null, timeRemaining: null };
    }

    // Still locked
    const timeRemaining = security.locked_until
      ? Math.max(0, Math.ceil((security.locked_until - new Date()) / 1000))
      : null;
    return {
      isLocked: true,
      lockReason: security.lock_reason,
      timeRemaining,
      requiresAdminUnlock: !security.locked_until,
      failedAttempts: security.failed_attempts,
    };
  } catch (err) {
    console.error('[SECURITY] Error checking lockout:', err.message);
    return { isLocked: false, lockReason: null, timeRemaining: null };
  }
}

/**
 * Record a failed login attempt
 */
async function recordFailedAttempt(empno, reason, ipAddress) {
  try {
    // Log to audit trail
    await db.query(
      `INSERT INTO auth_audit_log (empno, event_type, reason, ip_address)
       VALUES (?, 'password_failed', ?, ?)`,
      [empno, reason, ipAddress]
    );

    // Get or create tracking record
    const [existing] = await db.query(
      'SELECT failed_attempts FROM user_tracking WHERE empno = ?',
      [empno]
    );

    let failedAttempts = 1;
    if (existing.length > 0) {
      failedAttempts = existing[0].failed_attempts + 1;
    }

    // Update or insert
    if (existing.length > 0) {
      await db.query(
        `UPDATE user_tracking 
         SET failed_attempts = ?, last_login_attempt = NOW(), last_login_ip = ?
         WHERE empno = ?`,
        [failedAttempts, ipAddress, empno]
      );
    } else {
      await db.query(
        `INSERT INTO user_tracking (empno, failed_attempts, last_login_attempt, last_login_ip)
         VALUES (?, ?, NOW(), ?)`,
        [empno, failedAttempts, ipAddress]
      );
    }

    console.log(`[SECURITY] Failed attempt ${failedAttempts} for ${empno}`);

    // Lock after three failed password attempts.
    const LOCKOUT_THRESHOLD = 3;
    if (failedAttempts >= LOCKOUT_THRESHOLD) {
      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000);

      await db.query(
        `UPDATE user_tracking 
         SET locked = TRUE, locked_until = ?, lock_reason = 'Too many failed login attempts'
         WHERE empno = ?`,
        [lockedUntil, empno]
      );

      await db.query(
        `INSERT INTO auth_audit_log (empno, event_type, reason, ip_address)
         VALUES (?, 'account_locked', 'Account locked after 3 failed attempts', ?)`,
        [empno, ipAddress]
      );

      console.error(`[SECURITY] Account ${empno} LOCKED until ${lockedUntil}`);
      return { shouldLock: true, attemptNumber: failedAttempts, lockedUntil };
    }

    return { shouldLock: false, attemptNumber: failedAttempts };
  } catch (err) {
    console.error('[SECURITY] Error recording failed attempt:', err.message);
    return { shouldLock: false, attemptNumber: 0 };
  }
}

/**
 * Record successful login
 */
async function recordSuccessfulLogin(empno, ipAddress) {
  try {
    await db.query(
      `UPDATE user_tracking 
       SET failed_attempts = 0, last_successful_login = NOW(), 
           last_login_attempt = NOW(), last_login_ip = ?
       WHERE empno = ?`,
      [ipAddress, empno]
    );

    await db.query(
      `INSERT INTO auth_audit_log (empno, event_type, reason, ip_address)
       VALUES (?, 'login_success', 'Successful login', ?)`,
      [empno, ipAddress]
    );

    console.log(`[SECURITY] Successful login for ${empno}`);
  } catch (err) {
    console.error('[SECURITY] Error recording successful login:', err.message);
  }
}

/**
 * Create login session
 */
async function createLoginSession(empno, sessionToken, jwtToken, ipAddress, userAgent) {
  try {
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

    await db.query(
      `UPDATE user_tracking 
       SET session_token = ?, jwt_token = NULL, session_active = TRUE, session_last_activity = NOW(),
           last_login_ip = ?, last_login_user_agent = ?
       WHERE empno = ?`,
      [sessionToken, ipAddress, userAgent, empno]
    );

    await writeAuditEvent({ empno, eventType: 'session_started', ipAddress, userAgent, sessionToken });

    console.log(`[SESSION] Created session for ${empno}`);
    return sessionToken;
  } catch (err) {
    console.error('[SESSION] Error creating session:', err.message);
    throw err;
  }
}

/**
 * Logout user
 */
async function logoutUser(sessionToken, ipAddress = null, userAgent = null) {
  try {
    const [rows] = await db.query('SELECT empno FROM user_tracking WHERE session_token = ?', [sessionToken]);
    await db.query(
      `UPDATE user_tracking 
       SET session_active = FALSE, session_token = NULL, session_last_activity = NULL
       WHERE session_token = ?`,
      [sessionToken]
    );

    if (rows.length) await writeAuditEvent({ empno: rows[0].empno, eventType: 'logout', ipAddress, userAgent, sessionToken });

    console.log('[SESSION] User logged out');
  } catch (err) {
    console.error('[SESSION] Error logging out:', err.message);
  }
}

// ─── TOTP & MFA ───

async function generateTOTPSecret(empno) {
  try {
    const secret = speakeasy.generateSecret({
      name: `DSWD ICTMS (${empno})`,
      issuer: 'DSWD',
      length: 32,
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
      backupCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }

    console.log(`[MFA] TOTP secret generated for ${empno}`);

    return {
      secret: secret.base32,
      qrCode,
      backupCodes,
    };
  } catch (err) {
    console.error('[MFA] Error generating TOTP:', err.message);
    throw new Error('Failed to generate TOTP secret');
  }
}

function verifyTOTPToken(secret, token) {
  try {
    if (!secret || !token) return false;

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2,
    });

    console.log(`[MFA] TOTP verification: ${verified ? 'SUCCESS' : 'FAILED'}`);
    return verified;
  } catch (err) {
    console.error('[MFA] Error verifying TOTP:', err.message);
    return false;
  }
}

function generateEmailOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashEmailOTP(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  // reCAPTCHA
  verifyRecaptchaV3,
  writeAuditEvent,

  // Security & Account Lockout
  checkAccountLockout,
  recordFailedAttempt,
  recordSuccessfulLogin,
  createLoginSession,
  logoutUser,

  // MFA
  generateTOTPSecret,
  verifyTOTPToken,
  generateEmailOTP,
  hashEmailOTP,
  generateSessionToken,
};
