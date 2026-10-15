import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

declare global {
  interface Window {
    grecaptcha: any;
  }
}

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  // Step 1: Credentials
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState(() => {
    const message = sessionStorage.getItem('ictms_auth_message') || '';
    sessionStorage.removeItem('ictms_auth_message');
    return message;
  });
  const [mfaSetupComplete, setMfaSetupComplete] = useState(false);
  const [loading, setLoading]   = useState(false);

  // Step 2: MFA
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaType, setMfaType] = useState<'totp' | 'email'>('email');
  const [mfaMethod, setMfaMethod] = useState<'totp' | 'email' | 'both'>('email');
  const [sessionToken, setSessionToken] = useState('');
  const [mfaUser, setMfaUser] = useState<any>(null);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaSetupRequired, setMfaSetupRequired] = useState(false);
  const [enrollmentToken, setEnrollmentToken] = useState('');
  const [setupMethod, setSetupMethod] = useState<'totp' | 'email' | 'both'>('totp');
  const [setupQrCode, setSetupQrCode] = useState('');
  const [setupCode, setSetupCode] = useState('');

  // Load reCAPTCHA script
  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY) return;

    const script = document.createElement('script');
    script.src =
      `https://www.google.com/recaptcha/api.js?render=${
        encodeURIComponent(RECAPTCHA_SITE_KEY)
      }`;

    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'strict-origin-when-cross-origin';

    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  // ────────────────────────────────────────
  // STEP 1: Handle login form submission
  // ────────────────────────────────────────
  async function handleLogin() {
    if (!username || !password) {
      setError('Please enter your Employee Number and password.');
      return;
    }

    setLoading(true);
    setError('');
    setMfaSetupComplete(false);

    try {
      // Get reCAPTCHA token
      if (!RECAPTCHA_SITE_KEY || !window.grecaptcha) throw new Error('reCAPTCHA is not configured or has not loaded.');
      const recaptchaToken = await new Promise<string>((resolve, reject) => {
        window.grecaptcha.ready(() => window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'login' }).then(resolve).catch(reject));
      });

      // Submit credentials + reCAPTCHA token
      const res = await api.post('/users/login', {
        username,
        password,
        recaptchaToken,
      });

      // Check if MFA is required
      if (res.data.mfaSetupRequired) {
        setMfaSetupRequired(true);
        setEnrollmentToken(res.data.enrollmentToken);
        setMfaUser(res.data.user);
      } else if (res.data.mfaRequired) {
        setMfaRequired(true);
        setMfaMethod(res.data.mfaMethod);
        setSessionToken(res.data.sessionToken);
        setMfaUser(res.data.user);
        setMfaType(res.data.mfaMethod === 'both' ? 'email' : (res.data.mfaMethod as 'totp' | 'email'));
        setError('');
      } else {
        // No MFA - login directly
        login(res.data.token, res.data.user, res.data.sessionToken);

        const role = res.data.user.role;
        if (role === 'super_admin' || role === 'ictms_staff' || res.data.user.area_admin_service_ids?.length) navigate('/');
        else if (role === 'supervisor') navigate('/');
        else navigate('/tickets');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Login failed. Please try again.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  // ────────────────────────────────────────
  // STEP 2: Handle MFA verification
  // ────────────────────────────────────────
  async function handleMFAVerify() {
    if (!mfaCode) {
      setError('Please enter the MFA code.');
      return;
    }

    setMfaLoading(true);
    setError('');

    try {
      const res = await api.post('/users/verify-mfa', {
        sessionToken,
        mfaCode,
        mfaType,
      });

      // MFA verified - login
      login(res.data.token, res.data.user, res.data.sessionToken);

      const role = res.data.user.role;
      if (role === 'super_admin' || role === 'ictms_staff' || res.data.user.area_admin_service_ids?.length) navigate('/');
      else if (role === 'supervisor') navigate('/');
      else navigate('/tickets');
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'MFA verification failed. Please try again.';
      setError(errorMsg);
    } finally {
      setMfaLoading(false);
    }
  }

  // ────────────────────────────────────────
  // Handle resend OTP
  // ────────────────────────────────────────
  async function handleResendOTP() {
    setMfaLoading(true);
    try {
      await api.post('/users/resend-otp', { sessionToken });
      setError('A new OTP was sent to your registered email address.');
    } catch (err: any) {
      setError('Failed to resend OTP');
    } finally {
      setMfaLoading(false);
    }
  }

  async function startMfaSetup() {
    setMfaLoading(true); setError('');
    try {
      const res = await api.post('/users/setup-mfa', { empno: mfaUser.empno, mfaMethod: setupMethod }, {
        headers: { Authorization: `Bearer ${enrollmentToken}` },
      });
      setSetupQrCode(res.data.totp?.qrCode || '');
      if (setupMethod === 'email') await confirmMfaSetup();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to start MFA setup.');
    } finally { setMfaLoading(false); }
  }

  async function confirmMfaSetup() {
    if ((setupMethod === 'totp' || setupMethod === 'both') && !/^[0-9]{6}$/.test(setupCode)) {
      setError('Enter the 6-digit code from Google Authenticator.'); return;
    }
    setMfaLoading(true); setError('');
    try {
      await api.post('/users/confirm-mfa', { empno: mfaUser.empno, mfaMethod: setupMethod, totpCode: setupCode }, {
        headers: { Authorization: `Bearer ${enrollmentToken}` },
      });
      setMfaSetupRequired(false); setEnrollmentToken(''); setSetupQrCode(''); setSetupCode(''); setPassword('');
      setMfaSetupComplete(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'MFA setup could not be completed.');
    } finally { setMfaLoading(false); }
  }

  // ────────────────────────────────────────
  // Go back to login
  // ────────────────────────────────────────
  function handleBackToLogin() {
    setMfaRequired(false);
    setMfaCode('');
    setSessionToken('');
    setMfaUser(null);
    setError('');
  }

  if (mfaSetupRequired) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F0F3F7', padding: 20 }}>
        <div style={{ width: 'min(420px, 100%)', background: '#fff', borderRadius: 10, padding: 28, boxShadow: '0 4px 20px rgba(0,0,0,.08)' }}>
          <h2 style={{ marginTop: 0, color: 'var(--gov-navy)' }}>Set up multi-factor authentication</h2>
          <p>For your protection, {mfaUser?.full_name || 'you'} must set up MFA before accessing FO3 Service Desk.</p>
          {error && <p style={{ color: '#8B1A1A' }}>{error}</p>}
          {!setupQrCode && <>
            <fieldset style={{ border: 0, padding: 0, margin: '20px 0' }}>
              <legend style={{ fontWeight: 600, color: '#1A2A3A', marginBottom: 10 }}>Choose your MFA method</legend>
              <div style={{ display: 'grid', gap: 10 }}>
                {([
                  { value: 'totp', icon: '📱', title: 'Google Authenticator', description: 'Use a 6-digit code generated by the authenticator app.' },
                  { value: 'email', icon: '✉️', title: 'Email OTP', description: 'Receive a one-time code through your registered email.' },
                  { value: 'both', icon: '🛡️', title: 'Authenticator and Email', description: 'Set up both methods and choose either one when signing in.' },
                ] as const).map(option => {
                  const selected = setupMethod === option.value;
                  return (
                    <label key={option.value} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14,
                      borderRadius: 8, cursor: 'pointer',
                      border: '2px solid ' + (selected ? 'var(--gov-navy)' : '#D0D9E4'),
                      background: selected ? '#E8F1FA' : '#fff',
                      transition: 'border-color .15s, background-color .15s',
                    }}>
                      <input type="radio" name="mfa-setup-method" value={option.value}
                        checked={selected} onChange={() => setSetupMethod(option.value)}
                        style={{ marginTop: 4, accentColor: 'var(--gov-navy)', flexShrink: 0 }} />
                      <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1.2 }}>{option.icon}</span>
                      <span>
                        <span style={{ display: 'block', color: 'var(--gov-navy)', fontWeight: 600, marginBottom: 2 }}>{option.title}</span>
                        <span style={{ display: 'block', color: '#5A6475', fontSize: 13, lineHeight: 1.4 }}>{option.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <button onClick={startMfaSetup} disabled={mfaLoading} style={{ width: '100%', padding: 11, background: 'var(--gov-navy)', color: '#fff', border: 0, borderRadius: 4 }}>{mfaLoading ? 'Starting…' : 'Continue'}</button>
          </>}
          {setupQrCode && <>
            <p>Scan this QR code with Google Authenticator, then enter the generated code.</p>
            <img src={setupQrCode} alt="Google Authenticator QR code" style={{ display: 'block', width: 200, margin: '12px auto' }} />
            <input value={setupCode} onChange={e => setSetupCode(e.target.value.replace(/\D/g, ''))} maxLength={6} placeholder="6-digit code" style={{ width: '100%', boxSizing: 'border-box', padding: 10, textAlign: 'center', letterSpacing: 4 }} />
            <button onClick={confirmMfaSetup} disabled={mfaLoading} style={{ width: '100%', marginTop: 12, padding: 11, background: 'var(--gov-navy)', color: '#fff', border: 0, borderRadius: 4 }}>{mfaLoading ? 'Verifying…' : 'Confirm MFA setup'}</button>
          </>}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // MFA STEP
  // ════════════════════════════════════════════════════════════
  if (mfaRequired) {
    return (
      <div style={{
        minHeight: '100vh', background: '#F0F3F7',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(12px, 3vw, 20px)',
      }}>
        {/* Header banner */}
        <div style={{
          background: 'var(--gov-navy)', width: '100%',
          padding: 'clamp(10px, 2vw, 16px) clamp(14px, 3vw, 24px)', position: 'absolute', top: 0,
          display: 'flex', alignItems: 'center', gap: 'clamp(8px, 2vw, 14px)',
          flexWrap: 'wrap',
        }}>
          <img
            src="/dswd_logo.png"
            alt="DSWD Logo"
            style={{ height: 'clamp(28px, 5vw, 40px)', width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
          />
          <div style={{ color: '#fff' }}>
            <p style={{ fontSize: 'clamp(13px, 2.2vw, 16px)', fontWeight: 500, margin: 0 }}>
              Department of Social Welfare and Development
            </p>
            <span style={{ fontSize: 'clamp(10px, 1.8vw, 12px)', color: 'rgba(255,255,255,0.65)', display: 'block' }}>
              FO3 Service Desk
            </span>
          </div>
        </div>

        {/* MFA Card */}
        <div style={{
          background: '#fff', borderRadius: 10,
          border: '0.5px solid #D0D9E4', width: 'clamp(280px, 90vw, 420px)',
          overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          marginTop: 'clamp(60px, 12vw, 80px)',
        }}>
          <div style={{ background: 'var(--gov-navy)', padding: 'clamp(16px, 3vw, 24px)', textAlign: 'center' }}>
            <p style={{ color: '#fff', fontSize: 'clamp(14px, 2.5vw, 18px)', fontWeight: 600, margin: 0 }}>
              Multi-Factor Authentication
            </p>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 'clamp(10px, 1.8vw, 12px)', marginTop: 'clamp(3px, 0.5vw, 6px)', margin: 0 }}>
              Hello {mfaUser?.full_name}
            </p>
          </div>

          <div style={{ padding: 'clamp(18px, 4vw, 28px)' }}>
            {error && (
              <div style={{
                background: '#FDE8E8', border: '1px solid #8B1A1A',
                borderRadius: 4, padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 14px)',
                fontSize: 'clamp(10px, 1.8vw, 12px)', color: '#8B1A1A', marginBottom: 'clamp(10px, 2vw, 14px)',
                lineHeight: 1.6, whiteSpace: 'pre-line',
              }}>
                {error}
              </div>
            )}

            {/* MFA Method Selector (if both) */}
            {mfaMethod === 'both' && (
              <div style={{ marginBottom: 'clamp(14px, 3vw, 20px)' }}>
                <label style={{
                  fontSize: 'clamp(9px, 1.6vw, 12px)', fontWeight: 500, color: '#5A6475',
                  textTransform: 'uppercase', letterSpacing: 0.4,
                  display: 'block', marginBottom: 'clamp(6px, 1vw, 10px)',
                }}>
                  Choose Method
                </label>
                <div style={{ display: 'flex', gap: 'clamp(8px, 1.5vw, 12px)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'clamp(4px, 0.8vw, 6px)', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      value="email"
                      checked={mfaType === 'email'}
                      onChange={(e) => setMfaType(e.target.value as 'email')}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 'clamp(11px, 1.9vw, 14px)', color: '#2A2A2A' }}>
                      Email OTP
                    </span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'clamp(4px, 0.8vw, 6px)', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      value="totp"
                      checked={mfaType === 'totp'}
                      onChange={(e) => setMfaType(e.target.value as 'totp')}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 'clamp(11px, 1.9vw, 14px)', color: '#2A2A2A' }}>
                      Authenticator App
                    </span>
                  </label>
                </div>
              </div>
            )}

            {mfaType === 'email' && (
              <div role="status" style={{
                background: '#E8F1FA', borderLeft: '3px solid var(--gov-navy)',
                borderRadius: 4, padding: '10px 12px', marginBottom: 16,
                color: '#234B73', fontSize: 12, lineHeight: 1.5,
              }}>
                Your OTP is being sent to your registered email. You can enter it here as soon as it arrives.
              </div>
            )}

            {/* MFA Code Input */}
            <div style={{ marginBottom: 'clamp(14px, 3vw, 20px)' }}>
              <label style={{
                fontSize: 'clamp(9px, 1.6vw, 12px)', fontWeight: 500, color: '#5A6475',
                textTransform: 'uppercase', letterSpacing: 0.4,
                display: 'block', marginBottom: 'clamp(3px, 0.6vw, 5px)',
              }}>
                {mfaType === 'email' ? 'Email OTP (6 digits)' : 'Authenticator Code (6 digits)'}
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder={mfaType === 'email' ? 'Enter code from email' : 'Enter code from app'}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleMFAVerify()}
                style={{
                  width: '100%', padding: 'clamp(7px, 1.2vw, 10px) clamp(8px, 1.5vw, 12px)',
                  border: '1px solid #C8D0DC', borderRadius: 4,
                  fontSize: mfaCode ? 'clamp(18px, 3vw, 24px)' : 'clamp(12px, 2vw, 14px)', color: '#2A2A2A',
                  boxSizing: 'border-box', textAlign: 'center',
                  letterSpacing: mfaCode ? 'clamp(4px, 0.8vw, 8px)' : 'normal',
                  fontWeight: 600,
                }}
              />
            </div>

            {/* Resend OTP (for email) */}
            {mfaType === 'email' && (
              <div style={{ marginBottom: 'clamp(12px, 2.5vw, 18px)', textAlign: 'center' }}>
                <button
                  onClick={handleResendOTP}
                  disabled={mfaLoading}
                  style={{
                    background: 'none', border: 'none',
                    fontSize: 'clamp(10px, 1.8vw, 12px)', color: '#0056A4',
                    textDecoration: 'underline', cursor: mfaLoading ? 'not-allowed' : 'pointer',
                    padding: 0,
                  }}
                >
                  Didn't receive code? Resend OTP
                </button>
              </div>
            )}

            {/* Verify Button */}
            <button
              onClick={handleMFAVerify}
              disabled={mfaLoading || mfaCode.length !== 6}
              style={{
                width: '100%', padding: 'clamp(8px, 1.5vw, 11px)',
                background: (mfaLoading || mfaCode.length !== 6) ? '#888' : 'var(--gov-navy)',
                color: '#fff', border: 'none', borderRadius: 4,
                fontSize: 'clamp(12px, 2vw, 16px)', fontWeight: 500,
                cursor: (mfaLoading || mfaCode.length !== 6) ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {mfaLoading ? 'Verifying...' : 'Verify MFA'}
            </button>

            {/* Back to Login */}
            <div style={{ marginTop: 'clamp(12px, 2.5vw, 18px)', textAlign: 'center' }}>
              <button
                onClick={handleBackToLogin}
                disabled={mfaLoading}
                style={{
                  background: 'none', border: 'none',
                  fontSize: 'clamp(10px, 1.8vw, 12px)', color: '#5A6475',
                  textDecoration: 'underline', cursor: mfaLoading ? 'not-allowed' : 'pointer',
                  padding: 0,
                }}
              >
                Back to login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // LOGIN STEP (Original UI)
  // ════════════════════════════════════════════════════════════
  return (
    <div style={{
      minHeight: '100vh', background: '#F0F3F7',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 'clamp(12px, 3vw, 20px)',
    }}>
      {/* Header banner */}
      <div style={{
        background: 'var(--gov-navy)', width: '100%',
        padding: 'clamp(10px, 2vw, 16px) clamp(14px, 3vw, 24px)', position: 'absolute', top: 0,
        display: 'flex', alignItems: 'center', gap: 'clamp(8px, 2vw, 14px)',
        flexWrap: 'wrap',
      }}>
        <img
          src="/dswd_logo.png"
          alt="DSWD Logo"
          style={{ height: 'clamp(28px, 5vw, 40px)', width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
        />
        <div style={{ color: '#fff' }}>
          <p style={{ fontSize: 'clamp(13px, 2.2vw, 16px)', fontWeight: 500, margin: 0 }}>
            Department of Social Welfare and Development
          </p>
          <span style={{ fontSize: 'clamp(10px, 1.8vw, 12px)', color: 'rgba(255,255,255,0.65)', display: 'block' }}>
              FO3 Service Desk
          </span>
        </div>
      </div>

      {/* Login Card */}
      <div style={{
        background: '#fff', borderRadius: 10,
        border: '0.5px solid #D0D9E4', width: 'clamp(280px, 90vw, 420px)',
        overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        marginTop: 'clamp(60px, 12vw, 80px)',
      }}>
        <div style={{ background: 'var(--gov-navy)', padding: 'clamp(16px, 3vw, 24px)', textAlign: 'center' }}>
          <p style={{ color: '#fff', fontSize: 'clamp(14px, 2.5vw, 18px)', fontWeight: 600, margin: 0 }}>
            FO3 Service Desk
          </p>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 'clamp(10px, 1.8vw, 12px)', marginTop: 'clamp(3px, 0.5vw, 6px)', margin: 0 }}>
            Sign in with your DSWD Employee Number
          </p>
        </div>

        <div style={{ padding: 'clamp(18px, 4vw, 28px)' }}>
          {mfaSetupComplete && (
            <div role='status' aria-live='polite' style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              background: '#E8F5EE', border: '1px solid #2E7D4F',
              borderRadius: 4, padding: 'clamp(10px, 1.8vw, 14px)',
              color: '#165C35', marginBottom: 'clamp(10px, 2vw, 14px)', lineHeight: 1.5,
            }}>
              <span aria-hidden='true' style={{ fontSize: 18, lineHeight: 1.2 }}>✓</span>
              <div>
                <div style={{ fontSize: 'clamp(12px, 2vw, 14px)', fontWeight: 600, marginBottom: 3 }}>
                  MFA setup complete
                </div>
                <div style={{ fontSize: 'clamp(10px, 1.8vw, 12px)' }}>
                  Your account is now protected with multi-factor authentication. For security, your setup session has ended. Sign in below using your Employee Number and password.
                </div>
              </div>
            </div>
          )}
          {error && (
            <div style={{
              background: '#FDE8E8', border: '1px solid #8B1A1A',
              borderRadius: 4, padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 14px)',
              fontSize: 'clamp(10px, 1.8vw, 12px)', color: '#8B1A1A', marginBottom: 'clamp(10px, 2vw, 14px)',
              lineHeight: 1.6, whiteSpace: 'pre-line',
            }}>
              {error}
            </div>
          )}

          {/* Employee Number */}
          <div style={{ marginBottom: 'clamp(10px, 2vw, 14px)' }}>
            <label style={{
              fontSize: 'clamp(9px, 1.6vw, 12px)', fontWeight: 500, color: '#5A6475',
              textTransform: 'uppercase', letterSpacing: 0.4,
              display: 'block', marginBottom: 'clamp(3px, 0.6vw, 5px)',
            }}>
              Employee Number (empno)
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="e.g. 12345"
              disabled={loading}
              style={{
                width: '100%', padding: 'clamp(7px, 1.2vw, 10px) clamp(8px, 1.5vw, 12px)',
                border: '1px solid #C8D0DC', borderRadius: 4,
                fontSize: 'clamp(11px, 1.9vw, 14px)', color: '#2A2A2A',
                boxSizing: 'border-box',
                opacity: loading ? 0.6 : 1,
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 'clamp(14px, 3vw, 20px)' }}>
            <label style={{
              fontSize: 'clamp(9px, 1.6vw, 12px)', fontWeight: 500, color: '#5A6475',
              textTransform: 'uppercase', letterSpacing: 0.4,
              display: 'block', marginBottom: 'clamp(3px, 0.6vw, 5px)',
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="••••••••"
              disabled={loading}
              style={{
                width: '100%', padding: 'clamp(7px, 1.2vw, 10px) clamp(8px, 1.5vw, 12px)',
                border: '1px solid #C8D0DC', borderRadius: 4,
                fontSize: 'clamp(11px, 1.9vw, 14px)', color: '#2A2A2A',
                boxSizing: 'border-box',
                opacity: loading ? 0.6 : 1,
              }}
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%', padding: 'clamp(8px, 1.5vw, 11px)',
              background: loading ? '#888' : 'var(--gov-navy)',
              color: '#fff', border: 'none', borderRadius: 4,
              fontSize: 'clamp(12px, 2vw, 16px)', fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          {/* reCAPTCHA Info */}
          <div style={{
            marginTop: 'clamp(12px, 2.5vw, 18px)',
            fontSize: 'clamp(8px, 1.4vw, 10px)', color: '#999', textAlign: 'center', lineHeight: 1.5,
          }}>
            This site is protected by reCAPTCHA and the Google<br />
            <a href="https://policies.google.com/privacy" style={{ color: '#0056A4', textDecoration: 'none' }}>
              Privacy Policy
            </a>
            {' '}and{' '}
            <a href="https://policies.google.com/terms" style={{ color: '#0056A4', textDecoration: 'none' }}>
              Terms of Service
            </a>
            {' '}apply.
          </div>

          {/* Info note */}
          <div style={{
            marginTop: 'clamp(12px, 2.5vw, 18px)', padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 14px)',
            background: '#F5F8FC', borderRadius: 4,
            fontSize: 'clamp(9px, 1.6vw, 12px)', color: '#5A6475', lineHeight: 1.7,
          }}>
            Use your DSWD Employee Number and system password to log in.
            Your role will be automatically determined based on your account.
            First-time users will be registered as DSWD Staff automatically.
          </div>
        </div>
      </div>
    </div>
  );
}
