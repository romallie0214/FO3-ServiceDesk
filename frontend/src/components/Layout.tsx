import { createPortal } from 'react-dom';
import { LayoutDashboard, List, Activity, UserCheck, Inbox, Plus, Settings, Users, Tags, Folder, Building2, Clock, BookOpen, Files, Download, ChartColumn, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';
import AppHeader from './AppHeader';

const NAV_GROUPS = [
  { label: '', items: [{ label: 'Dashboard', path: '/', page: 'dashboard', icon: LayoutDashboard }] },
  { label: 'Tickets', items: [
    { label: 'Ticket list', path: '/tickets', page: 'tickets', icon: List },
    { label: 'Ticket monitoring', path: '/monitoring', page: 'monitoring', icon: Activity },
    { label: 'Assigned to me', path: '/my-tickets', page: 'my_tickets', icon: UserCheck },
    { label: 'My submitted', path: '/my-requests', page: 'my_requests', icon: Inbox },
    { label: 'Submit a ticket', path: '/submit', page: 'submit', icon: Plus },
    { label: 'Ticket administration', path: '/admin', page: 'admin', icon: Settings },
  ] },
  { label: 'Manage', items: [
    { label: 'Users', path: '/users', page: 'users', icon: Users },
    { label: 'Statuses', path: '/statuses', page: 'statuses', icon: Tags },
    { label: 'Categories', path: '/categories', page: 'categories', icon: Folder },
    { label: 'Service areas & staff', path: '/service-areas', page: 'service_areas', icon: Building2 },
    { label: 'SLA', path: '/sla', page: 'sla', icon: Clock },
    { label: 'KB management', path: '/admin/knowledge_base', page: 'knowledge_base', icon: BookOpen },
    { label: 'Service templates', path: '/service-templates', page: 'service_templates', icon: Files },
  ] },
  { label: 'Resources', items: [
    { label: 'Knowledge base', path: '/kb', page: 'kb', icon: BookOpen },
    { label: 'Download hub', path: '/templates', page: 'templates', icon: Download },
    { label: 'CSM reports', path: '/csm-reports', page: 'csm', icon: ChartColumn },
  ] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { canAccess } = useAuth();
  const [open, setOpen] = useState(false);
  const [tooltip, setTooltip] = useState<{ label: string; x: number; y: number } | null>(null);
  const showTooltip = (element: HTMLElement, label: string) => {
    if (!collapsed || window.matchMedia('(max-width:700px)').matches) return;
    const rect = element.getBoundingClientRect();
    setTooltip({ label, x: rect.right + 14, y: rect.top + rect.height / 2 });
  };
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('desk-sidebar-collapsed') === 'true');
  const toggleCollapsed = () => { setTooltip(null); setCollapsed(previous => {
    localStorage.setItem('desk-sidebar-collapsed', String(!previous));
    return !previous;
  }); };
  const sheetRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const media = window.matchMedia('(max-width:700px)');
    if (!media.matches) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => Array.from(sheetRef.current?.querySelectorAll<HTMLElement>('a[href], button') || []);
    focusable()[0]?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0], last = elements[elements.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    const resized = () => { if (!media.matches) setOpen(false); };
    media.addEventListener('change', resized);
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', keydown);
      media.removeEventListener('change', resized);
      previous?.focus();
    };
  }, [open]);
  return <><AppHeader menuOpen={open} onToggleMenu={() => setOpen(!open)} /><div className="desk-shell">
    <div className={'desk-sheet-backdrop' + (open ? ' is-open' : '')} onClick={() => setOpen(false)} aria-hidden="true" />
    <aside ref={sheetRef} role={open ? 'dialog' : undefined} aria-modal={open || undefined} aria-label="Navigation" id="desk-navigation" className={'desk-sidebar' + (open ? ' is-open' : '') + (collapsed ? ' is-collapsed' : '')}>
      <button type="button" className="desk-sidebar-toggle" onClick={toggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} aria-controls="desk-sidebar-links" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
      <div className="desk-sheet-heading"><strong>FO3 Service Desk</strong><button type="button" aria-label="Close navigation" onClick={() => setOpen(false)}><X size={20} aria-hidden="true" /></button></div>
      <nav id="desk-sidebar-links" aria-label="Main navigation" onScroll={() => setTooltip(null)}>{NAV_GROUPS.map(group => {
        const items = group.items.filter(item => canAccess(item.page));
        return items.length > 0 && <div className="desk-nav-group" key={group.label}>{group.label && <h2>{group.label}</h2>}{items.map(item =>
          <NavLink aria-label={item.label} aria-describedby={tooltip?.label === item.label ? 'desk-nav-tooltip' : undefined}
            onMouseEnter={event => showTooltip(event.currentTarget, item.label)} onMouseLeave={() => setTooltip(null)}
            onFocus={event => showTooltip(event.currentTarget, item.label)} onBlur={() => setTooltip(null)}
            onKeyDown={event => { if (event.key === 'Escape') setTooltip(null); }} end to={item.path} key={item.path} onClick={() => { setOpen(false); setTooltip(null); }} className={({isActive}) => 'desk-nav-link' + (isActive ? ' is-active' : '')}>
            <span aria-hidden="true" className="desk-nav-icon"><item.icon size={15} strokeWidth={1.7} /></span><span className="desk-nav-label">{item.label}</span>
          </NavLink>)}</div>;
      })}</nav>

    </aside>
    <main className="desk-main">{children}</main>
  </div>
    {tooltip && createPortal(<div id="desk-nav-tooltip" role="tooltip" className="desk-nav-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>{tooltip.label}</div>, document.body)}
  </>;
}
