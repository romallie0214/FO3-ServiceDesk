import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Unauthorized() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Admin',
    supervisor:  'ICTMS Supervisor',
    ictms_staff: 'ICTMS Technical Staff',
    dswd_staff:  'DSWD Staff',
  };

  // Where to redirect based on role
  function goHome() {
    if (!user) { navigate('/login'); return; }
    switch (user.role) {
      case 'super_admin':  navigate('/'); break;
      case 'supervisor':   navigate('/'); break;
      case 'ictms_staff':  navigate('/'); break;
      case 'dswd_staff':   navigate('/tickets'); break;
      default:             navigate('/login');
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F0F3F7',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 'clamp(12px, 3vw, 20px)',
    }}>
      {/* Header */}
      <div style={{
        background: 'var(--gov-navy)', width: '100%',
        padding: 'clamp(10px, 2vw, 16px) clamp(14px, 3vw, 24px)', position: 'absolute', top: 0,
        display: 'flex', alignItems: 'center', gap: 'clamp(8px, 2vw, 14px)',
        flexWrap: 'wrap',
      }}>
        <div style={{
          width: 'clamp(28px, 5vw, 40px)', height: 'clamp(28px, 5vw, 40px)', borderRadius: '50%',
          background: '#fff', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <div style={{
            width: 'clamp(22px, 4vw, 32px)', height: 'clamp(22px, 4vw, 32px)', borderRadius: '50%',
            border: '2px solid var(--gov-navy)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 'clamp(5px, 1vw, 8px)',
            fontWeight: 700, color: 'var(--gov-navy)',
            textAlign: 'center', lineHeight: 1.1,
          }}>DSWD<br/>PHL</div>
        </div>
        <div style={{ color: '#fff' }}>
          <p style={{ fontSize: 'clamp(13px, 2.2vw, 16px)', fontWeight: 500, margin: 0 }}>
            Department of Social Welfare and Development
          </p>
          <span style={{ fontSize: 'clamp(10px, 1.8vw, 12px)', color: 'rgba(255,255,255,0.65)', display: 'block' }}>
            ICTMS — IT Help Desk & Ticketing System
          </span>
        </div>
      </div>

      {/* Card */}
      <div style={{
        background: '#fff', borderRadius: 10,
        border: '0.5px solid #D0D9E4', width: 'clamp(280px, 90vw, 420px)',
        overflow: 'hidden', textAlign: 'center',
        marginTop: 'clamp(60px, 12vw, 80px)',
      }}>
        <div style={{ background: 'var(--gov-red)', padding: 'clamp(16px, 3vw, 24px) clamp(18px, 4vw, 28px)' }}>
          <div style={{ fontSize: 'clamp(32px, 8vw, 48px)', marginBottom: 'clamp(6px, 1.5vw, 10px)' }}>🚫</div>
          <p style={{ color: '#fff', fontSize: 'clamp(14px, 2.5vw, 18px)', fontWeight: 600, margin: 0 }}>
            Access Denied
          </p>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 'clamp(10px, 1.8vw, 12px)', marginTop: 'clamp(3px, 0.6vw, 6px)', margin: 0 }}>
            You don't have permission to view this page
          </p>
        </div>
        <div style={{ padding: 'clamp(18px, 4vw, 28px)' }}>
          {user && (
            <div style={{
              background: '#F5F8FC', borderRadius: 6,
              padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 14px)', marginBottom: 'clamp(12px, 2.5vw, 18px)',
              fontSize: 'clamp(11px, 1.9vw, 14px)', color: '#4A4A4A', lineHeight: 1.6,
            }}>
              Logged in as <strong>{user.full_name}</strong><br />
              Role: <strong style={{ color: 'var(--gov-navy)' }}>
                {roleLabels[user.role] ?? user.role}
              </strong>
            </div>
          )}
          <p style={{ fontSize: 'clamp(9px, 1.6vw, 12px)', color: '#6A7280', marginBottom: 'clamp(14px, 3vw, 20px)', lineHeight: 1.6, margin: 0 }}>
            Your current role does not have access to this page.
            Please contact your system administrator if you believe
            this is an error.
          </p>
          <div style={{ display: 'flex', gap: 'clamp(6px, 1.5vw, 10px)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={goHome}
              style={{
                padding: 'clamp(6px, 1.2vw, 9px) clamp(14px, 3vw, 20px)', fontSize: 'clamp(11px, 1.9vw, 14px)',
                background: 'var(--gov-navy)', color: '#fff',
                border: 'none', borderRadius: 4, cursor: 'pointer',
                fontWeight: 500, whiteSpace: 'nowrap',
              }}
            >
              Go to My Dashboard
            </button>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              style={{
                padding: 'clamp(6px, 1.2vw, 9px) clamp(14px, 3vw, 20px)', fontSize: 'clamp(11px, 1.9vw, 14px)',
                border: '1px solid #C8D0DC', borderRadius: 4,
                background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
