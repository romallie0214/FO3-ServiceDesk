import { useEffect, useState, type ComponentProps } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import TicketDetailModal from '../components/TicketDetailModal';
import { RecentTickets, TicketTotals } from '../components/dashboard/DashboardPanels';
import TicketCharts from '../components/dashboard/TicketCharts';
import type { DashboardTicket } from '../hooks/useAdminDashboard';
import './SuperAdminDashboard.css';

interface StaffTicket extends DashboardTicket { priority?: string }
interface Area { id: number; code: string; name: string; is_active: number }

export default function IctmsDashboard() {
  const { canAccess } = useAuth();
  const [tickets, setTickets] = useState<StaffTicket[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [opening, setOpening] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<ComponentProps<typeof TicketDetailModal>['ticket']>(null);
  useEffect(() => {
    let active = true;
    Promise.allSettled([api.get('/tickets'), api.get('/service-areas')]).then(([ticketResult, areaResult]) => {
      if (!active) return;
      setFailed(ticketResult.status === 'rejected');
      if (ticketResult.status === 'fulfilled') setTickets(ticketResult.value.data);
      if (areaResult.status === 'fulfilled') setAreas(areaResult.value.data);
      setLoading(false);
    });
    return () => { active = false; };
  }, [revision]);
  async function openTicket(ticket: DashboardTicket) {
    if (opening) return;
    setOpening(true);
    const notification = toast.loading('Loading ticket...');
    try { const response = await api.get(`/tickets/${ticket.id}`); setSelectedTicket(response.data); toast.dismiss(notification); }
    catch { toast.error('Could not open this ticket. Please try again.', { id: notification }); }
    finally { setOpening(false); }
  }
  const visibleAreas = areas.filter(area => area.is_active && tickets.some(ticket => Number(ticket.service_area_id) === area.id));
  const displayed = tickets.filter(ticket => filter === 'all' || String(ticket.service_area_id) === filter);
  const active = displayed.filter(ticket => !['Resolved', 'Closed', 'Cancelled'].includes(ticket.status));
  if (loading) return <p role="status">Loading dashboard...</p>;
  return <div className="desk-dashboard">
    <header className="desk-dashboard-heading"><div><h1>Dashboard</h1><span>Technical staff ticket overview</span></div><div className="desk-dashboard-actions">
      <select aria-label="Filter tickets by service area" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All available service areas</option>{visibleAreas.map(area => <option key={area.id} value={area.id}>{area.code} - {area.name}</option>)}</select>
      {canAccess('submit') && <Link className="desk-primary" to="/submit"><Plus size={14} aria-hidden="true" />Submit a ticket</Link>}
    </div></header>
    {failed && <p className="desk-load-warning" role="alert">Tickets could not be loaded. <button type="button" onClick={() => setRevision(value => value + 1)}>Retry</button></p>}
    <div className="desk-dashboard-reference desk-dashboard-compact">
      <TicketTotals tickets={displayed} unavailable={failed} serviceArea={filter} />
      <div className="desk-dashboard-middle"><RecentTickets tickets={displayed} unavailable={failed} compact onTicketClick={openTicket} /><TicketCharts tickets={displayed} unavailable={failed} /></div>
      <section className="desk-panel"><header><h2>Workload overview</h2></header><dl className="desk-health">
        {[{ label: 'Active tickets', value: active.length }, { label: 'Unassigned tickets', value: active.filter(ticket => !ticket.assigned_to).length }, { label: 'High and critical priority', value: active.filter(ticket => ['High', 'Critical'].includes(ticket.priority || '')).length }, { label: 'Awaiting client feedback', value: displayed.filter(ticket => ticket.status === 'Resolved').length }].map(item => <div key={item.label}><dt>{item.label}</dt><dd>{failed ? 'Unavailable' : item.value}</dd></div>)}
      </dl></section>
    </div>
    <TicketDetailModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} onResolved={() => setRevision(value => value + 1)} />
  </div>;
}
