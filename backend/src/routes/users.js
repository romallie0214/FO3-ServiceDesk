const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const db      = require('../db');
const harmonyApi  = require('../HarmonyApiClient');
const { sendEmail } = require('../services/emailService');
const mfaService = require('../services/mfaService');
const auth = require('../middleware/auth');
const { adminAreaIds, canManageArea } = require('../services/serviceAreaAccess');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error('JWT_SECRET must be configured.');

// ─── Helper: Get client IP ───
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.socket.remoteAddress ||
         '0.0.0.0';
}

// Matches the card layout used by ICTMS ticket-notification emails.
function mfaEmailTemplate(fullName, otp, isResend = false) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#0D3B6E;padding:16px 20px;border-radius:6px 6px 0 0;">
        <h2 style="color:#fff;margin:0;font-size:16px;">🔐 FO3 Service Desk Login Verification</h2>
      </div>
      <div style="background:#f9f9f9;padding:20px;border:1px solid #ddd;border-top:none;border-radius:0 0 6px 6px;">
        <p>Dear <strong>${fullName || 'User'}</strong>,</p>
        <p>${isResend ? 'A new' : 'Your'} one-time password has been generated for your FO3 Service Desk sign-in.</p>
        <div style="background:#fff;border:1px solid #ddd;padding:16px;margin:16px 0;text-align:center;border-radius:4px;">
          <div style="font-size:12px;color:#555;margin-bottom:6px;">ONE-TIME PASSWORD</div>
          <div style="font-size:30px;font-weight:bold;letter-spacing:7px;color:#0D3B6E;">${otp}</div>
        </div>
        <p>This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
        <p>If you did not attempt to sign in, please contact the ICT Helpdesk immediately.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="color:red;font-size:11px;margin:0;">*** This is a system generated message. DO NOT REPLY TO THIS EMAIL. ***</p>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════
// POST /login - NEW: Step 1 with reCAPTCHA + lockout
// ═══════════════════════════════════════════════════════════════
router.post('/login', async (req, res) => {
  try {
    const { password, recaptchaToken } = req.body;
    const username = String(req.body.username || '').trim();
    const clientIP = getClientIP(req);

    if (!username || !password || !recaptchaToken) {
      return res.status(400).json({
        error: 'Employee Number, password, and reCAPTCHA token are required.'
      });
    }

    console.log(`[LOGIN] Attempt for ${username}`);

    // ────────────────────────────────────────
    // STEP 1: Verify reCAPTCHA v3
    // ────────────────────────────────────────
    console.log('[LOGIN] Verifying reCAPTCHA v3...');
    const recaptchaResult = await mfaService.verifyRecaptchaV3(
      recaptchaToken,
      Number(process.env.RECAPTCHA_MIN_SCORE || 0.5),
      'login'
    );

    if (!recaptchaResult.success) {
      console.warn('[LOGIN] reCAPTCHA verification failed');
      await mfaService.writeAuditEvent({ empno: username, eventType: 'recaptcha_rejected', reason: 'Invalid token, action, or score', ipAddress: clientIP, userAgent: req.headers['user-agent'] });
      return res.status(400).json({
        error: 'reCAPTCHA verification failed. Please try again.',
      });
    }

    console.log(`[LOGIN] reCAPTCHA verified (score: ${recaptchaResult.score})`);

    // ────────────────────────────────────────
    // STEP 2: Check if account is locked
    // ────────────────────────────────────────
    console.log('[LOGIN] Checking account lockout...');
    const lockoutCheck = await mfaService.checkAccountLockout(username);

    if (lockoutCheck.isLocked) {
      console.error(`[LOGIN] Account ${username} is locked`);
      if (lockoutCheck.requiresAdminUnlock) {
        return res.status(423).json({
          error: 'Account locked by an administrator. Please contact the ICT Service Desk to request access.',
          requiresAdminUnlock: true,
        });
      }
      const minutesRemaining = Math.ceil(lockoutCheck.timeRemaining / 60);
      return res.status(429).json({
        error: `Account locked. Too many failed attempts. Try again in ${minutesRemaining} minutes.`,
        lockedUntil: lockoutCheck.timeRemaining,
      });
    }

    // ────────────────────────────────────────
    // STEP 3: Validate credentials via Harmony API
    // ────────────────────────────────────────
    console.log('[LOGIN] Validating credentials via Harmony API...');
    let ermUser;
    try {
      const apiResponse = await harmonyApi.validateCredentials(username, password);

      if (!apiResponse || !apiResponse.empno) {
        const [inactiveUsers] = await db.query('SELECT deleted_at FROM users WHERE empno = ? LIMIT 1', [username]);
        if (inactiveUsers[0]?.deleted_at) {
          await mfaService.writeAuditEvent({ empno: username, eventType: 'deactivated_login_attempt', ipAddress: clientIP, userAgent: req.headers['user-agent'] });
          return res.status(401).json({ error: 'Invalid Employee Number or password.' });
        }
        console.warn(`[LOGIN] Invalid credentials for ${username}`);
        let employeeExists = false;
        try {
          const employee = await harmonyApi.getEmployeeByEmpno(username);
          employeeExists = String(employee?.empno || '').trim() === username;
        } catch (lookupError) {
          if (lookupError.status !== 404) throw lookupError;
        }
        if (!employeeExists) {
          await mfaService.writeAuditEvent({ empno: username, eventType: 'password_failed', reason: 'Unknown employee number', ipAddress: clientIP, userAgent: req.headers['user-agent'] });
          return res.status(401).json({ error: 'Invalid Employee Number or password.' });
        }
        const failure = await mfaService.recordFailedAttempt(username, 'Invalid credentials', clientIP);
        if (failure.shouldLock) return res.status(429).json({ error: 'Account locked after 3 failed attempts. Try again in 30 minutes.' });
        return res.status(401).json({
          error: 'Invalid Employee Number or password.'
        });
      }

      const [existingManagedUsers] = await db.query(
        'SELECT deleted_at FROM users WHERE empno = ? LIMIT 1',
        [username]
      );
      if (existingManagedUsers[0]?.deleted_at) {
        await mfaService.writeAuditEvent({ empno: username, eventType: 'deactivated_login_attempt', ipAddress: clientIP, userAgent: req.headers['user-agent'] });
        return res.status(403).json({ error: 'This account has been deactivated. Please contact an administrator.' });
      }

      await db.query(
        'INSERT IGNORE INTO user_tracking (empno, failed_attempts, locked) VALUES (?, 0, FALSE)',
        [username]
      );
      ermUser = apiResponse;
      console.log(`[LOGIN] Credentials validated for ${username}`);
    } catch (ermErr) {
      console.error('Harmony API error:', ermErr.message);
      await mfaService.writeAuditEvent({ empno: username, eventType: 'identity_provider_error', reason: 'Harmony API error', ipAddress: clientIP, userAgent: req.headers['user-agent'] });
      return res.status(500).json({
        error: 'Unable to connect to HR system. Please try again later.'
      });
    }

    // ────────────────────────────────────────
    // STEP 4: Check account_status
    // ────────────────────────────────────────
    // const accountStatus = String(ermUser.account_status || '').toUpperCase();
    // let statusError = null;

    // switch (accountStatus) {
    //   case 'APPROVED':
    //   case '2':
    //     break; // OK
    //   case 'UNREGISTERED':
    //   case '0':
    //     statusError = 'Account Unregistered: Please register at http://172.31.32.57/registration/.';
    //     break;
    //   case 'PENDING':
    //   case '1':
    //     statusError = 'Account Pending Approval. Please contact local number 129.';
    //     break;
    //   case 'DISAPPROVED':
    //   case '3':
    //     statusError = 'Disapproved Account. Contact Personnel Admin at local number 129.';
    //     break;
    //   case 'LOCKED':
    //   case '4':
    //     statusError = 'Locked Account. Contact Personnel Admin at local number 129.';
    //     break;
    //   default:
    //     statusError = `Invalid account status (${accountStatus}). Contact HRPPMS-RSP.`;
    // }

    // if (statusError) {
    //   console.warn(`[LOGIN] Account status: ${accountStatus}`);
    //   await mfaService.writeAuditEvent({ empno: username, eventType: 'account_status_rejected', reason: `Status: ${accountStatus}`, ipAddress: clientIP, userAgent: req.headers['user-agent'] });
    //   return res.status(403).json({ error: statusError });
    // }

    // ────────────────────────────────────────
    // STEP 5: Get full employee info
    // ────────────────────────────────────────
    let unit            = ermUser.unit_name                    || '';
    let office_location = ermUser.area_assignment_name || '';

    if (!unit || !office_location) {
      try {
        const empInfo = await harmonyApi.getEmployeeByEmpno(username);
        const transformed = harmonyApi.transformEmployeeResponse(empInfo);
        if (transformed) {
          unit            = unit            || transformed.unit_name            || '';
          office_location = office_location || transformed.area_assignment_name || '';
        }
      } catch (suppErr) {
        console.warn('Harmony supplement error:', suppErr.message);
      }
    }

    const firstName  = ermUser.first_name  || '';
    const middleName = ermUser.middle_name ? ermUser.middle_name.charAt(0) + '.' : '';
    const lastName   = ermUser.last_name   || '';
    const fullName   = [firstName, middleName, lastName].filter(Boolean).join(' ') || `User ${username}`;
    const division   = ermUser.division_name || 'DSWD';
    const position   = ermUser.position_name || '';

    // ────────────────────────────────────────
    // STEP 6: Check if user is in ICTMS
    // ────────────────────────────────────────
    const [ictmsRows] = await db.query(
      'SELECT id, role FROM users WHERE empno = ?',
      [username]
    );

    let userId = null;
    let userRole = 'dswd_staff';

    if (ictmsRows.length > 0) {
      userId = ictmsRows[0].id;
      userRole = ictmsRows[0].role;

      await db.query(
        `UPDATE users SET full_name = ?, division = ?, unit = ? WHERE empno = ?`,
        [fullName, division, unit, username]
      );
      console.log(`[LOGIN] ICTMS user: ${username} (role: ${userRole})`);
    } else {
      console.log(`[LOGIN] DSWD Staff: ${username}`);
    }

    // ────────────────────────────────────────
    // STEP 7: Check MFA status
    // ────────────────────────────────────────
    const [trackingRows] = await db.query(
      'SELECT mfa_enabled, mfa_method FROM user_tracking WHERE empno = ?',
      [username]
    );

    const mfaEnabled = trackingRows.length > 0 && trackingRows[0].mfa_enabled;
    const mfaMethod = trackingRows.length > 0 ? trackingRows[0].mfa_method : null;

    if (!mfaEnabled) {
      // First-time users receive a short-lived, enrollment-only token. They do
      // not receive an application session until MFA is configured and verified.
      const enrollmentToken = jwt.sign({ empno: username, purpose: 'mfa_enrollment' }, SECRET, { expiresIn: '10m' });
      await mfaService.writeAuditEvent({ empno: username, eventType: 'mfa_enrollment_required', ipAddress: clientIP, userAgent: req.headers['user-agent'] });
      return res.json({
        message: 'MFA setup is required before you can sign in.',
        mfaSetupRequired: true,
        enrollmentToken,
        user: {
          empno: username,
          full_name: fullName,
          email: ermUser.email || `${username}@dswd.gov.ph`,
          role: userRole,
          division,
          unit,
          position,
          office_location,
        },
      });
    }

    // ────────────────────────────────────────
    // MFA ENABLED: Create MFA session
    // ────────────────────────────────────────
    console.log(`[LOGIN] MFA enabled for ${username}`);

    const mfaSessionToken = mfaService.generateSessionToken();
    const otp = mfaMethod === 'email' || mfaMethod === 'both' ? mfaService.generateEmailOTP() : null;
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const mfaSessionExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db.query(
      `UPDATE user_tracking
       SET mfa_session_token = ?, otp_email = NULL, email_otp_secret = ?, otp_email_expires_at = ?,
           mfa_session_expires_at = ?, totp_attempts = 0, email_attempts = 0
       WHERE empno = ?`,
      [mfaSessionToken, otp ? mfaService.hashEmailOTP(otp) : null, otpExpiresAt, mfaSessionExpiresAt, username]
    );

    const otpEmail = ermUser.email || `${username}@dswd.gov.ph`;

    // Return the MFA challenge immediately. SMTP delivery can take several
    // seconds and should not keep the user on the login screen.
    res.json({
      message: 'Credentials verified. MFA required.',
      mfaRequired: true,
      mfaMethod,
      emailDelivery: otp ? 'pending' : 'not_required',
      sessionToken: mfaSessionToken,
      user: {
        empno: username,
        full_name: fullName,
        email: otpEmail,
      },
    });

    // Deliver the OTP after responding. Keep the MFA session valid on failure
    // so the user can recover with the Resend OTP action.
    if (otp) {
      void sendEmail({
        to: otpEmail,
        subject: '[FO3 Service Desk] Your One-Time Password (OTP)',
        html: mfaEmailTemplate(fullName, otp),
      })
        .then(() => {
          console.log(`[MFA] Email OTP sent to ${otpEmail}`);
        })
        .catch(async (emailErr) => {
          console.error(`[MFA] Email OTP delivery failed for ${username}:`, emailErr.message);
          try {
            await mfaService.writeAuditEvent({
              empno: username,
              eventType: 'email_otp_delivery_failed',
              reason: emailErr.message,
              ipAddress: clientIP,
              userAgent: req.headers['user-agent'],
            });
          } catch (auditErr) {
            console.error('[MFA] Failed to audit OTP delivery failure:', auditErr.message);
          }
        });
    }

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({
      error: 'Server error. Please try again.'
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /verify-mfa - NEW: Step 2
// ═══════════════════════════════════════════════════════════════
router.post('/verify-mfa', async (req, res) => {
  try {
    const { sessionToken, mfaCode, mfaType } = req.body;
    const clientIP = getClientIP(req);

    if (!sessionToken || !/^[0-9]{6}$/.test(String(mfaCode)) || !['totp', 'email'].includes(mfaType)) {
      return res.status(400).json({
        error: 'Session token, MFA code, and MFA type are required.'
      });
    }

    console.log(`[MFA] Verifying ${mfaType} code`);

    const [trackingRows] = await db.query(
      `SELECT empno, otp_email, otp_email_expires_at, mfa_session_expires_at,
              totp_attempts, email_attempts, totp_secret, email_otp_secret, mfa_method
       FROM user_tracking
       WHERE mfa_session_token = ? AND mfa_session_expires_at > NOW()`,
      [sessionToken]
    );

    if (!trackingRows.length) {
      console.warn('[MFA] Session expired or invalid');
      return res.status(401).json({
        error: 'MFA session expired. Please login again.'
      });
    }

    const tracking = trackingRows[0];
    const { empno, otp_email, totp_attempts, email_attempts, totp_secret, email_otp_secret } = tracking;
    if (tracking.mfa_method !== 'both' && tracking.mfa_method !== mfaType) {
      return res.status(400).json({ error: 'This MFA method is not enabled for this account.' });
    }

    // Check attempt limits
    if (mfaType === 'totp' && totp_attempts >= 5) {
      await mfaService.recordFailedAttempt(empno, 'TOTP attempts exceeded', clientIP);
      return res.status(429).json({
        error: 'Too many TOTP attempts. Please try email OTP or login again.'
      });
    }

    if (mfaType === 'email' && email_attempts >= 5) {
      await mfaService.recordFailedAttempt(empno, 'Email OTP attempts exceeded', clientIP);
      return res.status(429).json({
        error: 'Too many email OTP attempts. Please try TOTP or login again.'
      });
    }

    let isValid = false;

    if (mfaType === 'totp') {
      console.log('[MFA] Verifying TOTP');
      if (totp_secret) {
        isValid = mfaService.verifyTOTPToken(totp_secret, mfaCode);
      }

      if (!isValid) {
        await db.query(
          'UPDATE user_tracking SET totp_attempts = totp_attempts + 1 WHERE empno = ?',
          [empno]
        );
        await mfaService.writeAuditEvent({ empno, eventType: 'totp_failed', reason: 'Invalid TOTP code', ipAddress: clientIP, userAgent: req.headers['user-agent'] });
        return res.status(401).json({ error: 'Invalid TOTP code.' });
      }

    } else if (mfaType === 'email') {
      console.log('[MFA] Verifying email OTP');
      isValid = Boolean(tracking.otp_email_expires_at && new Date(tracking.otp_email_expires_at) > new Date() && email_otp_secret && mfaService.hashEmailOTP(mfaCode) === email_otp_secret);

      if (!isValid) {
        await db.query(
          'UPDATE user_tracking SET email_attempts = email_attempts + 1 WHERE empno = ?',
          [empno]
        );
        await mfaService.writeAuditEvent({ empno, eventType: 'email_otp_failed', reason: 'Invalid or expired email OTP', ipAddress: clientIP, userAgent: req.headers['user-agent'] });
        return res.status(401).json({ error: 'Invalid or expired email OTP.' });
      }
    }

    // ────────────────────────────────────────
    // MFA verified!
    // ────────────────────────────────────────
    console.log(`[MFA] ✅ ${mfaType} verified for ${empno}`);

    // Clear MFA session
    await db.query(
      `UPDATE user_tracking
       SET mfa_session_token = NULL, otp_email = NULL, email_otp_secret = NULL, otp_email_expires_at = NULL,
           totp_attempts = 0, email_attempts = 0
       WHERE empno = ?`,
      [empno]
    );

    // Record successful login
    await mfaService.recordSuccessfulLogin(empno, clientIP);

    // Get user info
    const [ictmsUser] = await db.query(
      'SELECT id, role FROM users WHERE empno = ?',
      [empno]
    );
    const userId = ictmsUser[0]?.id || null;
    const [areaAdminRows] = userId ? await db.query(
      `SELECT service_area_id FROM user_service_roles
       WHERE user_id = ? AND service_role = 'admin' AND is_active = 1`,
      [userId]
    ) : [[]];
    const area_admin_service_ids = areaAdminRows.map(row => Number(row.service_area_id));

    let fullUserData;
    try {
      const harmonyData = await harmonyApi.getEmployeeByEmpno(empno);
      fullUserData = harmonyApi.transformEmployeeResponse(harmonyData);
    } catch (err) {
      console.warn('Could not fetch employee data:', err.message);
      fullUserData = null;
    }

    // Issue JWT
    const loginSessionToken = mfaService.generateSessionToken();
    const token = jwt.sign(
      {
        id: userId,
        empno,
        full_name: fullUserData?.full_name || 'User',
        email: fullUserData?.email || `${empno}@dswd.gov.ph`,
        role: ictmsUser.length > 0 ? ictmsUser[0].role : 'dswd_staff',
        division: fullUserData?.division_name || 'DSWD',
        unit: fullUserData?.unit_name || '',
        position: fullUserData?.position_name || '',
        office_location: fullUserData?.area_assignment_name || '',
        area_admin_service_ids,
        sid: loginSessionToken,
      },
      SECRET,
      { expiresIn: '8h' }
    );

    await mfaService.createLoginSession(empno, loginSessionToken, token, clientIP, req.headers['user-agent'] || 'unknown');
    await mfaService.writeAuditEvent({ empno, eventType: 'mfa_verified', reason: mfaType, ipAddress: clientIP, userAgent: req.headers['user-agent'] });

    console.log(`[LOGIN] ✅ Login successful for ${empno} (MFA verified)`);

    res.json({
      message: 'MFA verified successfully',
      token,
      sessionToken: loginSessionToken,
      user: {
        id: userId,
        empno,
        full_name: fullUserData?.full_name || 'User',
        email: fullUserData?.email || `${empno}@dswd.gov.ph`,
        role: ictmsUser.length > 0 ? ictmsUser[0].role : 'dswd_staff',
        division: fullUserData?.division_name || 'DSWD',
        unit: fullUserData?.unit_name || '',
        position: fullUserData?.position_name || '',
        area_admin_service_ids,
        office_location: fullUserData?.area_assignment_name || '',
      },
    });

  } catch (err) {
    console.error('MFA verification error:', err.message);
    res.status(500).json({
      error: 'Server error during MFA verification.'
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /setup-mfa - NEW
// ═══════════════════════════════════════════════════════════════
router.post('/setup-mfa', auth, async (req, res) => {
  try {
    const { empno, mfaMethod } = req.body;

    if (!empno || !['totp', 'email', 'both'].includes(mfaMethod)) {
      return res.status(400).json({
        error: 'Employee number and valid MFA method required.'
      });
    }

    if (req.user.empno !== empno) return res.status(403).json({ error: 'You can only configure MFA for your own account.' });
    console.log(`[MFA] Setting up for ${empno} (method: ${mfaMethod})`);

    let totpData = null;
    if (mfaMethod === 'totp' || mfaMethod === 'both') {
      totpData = await mfaService.generateTOTPSecret(empno);
      await db.query(
        `INSERT INTO user_tracking (empno, totp_pending_secret, totp_pending_expires_at)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))
         ON DUPLICATE KEY UPDATE totp_pending_secret = VALUES(totp_pending_secret), totp_pending_expires_at = VALUES(totp_pending_expires_at)`,
        [empno, totpData.secret]
      );
    }

    res.json({
      message: 'MFA setup initialized',
      mfaMethod,
      totp: totpData ? {
        secret: totpData.secret,
        qrCode: totpData.qrCode,
        backupCodes: totpData.backupCodes,
      } : null,
    });

  } catch (err) {
    console.error('MFA setup error:', err.message);
    res.status(500).json({ error: 'MFA setup failed.' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /confirm-mfa - NEW
// ═══════════════════════════════════════════════════════════════
router.post('/confirm-mfa', auth, async (req, res) => {
  try {
    const { empno, mfaMethod, totpCode } = req.body;

    if (!empno || !mfaMethod) {
      return res.status(400).json({
        error: 'Employee number and MFA method required.'
      });
    }

    if ((mfaMethod === 'totp' || mfaMethod === 'both') && !totpCode) {
      return res.status(400).json({
        error: 'TOTP code required to confirm setup.'
      });
    }

    if (req.user.empno !== empno) return res.status(403).json({ error: 'You can only configure MFA for your own account.' });
    console.log(`[MFA] Confirming for ${empno} (method: ${mfaMethod})`);

    if (mfaMethod === 'totp' || mfaMethod === 'both') {
      const [pendingRows] = await db.query(
        'SELECT totp_pending_secret FROM user_tracking WHERE empno = ? AND totp_pending_expires_at > NOW()',
        [empno]
      );
      if (!pendingRows.length) return res.status(400).json({ error: 'TOTP setup expired. Start setup again.' });
      const isValid = mfaService.verifyTOTPToken(pendingRows[0].totp_pending_secret, totpCode);

      if (!isValid) {
        return res.status(401).json({
          error: 'Invalid TOTP code. Please try again.'
        });
      }

      await db.query(
        `UPDATE user_tracking
         SET mfa_enabled = TRUE, mfa_method = ?, totp_secret = ?,
             totp_backup_codes = ?, mfa_setup_date = NOW(),
             totp_pending_secret = NULL, totp_pending_expires_at = NULL
         WHERE empno = ?`,
        [mfaMethod, pendingRows[0].totp_pending_secret, JSON.stringify([]), empno]
      );

      console.log(`[MFA] ✅ MFA confirmed for ${empno} (TOTP)`);

    } else if (mfaMethod === 'email') {
      await db.query(
        `UPDATE user_tracking
         SET mfa_enabled = TRUE, mfa_method = ?, mfa_setup_date = NOW()
         WHERE empno = ?`,
        [mfaMethod, empno]
      );

      console.log(`[MFA] ✅ MFA confirmed for ${empno} (Email)`);
    }

    await mfaService.writeAuditEvent({ empno, eventType: 'mfa_enrolled', reason: mfaMethod, ipAddress: getClientIP(req), userAgent: req.headers['user-agent'] });
    res.json({
      message: 'MFA setup confirmed successfully',
      mfaMethod,
    });

  } catch (err) {
    console.error('MFA confirm error:', err.message);
    res.status(500).json({
      error: 'MFA confirmation failed.'
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /logout - NEW
// ═══════════════════════════════════════════════════════════════
router.post('/resend-otp', async (req, res) => {
  try {
    const { sessionToken } = req.body;
    const [rows] = await db.query(
      `SELECT empno FROM user_tracking
       WHERE mfa_session_token = ? AND mfa_session_expires_at > NOW() AND mfa_method IN ('email', 'both')`,
      [sessionToken]
    );
    if (!rows.length) return res.status(401).json({ error: 'MFA session expired. Please login again.' });

    const empno = rows[0].empno;
    const employee = harmonyApi.transformEmployeeResponse(await harmonyApi.getEmployeeByEmpno(empno)) || {};
    const email = employee.email || `${empno}@dswd.gov.ph`;
    const otp = mfaService.generateEmailOTP();
    await db.query(
      'UPDATE user_tracking SET otp_email = NULL, email_otp_secret = ?, otp_email_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE), email_attempts = 0 WHERE empno = ?',
      [mfaService.hashEmailOTP(otp), empno]
    );
    await sendEmail({
      to: email,
      subject: '[FO3 Service Desk] Your One-Time Password (OTP)',
      html: mfaEmailTemplate(employee.full_name || employee.first_name, otp, true),
    });
    await mfaService.writeAuditEvent({ empno, eventType: 'email_otp_resent', ipAddress: getClientIP(req), userAgent: req.headers['user-agent'] });
    res.json({ message: 'A new verification code was sent.' });
  } catch (err) {
    console.error('OTP resend error:', err.message);
    res.status(503).json({ error: 'Unable to send a new verification code.' });
  }
});

// Super-admin recovery action for users who lost access to all MFA factors.
router.post('/admin/reset-mfa/:empno', auth, async (req, res) => {
  try {
    if (!await canRecoverAccount(req, String(req.params.empno || '').trim())) return res.status(403).json({ error: 'You can recover accounts assigned to your service area only.' });
    const empno = String(req.params.empno || '').trim();
    if (!empno) return res.status(400).json({ error: 'Employee number is required.' });
    if (empno === String(req.user.empno)) return res.status(400).json({ error: 'You cannot reset MFA for your own account.' });

    const [result] = await db.query(
      `UPDATE user_tracking
       SET mfa_enabled = FALSE, mfa_method = NULL, totp_secret = NULL, totp_backup_codes = NULL,
           email_otp_secret = NULL, otp_email = NULL, otp_email_expires_at = NULL,
           mfa_session_token = NULL, mfa_session_expires_at = NULL,
           totp_attempts = 0, email_attempts = 0, session_active = FALSE,
           session_token = NULL, jwt_token = NULL, totp_pending_secret = NULL, totp_pending_expires_at = NULL
       WHERE empno = ?`,
      [empno]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'No security record exists for this employee.' });

    await mfaService.writeAuditEvent({
      empno, eventType: 'mfa_reset_by_admin', reason: `Reset by ${req.user.empno}`,
      ipAddress: getClientIP(req), userAgent: req.headers['user-agent'],
    });
    res.json({ message: 'MFA reset. The user must enroll in MFA on their next login.' });
  } catch (err) {
    console.error('MFA reset error:', err.message);
    res.status(500).json({ error: 'Unable to reset MFA.' });
  }
});

// This unlocks the ICTMS failed-login lockout. Passwords are managed by Harmony/HR.
router.post('/admin/lock-account/:empno', auth, async (req, res) => {
  try {
    if (!await canRecoverAccount(req, String(req.params.empno || '').trim())) return res.status(403).json({ error: 'You can recover accounts assigned to your service area only.' });
    const empno = String(req.params.empno || '').trim();
    if (!empno) return res.status(400).json({ error: 'Employee number is required.' });
    if (empno === String(req.user.empno)) return res.status(400).json({ error: 'You cannot lock your own account.' });

    const [result] = await db.query(
      `UPDATE user_tracking
       SET locked = TRUE, locked_until = NULL, lock_reason = 'Locked by administrator'
       WHERE empno = ?`,
      [empno]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'No security record exists for this employee.' });

    await mfaService.writeAuditEvent({
      empno, eventType: 'account_locked_by_admin', reason: `Locked by ${req.user.empno}`,
      ipAddress: getClientIP(req), userAgent: req.headers['user-agent'],
    });
    res.json({ message: 'ICTMS account locked.' });
  } catch (err) {
    console.error('Account lock error:', err.message);
    res.status(500).json({ error: 'Unable to lock the account.' });
  }
});

router.post('/admin/unlock-account/:empno', auth, async (req, res) => {
  try {
    if (!await canRecoverAccount(req, String(req.params.empno || '').trim())) return res.status(403).json({ error: 'You can recover accounts assigned to your service area only.' });
    const empno = String(req.params.empno || '').trim();
    if (!empno) return res.status(400).json({ error: 'Employee number is required.' });
    if (empno === String(req.user.empno)) return res.status(400).json({ error: 'You cannot unlock your own account.' });

    const [result] = await db.query(
      `UPDATE user_tracking
       SET failed_attempts = 0, locked = FALSE, locked_until = NULL, lock_reason = NULL
       WHERE empno = ?`,
      [empno]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'No security record exists for this employee.' });

    await mfaService.writeAuditEvent({
      empno, eventType: 'account_unlocked_by_admin', reason: `Unlocked by ${req.user.empno}`,
      ipAddress: getClientIP(req), userAgent: req.headers['user-agent'],
    });
    res.json({ message: 'ICTMS login lockout cleared.' });
  } catch (err) {
    console.error('Account unlock error:', err.message);
    res.status(500).json({ error: 'Unable to unlock the account.' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { sessionToken } = req.body;

    if (sessionToken) {
      await mfaService.logoutUser(sessionToken, getClientIP(req), req.headers['user-agent'] || 'unknown');
      console.log('[LOGOUT] User logged out');
    }

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err.message);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// EXISTING ENDPOINTS - Keep all your original routes below
// ═══════════════════════════════════════════════════════════════

// User-management list. Kept separate from the public login endpoints and
// limited to Super Admin sessions.
// The client sends this only while the user is active. auth middleware updates
// session_last_activity and rejects already-idle sessions.
router.post('/session/activity', auth, (req, res) => {
  res.status(204).end();
});

const MANAGED_USER_ROLES = new Set(['super_admin', 'supervisor', 'ictms_staff', 'dswd_staff']);

async function canRecoverAccount(req, empno) {
  if (req.user.role === 'super_admin') return true;
  if (String(req.user.empno) === String(empno)) return false;
  const areaIds = await adminAreaIds(req.user);
  if (!areaIds.length) return false;
  const [rows] = await db.query(
    `SELECT 1 FROM users u JOIN user_service_roles usr ON usr.user_id = u.id
     WHERE u.empno = ? AND usr.is_active = 1 AND usr.service_area_id IN (${areaIds.map(() => '?').join(',')}) LIMIT 1`,
    [empno, ...areaIds]
  );
  return rows.length > 0;
}

function requireSuperAdmin(req, res) {
  if (req.user.role !== 'super_admin') {
    res.status(403).json({ error: 'Only Super Admins can manage system users.' });
    return false;
  }
  return true;
}

async function requireUserManager(req, res) {
  if (req.user.role === 'super_admin') return true;
  if ((await adminAreaIds(req.user)).length) return true;
  res.status(403).json({ error: 'Super Admin or Area Admin access is required.' });
  return false;
}

router.post('/', auth, async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'super_admin';
    const serviceAreaId = Number(req.body.service_area_id);
    if (!isSuperAdmin && (!Number.isInteger(serviceAreaId) || !await canManageArea(req.user, serviceAreaId))) {
      return res.status(403).json({ error: 'Area Admins can create users only for their designated service area.' });
    }

    const empno = String(req.body.empno || '').trim();
    const fullName = String(req.body.full_name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const role = isSuperAdmin ? String(req.body.role || '').trim() : 'dswd_staff';
    const division = String(req.body.division || '').trim();
    const unit = String(req.body.unit || '').trim();

    if (!empno || !fullName || !email || !MANAGED_USER_ROLES.has(role)) {
      return res.status(400).json({ error: 'Employee number, full name, valid email, and role are required.' });
    }

    const [result] = await db.query(
      `INSERT INTO users (empno, full_name, email, role, division, unit)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [empno, fullName, email, role, division || null, unit || null]
    );

    if (!isSuperAdmin) {
      await db.query('INSERT INTO user_service_roles (service_area_id, user_id, service_role, is_active) VALUES (?, ?, ?, 1)', [serviceAreaId, result.insertId, 'technical_staff']);
    }
    res.status(201).json({ id: result.insertId, message: 'User added successfully.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A user with this employee number or email already exists. Restore a deactivated user instead of adding a duplicate.' });
    }
    console.error('User create error:', err.message);
    res.status(500).json({ error: 'Unable to add user.' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    if (!requireSuperAdmin(req, res)) return;

    const id = Number(req.params.id);
    const fullName = String(req.body.full_name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const role = String(req.body.role || '').trim();
    const division = String(req.body.division || '').trim();
    const unit = String(req.body.unit || '').trim();

    if (!Number.isInteger(id) || id < 1 || !fullName || !email || !MANAGED_USER_ROLES.has(role)) {
      return res.status(400).json({ error: 'Full name, valid email, and role are required.' });
    }

    const [result] = await db.query(
      `UPDATE users
       SET full_name = ?, email = ?, role = ?, division = ?, unit = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [fullName, email, role, division || null, unit || null, id]
    );

    if (!result.affectedRows) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: 'User updated successfully.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'That email address is already assigned to another user.' });
    }
    console.error('User update error:', err.message);
    res.status(500).json({ error: 'Unable to update user.' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    if (!requireSuperAdmin(req, res)) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid user ID.' });

    const [users] = await db.query('SELECT empno, deleted_at FROM users WHERE id = ?', [id]);
    if (!users.length) return res.status(404).json({ error: 'User not found.' });
    if (users[0].empno === req.user.empno) {
      return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    }
    if (users[0].deleted_at) return res.status(409).json({ error: 'User is already deactivated.' });

    const [activeTickets] = await db.query(
      "SELECT COUNT(*) AS count FROM tickets WHERE assigned_to = ? AND status NOT IN ('Closed', 'Resolved', 'Cancelled')",
      [id]
    );
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query(
        'UPDATE users SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
        [id]
      );
      if (!result.affectedRows) throw Object.assign(new Error('User is already deactivated.'), { status: 409 });
      await connection.query(
        'UPDATE user_tracking SET session_active = FALSE, session_token = NULL, session_last_activity = NULL, mfa_session_token = NULL, mfa_session_expires_at = NULL WHERE empno = ?',
        [users[0].empno]
      );
      await connection.query(
        'INSERT INTO auth_audit_log (empno, event_type, reason) VALUES (?, ?, ?)',
        [users[0].empno, 'account_deactivated_by_admin', 'Deactivated by ' + req.user.empno]
      );
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    res.json({ message: 'User deactivated. Ticket history was preserved.', activeTicketCount: activeTickets[0].count });
  } catch (err) {
    console.error('User deactivation error:', err.message);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Unable to deactivate user.' });
  }
});

router.patch('/:id/restore', auth, async (req, res) => {
  try {
    if (!requireSuperAdmin(req, res)) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid user ID.' });
    const [users] = await db.query('SELECT empno, deleted_at FROM users WHERE id = ?', [id]);
    if (!users.length) return res.status(404).json({ error: 'User not found.' });
    if (!users[0].deleted_at) return res.status(409).json({ error: 'User is already active.' });

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('UPDATE users SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL', [id]);
      await connection.query(
        'INSERT INTO auth_audit_log (empno, event_type, reason) VALUES (?, ?, ?)',
        [users[0].empno, 'account_restored_by_admin', 'Restored by ' + req.user.empno]
      );
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
    res.json({ message: 'User restored. They may sign in again.' });
  } catch (err) {
    console.error('User restore error:', err.message);
    res.status(500).json({ error: 'Unable to restore user.' });
  }
});

// Minimal staff directory used by ticket assignment controls. Operational
// roles need this list, but must not receive the full user-management dataset.
router.get('/assignable-staff', auth, async (req, res) => {
  try {
    const allowedRoles = new Set(['super_admin', 'supervisor', 'ictms_staff']);
    const areaIds = (await adminAreaIds(req.user)) || [];
    const isServiceAdmin = req.user.role !== 'super_admin' && areaIds.length > 0;
    if (!allowedRoles.has(req.user.role) && !isServiceAdmin) {
      return res.status(403).json({ error: 'Only ICTMS personnel can view assignable staff.' });
    }

    const serviceAreaId = Number(req.query.service_area_id);
    if (!Number.isInteger(serviceAreaId) || serviceAreaId <= 0) {
      return res.status(400).json({ error: 'A valid service_area_id is required.' });
    }
    if (isServiceAdmin && !areaIds.includes(serviceAreaId)) {
      return res.status(403).json({ error: 'You can view staff in your service area only.' });
    }

    const [rows] = await db.query(
      `SELECT DISTINCT u.id, u.empno, u.full_name, u.role, u.division, usr.service_role
       FROM users u
       JOIN user_service_roles usr ON usr.user_id = u.id
       JOIN service_areas sa ON sa.id = usr.service_area_id
       WHERE usr.is_active = 1 AND sa.is_active = 1 AND usr.service_area_id = ?
         AND usr.service_role IN ('admin', 'supervisor', 'technical_staff') AND u.deleted_at IS NULL
       ORDER BY u.full_name`,
      [serviceAreaId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Assignable staff list error:', err.message);
    res.status(500).json({ error: 'Unable to load assignable staff.' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const areaIds = await adminAreaIds(req.user);
    if (req.user.role !== 'super_admin' && !areaIds.length) return res.status(403).json({ error: 'Only Super Admins or Area Admins can view system users.' });
    const includeDeleted = req.query.include_deleted === '1';
    const areaScope = req.user.role === 'super_admin' ? '' : 'INNER JOIN user_service_roles scope_usr ON scope_usr.user_id = u.id AND scope_usr.service_area_id IN (' + areaIds.map(() => '?').join(',') + ') AND scope_usr.is_active = 1';
    const assignmentSelect = req.user.role === 'super_admin'
      ? "GROUP_CONCAT(CONCAT(sa.code, '|', usr.service_role) ORDER BY sa.code SEPARATOR ';;') AS service_assignments"
      : "GROUP_CONCAT(CASE WHEN usr.service_area_id IN (" + areaIds.map(() => '?').join(',') + ") THEN CONCAT(sa.code, '|', usr.service_role) END ORDER BY sa.code SEPARATOR ';;') AS service_assignments";
    const [rows] = await db.query(
      `SELECT u.id, u.empno, u.full_name, u.email, u.role, u.division, u.unit, u.deleted_at,
        ${assignmentSelect}
       FROM users u
       ${areaScope}
       LEFT JOIN user_service_roles usr ON usr.user_id = u.id AND usr.is_active = 1
       LEFT JOIN service_areas sa ON sa.id = usr.service_area_id AND sa.is_active = 1
       ${includeDeleted ? '' : 'WHERE u.deleted_at IS NULL'}
       GROUP BY u.id, u.empno, u.full_name, u.email, u.role, u.division, u.unit, u.deleted_at
       ORDER BY u.role, u.full_name`
    , req.user.role === 'super_admin' ? [] : [...areaIds, ...areaIds]);
    res.json(rows);
  } catch (err) {
    console.error('User list error:', err.message);
    res.status(500).json({ error: 'Unable to load users.' });
  }
});

// Account Recovery is a security-operation screen. Its source of truth is
// user_tracking: a person appears here only once a security record exists.
// User and Service Area data are attached when a managed account is available.
router.get('/admin/account-recovery', auth, async (req, res) => {
  try {
    const areaIds = (await adminAreaIds(req.user)) || [];
    if (req.user.role !== 'super_admin' && !areaIds.length) return res.status(403).json({ error: 'Super Admin or Area Admin access is required.' });
    const scoped = req.user.role !== 'super_admin';
    const placeholders = areaIds.map(() => '?').join(',');
    const [accounts] = await db.query(
      scoped
        ? `SELECT DISTINCT ut.empno, u.full_name, u.email, u.role, u.division, u.deleted_at,
             ut.locked, ut.locked_until, ut.lock_reason
           FROM user_tracking ut
           JOIN users u ON u.empno = ut.empno
           JOIN user_service_roles usr ON usr.user_id = u.id AND usr.is_active = 1
           WHERE usr.service_area_id IN (${placeholders})
           ORDER BY COALESCE(u.full_name, ut.empno)`
        : `SELECT ut.empno, u.full_name, u.email, u.role, u.division, u.deleted_at,
             ut.locked, ut.locked_until, ut.lock_reason
           FROM user_tracking ut
           LEFT JOIN users u ON u.empno = ut.empno
           ORDER BY COALESCE(u.full_name, ut.empno)`,
      scoped ? areaIds : []
    );
    res.json(accounts.map(account => ({
      empno: account.empno,
      full_name: account.full_name || account.empno,
      email: account.email || 'Not available',
      role: account.role,
      division: account.division,
      harmonyAvailable: Boolean(account.full_name),
      deactivated: Boolean(account.deleted_at),
      locked: Boolean(account.locked),
      lockedUntil: account.locked_until,
      lockReason: account.lock_reason,
    })));
  } catch (err) {
    console.error('Account recovery list error:', err.message);
    res.status(500).json({ error: 'Unable to load account recovery records.' });
  }
});

// Office-location access bindings are used only by Users & Access.
router.get('/empno/:empno/office-locations', auth, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Only Super Admins can view office access bindings.' });
    const [rows] = await db.query(
      `SELECT office_location_code AS code, office_location_name AS name
       FROM user_office_locations WHERE empno = ? ORDER BY office_location_name`,
      [req.params.empno]
    );
    res.json(rows);
  } catch (err) {
    console.error('Office access list error:', err.message);
    res.status(500).json({ error: 'Unable to load office access bindings.' });
  }
});

router.post('/empno/:empno/office-locations', auth, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Only Super Admins can update office access bindings.' });
    const empno = String(req.params.empno || '').trim();
    const locations = Array.isArray(req.body.locations) ? req.body.locations : [];
    if (!empno) return res.status(400).json({ error: 'Employee number is required.' });
    const normalized = locations.map(location => ({ code: Number(location.code), name: String(location.name || '').trim() }))
      .filter(location => Number.isInteger(location.code) && location.code > 0 && location.name);

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('DELETE FROM user_office_locations WHERE empno = ?', [empno]);
      for (const location of normalized) {
        await connection.query(
          'INSERT INTO user_office_locations (empno, office_location_code, office_location_name) VALUES (?, ?, ?)',
          [empno, location.code, location.name]
        );
      }
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
    res.json({ message: 'Office access bindings updated.', count: normalized.length });
  } catch (err) {
    console.error('Office access update error:', err.message);
    res.status(500).json({ error: 'Unable to update office access bindings.' });
  }
});

router.get('/erm/divisions', auth, async (req, res) => {
  try {
    if (!await requireUserManager(req, res)) return;
    const divisions = await harmonyApi.getDivisions();
    const rows = (Array.isArray(divisions) ? divisions : []).map(division => ({
      division_code: String(division.id ?? division.division_code ?? division.code ?? ''),
      division_name: String(division.name ?? division.division_name ?? division.label ?? ''),
    })).filter(division => division.division_code && division.division_name);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching divisions:', err.message);
    res.status(502).json({ error: 'Unable to fetch divisions from Harmony.' });
  }
});

router.get('/erm/all-office-locations', async (req, res) => {
  try {
    const locations = await harmonyApi.getOfficeLocations();
    const rows = (Array.isArray(locations) ? locations : []).map(location => ({
      code: Number(location.code ?? location.office_location_code ?? location.id),
      name: String(location.name ?? location.office_location_name ?? location.label ?? ''),
    })).filter(location => Number.isInteger(location.code) && location.name);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching all office locations:', err.message);
    res.status(500).json({ error: 'Unable to fetch office locations from Harmony.' });
  }
});

router.get('/erm/units/:division_id', auth, async (req, res) => {
  try {
    if (!await requireUserManager(req, res)) return;
    const divisionId = String(req.params.division_id);
    const units = await harmonyApi.getUnitsByDivision(divisionId);
    const rows = (Array.isArray(units) ? units : [])
      .filter(unit => String(unit.division_id ?? unit.division?.id ?? '') === divisionId)
      .map(unit => ({
      unit_code: String(unit.id ?? unit.unit_code ?? unit.code ?? ''),
      unit_name: String(unit.name ?? unit.unit_name ?? unit.label ?? ''),
    })).filter(unit => unit.unit_code && unit.unit_name);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching units:', err.message);
    res.status(502).json({ error: 'Unable to fetch units from Harmony.' });
  }
});

router.get('/erm/employees', auth, async (req, res) => {
  try {
    if (!await requireUserManager(req, res)) return;
    const divisionId = String(req.query.division_code || '').trim();
    const unitName = String(req.query.unit_name || '').trim();
    if (divisionId.length === 0 || unitName.length === 0) {
      return res.status(400).json({ error: 'Division and unit are required.' });
    }

    const firstPage = await harmonyApi.getEmployeesByFilters(
      { divisionId, unitName },
      1,
      100
    );
    const totalPages = Math.max(Number(firstPage?.meta?.totalPages || 1), 1);
    const remainingPages = totalPages > 1
      ? await Promise.all(
          Array.from(
            { length: totalPages - 1 },
            (_, index) => harmonyApi.getEmployeesByFilters(
              { divisionId, unitName },
              index + 2,
              100
            )
          )
        )
      : [];

    const candidates = [firstPage, ...remainingPages].flatMap(page => {
      const payload = page?.data ?? page;
      return Array.isArray(payload)
        ? payload
        : (payload?.employees || payload?.users || payload?.data || []);
    });

    const employees = candidates
      .map(record => harmonyApi.transformEmployeeResponse(record?.user || record))
      .filter(employee => employee?.empno)
      .map(employee => ({
        empno: String(employee.empno),
        full_name: employee.full_name,
        email: employee.email || String(employee.empno) + '@dswd.gov.ph',
        position_name: employee.position_name || '',
        position_classification_id: employee.position_name || null,
      }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));

    res.json(employees);
  } catch (err) {
    console.error('Error fetching employees:', err.message);
    res.status(502).json({ error: 'Unable to fetch employees from Harmony.' });
  }
});

router.get('/erm/office-locations', async (req, res) => {
  try {
    const { division_id, unit_id } = req.query;
    const locations = await harmonyApi.getOfficeLocations(division_id, unit_id);
    res.json(locations);
  } catch (err) {
    console.error('Error fetching office locations:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Add any other existing routes from your original users.js ───

// CSM respondent lookup. Uses Harmony's bulk endpoint even for one employee so
// the same complete HR record is used for name, sex, mobile/email, and birthdate.
router.get('/erm/:empno', async (req, res) => {
  try {
    const empno = String(req.params.empno || '').trim();
    if (!empno) return res.status(400).json({ error: 'Employee number is required.' });

    const bulkResponse = await harmonyApi.getEmployeesBulk([empno]);
    const payload = bulkResponse?.data ?? bulkResponse;
    const candidates = Array.isArray(payload)
      ? payload
      : (payload?.employees || payload?.users || payload?.data || []);
    const record = Array.isArray(candidates)
      ? candidates.find(item => String((item?.user || item)?.empno || '') === empno) || candidates[0]
      : candidates;
    const employee = record?.user || record;
    const transformed = harmonyApi.transformEmployeeResponse(employee);

    if (!transformed?.empno) return res.status(404).json({ error: 'Employee was not found in Harmony.' });
    res.json(transformed);
  } catch (err) {
    console.error('Harmony CSM employee lookup error:', err.message);
    res.status(502).json({ error: 'Unable to retrieve employee information from Harmony.' });
  }
});

module.exports = router;
