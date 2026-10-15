import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ALL_NAV = [
  { label: 'Dashboard',            path: '/',        page: 'dashboard' },
  { label: 'Submit a Ticket',      path: '/submit',  page: 'submit'    },
  { label: 'My Tickets',        path: '/my-tickets', page: 'my_tickets' },
  { label: 'My Requests',       path: '/my-requests', page: 'my_requests' },
  { label: 'Ticket List & Tracking', path: '/tickets', page: 'tickets' },  
  { label: 'Admin Management',     path: '/admin',   page: 'admin'     },
  { label: 'CSM Reports',          path: '/csm-reports', page: 'csm'   },
  { label: 'Knowledge Base',       path: '/kb',      page: 'kb'        },
  { label: 'User Management',      path: '/users',       page: 'users' },
  { label: 'Status Management',    path: '/statuses', page: 'statuses' },
  { label: 'Category Management',path:'/categories', page: 'categories'},
  { label: 'SLA Management',                 path: '/sla', page: 'sla' },
  { label: 'KB Management', path: '/admin/knowledge-base', page: 'knowledge_base' },
  { label: 'Ticket Monitoring', path: '/monitoring', page: 'monitoring' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, canAccess } = useAuth();
  const isServiceAdmin = user?.role !== 'super_admin' && (user?.area_admin_service_ids?.length ?? 0) > 0;

  const navItems = ALL_NAV.filter(item => canAccess(item.page));

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const initials = user?.full_name
    ?.split(' ')
    .filter(w => w[0] === w[0]?.toUpperCase())
    .map(w => w[0])
    .join('')
    .slice(0, 2) ?? 'U';

  const roleLabel: Record<string, string> = {
    super_admin: 'Super Admin',
    supervisor:  'Legacy Supervisor',
    ictms_staff: 'Legacy Service Desk Staff',
    dswd_staff:  isServiceAdmin ? 'Service Admin' : 'FO3 Staff',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* TOP HEADER - Fully Responsive */}
      <div style={{
        background: 'var(--gov-navy)',
        padding: 'clamp(8px, 2vw, 15px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'clamp(8px, 2vw, 12px)',
        minHeight: '52px',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        {/* LEFT: Logo + Title - Always visible */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'clamp(6px, 1.5vw, 10px)',
          flex: '1 1 auto',
          minWidth: 0,
          overflow: 'hidden',
        }}>
          <img
            src="/dswd_logo.png"
            alt="DSWD Logo"
            style={{
              height: 'clamp(28px, 5vw, 38px)',
              width: 'auto',
              objectFit: 'contain',
              filter: 'brightness(0) invert(1)',
              flexShrink: 0,
            }}
          />
          
          {/* Title - Responsive font size, always visible */}
          <div style={{
            color: '#fff',
            minWidth: 0,
          }}>
            <p style={{
              fontSize: 'clamp(10px, 2vw, 14px)',
              fontWeight: 500,
              lineHeight: 1.2,
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              Department of Social Welfare and Development
            </p>
            <span style={{
              fontSize: 'clamp(8px, 1.5vw, 11px)',
              color: 'rgba(255,255,255,0.7)',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              FO3 Service Desk
            </span>
          </div>
        </div>

        {/* RIGHT SECTION - All visible, responsive sizing */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'clamp(6px, 1.5vw, 10px)',
          flex: '0 1 auto',
          flexShrink: 0,
          justifyContent: 'flex-end',
          minWidth: 0,
        }}>
          {/* BACK TO DASHBOARD - Super Admin only */}
          {(user?.role === 'super_admin' || isServiceAdmin) && location.pathname !== '/' && (
            <button
              onClick={() => navigate('/')}
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 4,
                padding: 'clamp(4px, 1vw, 6px) clamp(8px, 1.5vw, 12px)',
                cursor: 'pointer',
                color: '#fff',
                fontSize: 'clamp(8px, 1.5vw, 11px)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
            >
              ← Dashboard
            </button>
          )}

          {/* ROLE BADGE - Always visible, responsive size */}
          <div style={{
            background: 'rgba(255,255,255,0.15)',
            padding: 'clamp(2px, 0.5vw, 4px) clamp(6px, 1.5vw, 10px)',
            borderRadius: 10,
            fontSize: 'clamp(8px, 1.5vw, 11px)',
            color: '#F5A623',
            fontWeight: 500,
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}>
            {roleLabel[user?.role ?? ''] ?? user?.role}
          </div>

          {/* AVATAR - Always visible */}
          <div style={{
            width: 'clamp(24px, 6vw, 32px)',
            height: 'clamp(24px, 6vw, 32px)',
            borderRadius: '50%',
            background: 'var(--gov-green)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'clamp(9px, 2vw, 11px)',
            fontWeight: 600,
            color: '#fff',
            flexShrink: 0,
          }}>
            {initials}
          </div>

          {/* USER INFO - Always visible, responsive size */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            maxWidth: 'clamp(80px, 15vw, 220px)',
          }}>
            <p style={{
              fontSize: 'clamp(8px, 1.5vw, 11px)',
              color: '#fff',
              fontWeight: 600,
              margin: 0,
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {user?.full_name ?? 'User'}
            </p>
            {user?.unit && (
              <span style={{
                fontSize: 'clamp(7px, 1.2vw, 10px)',
                color: 'rgba(255,255,255,0.7)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {user.unit}
              </span>
            )}
            {user?.division && (
              <span style={{
                fontSize: 'clamp(7px, 1.2vw, 10px)',
                color: 'rgba(255,255,255,0.6)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {user.division}
              </span>
            )}
          </div>

          {/* LOGOUT BUTTON - Always visible */}
          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: 4,
              padding: 'clamp(5px, 1.5vw, 8px) clamp(8px, 2vw, 12px)',
              cursor: 'pointer',
              color: '#fff',
              fontSize: 'clamp(8px, 1.5vw, 11px)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* SUB NAVIGATION - Responsive, horizontal scroll on mobile */}
      {user?.role !== 'super_admin' && !isServiceAdmin && (
        <div style={{
          background: 'var(--gov-navy2)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 clamp(10px, 2vw, 20px)',
          gap: 'clamp(2px, 0.5vw, 4px)',
          flexShrink: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
        }}>
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  padding: 'clamp(6px, 1.5vw, 8px) clamp(8px, 1.5vw, 14px)',
                  fontSize: 'clamp(9px, 1.5vw, 12px)',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.7)',
                  borderBottom: isActive ? '3px solid #F5A623' : '3px solid transparent',
                  fontWeight: isActive ? 500 : 400,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.15s',
                  flexShrink: 0,
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}

      {/* PAGE CONTENT */}
      <div style={{
        flex: 1,
        padding: 'clamp(12px, 3vw, 20px)',
        overflowY: 'auto',
        overflowX: 'hidden',
        minWidth: 0,
      }}>
        {children}
      </div>
    </div>
  );
}
