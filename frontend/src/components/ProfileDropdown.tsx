import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './ProfileDropdown.css';

const ROLE_LABELS: Record<string, string> = { super_admin: 'Super Admin', supervisor: 'Legacy Supervisor', ictms_staff: 'Legacy Service Desk Staff', dswd_staff: 'FO3 Staff' };
export default function ProfileDropdown() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!containerRef.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const initials = user?.full_name?.split(' ').filter(w => w[0] === w[0]?.toUpperCase()).map(w => w[0]).join('').slice(0, 2) || 'U';
  const role = user?.role !== 'super_admin' && !!user?.area_admin_service_ids?.length ? 'Service Admin' : ROLE_LABELS[user?.role || ''] || user?.role;
  return <div className="header-profile" ref={containerRef} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
    <button ref={buttonRef} className="header-profile-trigger" aria-label={`Profile for ${user?.full_name || 'User'}`} aria-expanded={open} aria-controls="header-profile-panel" onClick={() => setOpen(!open)}>
      <span className="header-profile-avatar" aria-hidden="true">{initials}</span><span className="header-profile-name">{user?.full_name || 'User'}</span><ChevronDown size={14} aria-hidden="true" className="header-profile-chevron" />
    </button>
    <div className="header-profile-panel" id="header-profile-panel" inert={!open} aria-hidden={!open}><div className="header-profile-details">
      <span className="header-profile-menu-avatar" aria-hidden="true">{initials}</span><div className="header-profile-info"><div className="header-profile-title"><strong>{user?.full_name || 'User'}</strong></div>
      {user?.unit && <p>{user.unit}</p>}{user?.division && <p className="header-profile-division">{user.division}</p>}<div className="header-profile-role-row"><span className="header-profile-role">{role}</span></div></div>
    </div><button className="header-profile-signout" onClick={() => { logout(); navigate('/login'); }}><LogOut size={14} aria-hidden="true" />Sign Out</button></div>
  </div>;
}
