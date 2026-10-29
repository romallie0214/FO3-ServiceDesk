import DashboardLoading, { dashboardTemplateTickets } from '../components/dashboard/DashboardLoading';
import TicketDetailModal from '../components/TicketDetailModal';
import { api } from '../services/api';
import toast from 'react-hot-toast';
import type { ComponentProps } from 'react';
import type { DashboardTicket } from '../hooks/useAdminDashboard';
import TicketCharts from '../components/dashboard/TicketCharts';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAdminDashboard } from '../hooks/useAdminDashboard';
import { RecentTickets, SystemHealth, TicketTotals } from '../components/dashboard/DashboardPanels';
import './SuperAdminDashboard.css';

export default function SuperAdminDashboard() {
  const { user, canAccess } = useAuth();
  const { tickets, users, serviceAreas, csmCount, kbCount, loading, failed, refresh } = useAdminDashboard();
  const [filter, setFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState<ComponentProps<typeof TicketDetailModal>['ticket']>(null);
  const [openingTicket, setOpeningTicket] = useState(false);
  async function openRecentTicket(ticket: DashboardTicket) {
    if (openingTicket) return;
    setOpeningTicket(true);
    const notification = toast.loading('Loading ticket...');
    try {
      const response = await api.get(`/tickets/${ticket.id}`);
      setSelectedTicket(response.data);
      toast.dismiss(notification);
    } catch {
      toast.error('Could not open this ticket. Please try again.', { id: notification });
    } finally { setOpeningTicket(false); }
  }
  const isAreaAdmin = user?.role !== 'super_admin';
  const managedIds = user?.area_admin_service_ids || [];
  const areas = serviceAreas.filter(a => a.is_active && (!isAreaAdmin || managedIds.includes(a.id)));
  const scoped = tickets.filter(t => !isAreaAdmin || managedIds.includes(Number(t.service_area_id)));
  const displayed = loading ? dashboardTemplateTickets : scoped.filter(t => filter === 'all' || String(t.service_area_id) === filter);
  const ticketsUnavailable = failed.includes('/tickets');
  const usersUnavailable = failed.includes('/users');
  const unassigned = displayed.filter(t => !t.assigned_to && !['Closed', 'Resolved', 'Cancelled'].includes(t.status)).length;
  return <DashboardLoading loading={loading}><div className="desk-dashboard">
    <header className="desk-dashboard-heading"><div><h1>Dashboard</h1><span>{filter !== 'all' ? 'Selected service-area ticket totals' : isAreaAdmin ? 'Your service-area ticket totals' : 'FO3-wide ticket totals'}</span></div>
      <div className="desk-dashboard-actions"><select aria-label="Filter tickets by service area" value={filter} onChange={e => setFilter(e.target.value)}>
        <option value="all">{isAreaAdmin ? 'All assigned areas' : 'All service areas'}</option>{areas.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select>
        {canAccess('submit') && <Link className="desk-primary" to="/submit"><Plus size={14} aria-hidden="true" /> Submit a ticket</Link>}
      </div></header>
    {failed.length > 0 && <p className="desk-load-warning" role="alert">Some dashboard data could not be loaded. Unavailable totals are shown as ?. Reload to try again.</p>}
    <div className="desk-dashboard-reference desk-dashboard-compact">
      <TicketTotals tickets={displayed} unavailable={ticketsUnavailable} serviceArea={filter} />
      <div className="desk-dashboard-middle"><RecentTickets tickets={displayed} unavailable={ticketsUnavailable} compact onTicketClick={openRecentTicket} /><TicketCharts tickets={displayed} unavailable={ticketsUnavailable} /></div>
      <div className="desk-dashboard-health-row">
      <SystemHealth radial rows={[
        { label: 'Total users', value: usersUnavailable ? null : users.length },
        { label: 'Active users', value: usersUnavailable ? null : users.filter(user => !user.deleted_at).length },
        { label: 'Unassigned tickets', value: ticketsUnavailable ? null : unassigned },
        { label: 'CSM responses', value: csmCount }, { label: 'KB articles', value: kbCount },
      ]} /></div>
    </div>
    <TicketDetailModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} onResolved={refresh} />
  </div></DashboardLoading>;
}
