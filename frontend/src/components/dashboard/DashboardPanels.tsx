import AppTable from '../AppTable';
import StatusBadge from '../StatusBadge';
import { Tickets, Inbox, UserCheck, LoaderCircle, PauseCircle, CircleCheck, CircleX, Archive } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DashboardTicket } from '../../hooks/useAdminDashboard';

export const TICKET_STATUSES = [
  { label: 'Open', icon: Inbox, color: '#d97706' }, { label: 'Assigned', icon: UserCheck, color: '#087c98' },
  { label: 'In Progress', icon: LoaderCircle, color: '#7c3aed' }, { label: 'On-Hold', icon: PauseCircle, color: '#a16207' },
  { label: 'Resolved', icon: CircleCheck, color: '#15803d' }, { label: 'Cancelled', icon: CircleX, color: '#b91c1c' },
  { label: 'Closed', icon: Archive, color: '#64748b' },
];
export function TicketTotals({ tickets, unavailable, serviceArea = 'all' }: { tickets: DashboardTicket[]; unavailable: boolean; serviceArea?: string }) {
  const counts = tickets.reduce<Record<string, number>>((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});
  const stats = [{ label: 'Total', icon: Tickets, color: '#123e70', value: tickets.length }, ...TICKET_STATUSES.map(s => ({ ...s, value: counts[s.label] || 0 }))];
  return <section className="desk-totals" aria-label="Ticket totals">{stats.map(s => <Link className="desk-stat" key={s.label} to={'/tickets?' + new URLSearchParams({ ...(s.label !== 'Total' ? { status: s.label } : {}), ...(serviceArea !== 'all' ? { service_area: serviceArea } : {}) }).toString()} aria-label={'View ' + (s.label === 'Total' ? 'all' : s.label) + ' tickets'}>
    <div className="desk-stat-icon" data-shimmer-no-children style={{ color: s.color, backgroundColor: s.color + '14' }}><s.icon size={22} strokeWidth={1.7} aria-hidden="true" /></div><div className="desk-stat-content"><span>{s.label === 'On-Hold' ? 'On hold' : s.label}</span>
    <strong>{unavailable ? 'Unavailable' : s.value}</strong></div>
  </Link>)}</section>;
}
export function RecentTickets({ tickets, unavailable, compact = false, onTicketClick }: { tickets: DashboardTicket[]; unavailable: boolean; compact?: boolean; onTicketClick?: (ticket: DashboardTicket) => void }) {
  const recent = [...tickets].sort((a,b) => Date.parse(b.updated_at || b.created_at) - Date.parse(a.updated_at || a.created_at)).slice(0,5);
  if (compact) return <section className="desk-panel desk-recent-panel"><header><h2>Recent tickets</h2><Link to="/tickets">View all</Link></header>
    <div className="desk-recent-list">{recent.length ? recent.map(ticket => <Link className="desk-recent-ticket" key={ticket.id} to="/tickets" onClick={event => { if (onTicketClick && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onTicketClick(ticket); } }}>
      <div className="desk-recent-person"><span className="desk-recent-avatar" aria-hidden="true">{(ticket.requestor || ticket.requestor_name || '?').split(/\s+/).filter(Boolean).map(part => part[0]).slice(0,2).join('').toUpperCase()}</span><div><strong>{ticket.requestor || ticket.requestor_name || 'Requestor unavailable'}</strong><span title={ticket.office_location || undefined}>{ticket.office_location || 'Office not provided'}</span></div></div>
      <p>{ticket.subject}</p><div className="desk-recent-meta"><span>{ticket.ticket_number}</span><time>{new Date(ticket.updated_at || ticket.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</time><StatusBadge status={ticket.status} /></div>
    </Link>) : <p className="desk-recent-empty">{unavailable ? 'Tickets could not be loaded.' : 'No tickets yet'}</p>}</div>
  </section>;
  return <section className="desk-panel"><header><h2>Recent tickets</h2><Link to="/tickets">View all</Link></header>
    <div className="desk-table-scroll"><AppTable><thead><tr><th>Ticket</th><th>Subject</th><th>Status</th><th>Updated</th></tr></thead>
    <tbody>{recent.length ? recent.map(t => <tr key={t.id}><td><Link to="/tickets">{t.ticket_number}</Link></td><td>{t.subject}</td>
      <td><StatusBadge status={t.status} /></td><td>{new Date(t.updated_at || t.created_at).toLocaleDateString()}</td></tr>)
      : <tr><td colSpan={4} className="desk-empty">{unavailable ? 'Tickets could not be loaded.' : 'No tickets yet'}</td></tr>}</tbody></AppTable></div>
  </section>;
}
export function SystemHealth({ rows, radial = false }: { rows: { label: string; value: number | null }[]; radial?: boolean }) {
  if (radial) {
    const total = rows.find(row => row.label === 'Total users')?.value;
    const active = rows.find(row => row.label === 'Active users')?.value;
    const available = total != null && active != null && total > 0;
    const percentage = available ? Math.min(100, Math.max(0, Math.round(active / total * 100))) : null;
    return <section className="desk-panel desk-radial-health"><header><h2>System health</h2><span>Account activity</span></header>
      <div className="desk-health-ring" role="img" aria-label={percentage === null ? 'Active user ratio unavailable' : `${active} of ${total} users are active (${percentage} percent)`} style={{ background: `conic-gradient(#8151ed 0% ${percentage ?? 0}%, #eee8f8 ${percentage ?? 0}% 100%)` }}><div><strong>{percentage === null ? '—' : `${percentage}%`}</strong><span>Active users</span></div></div>
      <dl className="desk-radial-metrics">{rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value ?? '—'}</dd></div>)}</dl>
    </section>;
  }
  return <section className="desk-panel"><header><h2>System health</h2></header><dl className="desk-health">{rows.map(row =>
    <div key={row.label}><dt>{row.label}</dt><dd>{row.value ?? '?'}</dd></div>)}</dl></section>;
}
