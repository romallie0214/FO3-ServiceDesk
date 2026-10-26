import toast from 'react-hot-toast';
import Pagination from '../components/Pagination';
import { showErrorToast } from '../utils/notifications';
import '../styles/management-ui.css';
import AppTable from '../components/AppTable';
import './AdminManagement.css';
import SummaryCards from '../components/dashboard/SummaryCards';
import { Tickets, UserRoundSearch, Users, Undo2, Plus, SlidersHorizontal, ChevronDown, CircleCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';


interface Ticket {
  id: number;
  ticket_number: string;
  subject: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: string;
  empno: string | null;        // ✅ requestor's empno
  assigned_to: string | null;
  requestor: string;
  created_at: string;
  service_area_id?: number | null;
  service_area_code?: string | null;
  service_area_name?: string | null;
}

interface User {
  id: number;
  empno: string;               // ✅ staff empno
  full_name: string;
  role: string;
  division: string;
  service_role?: string;
}

interface ServiceArea {
  id: number;
  code: string;
  name: string;
  is_active: number;
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, React.CSSProperties> = {
    'Critical': { background: '#FDE8E8', color: '#8B1A1A' },
    'High':     { background: '#FEF3DC', color: '#CC7700' },
    'Medium':   { background: '#E8F1FA', color: '#0D3B6E' },
    'Low':      { background: '#F0F0F0', color: '#666'    },
  };
  return (
    <span style={{
      ...styles[priority] ?? styles['Medium'],
      fontSize: 'var(--text-xs)', padding: '2px 8px',
      borderRadius: 3, fontWeight: 500,
    }}>
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, React.CSSProperties> = {
    'Open':        { background: '#E8F1FA', color: '#0D3B6E' },
    'Assigned':    { background: '#E1F5EE', color: '#085041' },
    'In Progress': { background: '#FEF3DC', color: '#CC7700' },
    'On-Hold':     { background: '#FDF5DC', color: '#854F0B' },
    'Resolved':    { background: '#E8F5EE', color: '#1B6B3A' },
    'Cancelled':   { background: '#FDE8E8', color: '#8B1A1A' },
    'Closed':      { background: '#F0F0F0', color: '#4A4A4A' },
  };
  return (
    <span style={{
      ...styles[status] ?? styles['Open'],
      fontSize: 'var(--text-xs)', padding: '2px 8px',
      borderRadius: 3, fontWeight: 500,
    }}>
      {status}
    </span>
  );
}

export default function AdminManagement() {
  const filtersRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => { if (event.target instanceof Node && filtersRef.current && !filtersRef.current.contains(event.target)) filtersRef.current.open = false; };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);
  const { user: currentUser } = useAuth();
  const isServiceAdmin = currentUser?.role !== 'super_admin' && (currentUser?.area_admin_service_ids?.length ?? 0) > 0;
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [staffByArea, setStaffByArea] = useState<Record<number, User[]>>({});
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [serviceAreaFilter, setServiceAreaFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Record<number, number>>({});
  const [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab] = useState<'unassigned' | 'assigned' | 'workload'>('unassigned');
  const [ticketPage, setTicketPage] = useState(1);
  const [TICKETS_PER_PAGE, setTicketPageSize] = useState(10);

  async function loadManagementData() {
    setLoading(true);
    setLoadError('');

    try {
      const [ticketRes, serviceAreaRes] = await Promise.all([
        api.get(isServiceAdmin ? '/tickets?serviceAdmin=true' : '/tickets'),
        api.get('/service-areas'),
      ]);

      setTickets(ticketRes.data);
      const availableAreas = serviceAreaRes.data.filter((area: ServiceArea) =>
        Boolean(area.is_active) && (!isServiceAdmin || (currentUser?.area_admin_service_ids || []).includes(area.id))
      );
      setServiceAreas(availableAreas);
      const staffResults = await Promise.allSettled(
        availableAreas.map((area: ServiceArea) => api.get('/users/assignable-staff', { params: { service_area_id: area.id } }))
      );
      setStaffByArea(Object.fromEntries(availableAreas.map((area: ServiceArea, index: number) => [
        area.id,
        staffResults[index].status === 'fulfilled' ? staffResults[index].value.data : [],
      ])));
    } catch (err: any) {
      setLoadError(err.response?.data?.error || 'Unable to load Admin Management data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadManagementData();
  }, [isServiceAdmin, currentUser?.id]);

  const visibleTickets = serviceAreaFilter === 'all'
    ? tickets
    : tickets.filter(ticket => String(ticket.service_area_id) === serviceAreaFilter);
  const assignableStaff = Array.from(
    new Map(
      (serviceAreaFilter === 'all'
        ? Object.values(staffByArea).flat()
        : staffByArea[Number(serviceAreaFilter)] || []
      ).map(staff => [staff.id, staff])
    ).values()
  );
  const staffForTicket = (ticket: Ticket) => staffByArea[Number(ticket.service_area_id)] || [];

  // Unassigned — Open tickets with no assigned_to
  const unassigned = visibleTickets.filter(
    t => !t.assigned_to &&
    t.status !== 'Closed' &&
    t.status !== 'Resolved' &&
    t.status !== 'Cancelled'
  );

  // Assigned — tickets that have an assigned staff
  const assigned = visibleTickets.filter(
    t => t.assigned_to &&
    t.status !== 'Closed' &&
    t.status !== 'Resolved' &&
    t.status !== 'Cancelled'
  );

  useEffect(() => {
    setTicketPage(1);
  }, [activeTab, serviceAreaFilter]);

  async function handleAssign(ticketId: number, ticketNumber: string) {
    const userId = assignments[ticketId];
    if (!userId) { showErrorToast('Please select a staff member first.'); return; }

    // ✅ Double-check: prevent assigning to requestor
    const ticket      = tickets.find(t => t.id === ticketId);
    if (!ticket) return;
    const selectedStaff = staffForTicket(ticket).find(u => u.id === userId);
    if (ticket?.empno && selectedStaff?.empno === ticket.empno) {
      showErrorToast('Ticket cannot be assigned to the requestor.');
      return;
    }

    try {
      await api.patch(`/tickets/${ticketId}/assign`, { assigned_to: userId });
      showToast(`${ticketNumber} assigned successfully!`);
      const res = await api.get(isServiceAdmin ? '/tickets?serviceAdmin=true' : '/tickets');
      setTickets(res.data);
      setAssignments(prev => { const n = { ...prev }; delete n[ticketId]; return n; });
    } catch (err: any) {
      showErrorToast(err.response?.data?.error || 'Failed to assign ticket.');
    }
  }


  async function handleReassign(ticketId: number, ticketNumber: string) {
    const userId = assignments[ticketId];
    if (!userId) { showErrorToast('Please select a staff member to reassign to.'); return; }

    // ✅ Double-check: prevent reassigning to requestor
    const ticket        = tickets.find(t => t.id === ticketId);
    if (!ticket) return;
    const selectedStaff = staffForTicket(ticket).find(u => u.id === userId);
    if (ticket?.empno && selectedStaff?.empno === ticket.empno) {
      showErrorToast('Ticket cannot be reassigned to the requestor.');
      return;
    }

    try {
      await api.patch(`/tickets/${ticketId}/assign`, { assigned_to: userId });
      showToast(`${ticketNumber} reassigned successfully!`);
      const res = await api.get(isServiceAdmin ? '/tickets?serviceAdmin=true' : '/tickets');
      setTickets(res.data);
      setAssignments(prev => { const n = { ...prev }; delete n[ticketId]; return n; });
    } catch (err: any) {
      showErrorToast(err.response?.data?.error || 'Failed to reassign ticket.');
    }
  }

  function showToast(msg: string) {
    toast.success(msg, { position: 'top-right' });
  }

  function getInitials(name: string) {
    return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '??';
  }



  if (loading) return (
    <div style={{ color: 'var(--gov-navy)', padding: 20 }}>Loading...</div>
  );

  if (loadError) return (
    <div style={{ padding: 20 }}>
      <div style={{ color: 'var(--gov-red)', marginBottom: 12 }}>{loadError}</div>
      <button
        type="button"
        onClick={() => void loadManagementData()}
        style={{
          padding: '7px 14px', background: 'var(--gov-navy)', color: '#fff',
          border: 'none', borderRadius: 4, cursor: 'pointer',
        }}
      >
        Retry
      </button>
    </div>
  );

  function TicketTable({
    data, isReassign,
  }: { data: Ticket[]; isReassign: boolean }) {
    if (data.length === 0) return (
      <div className="admin-queue-empty" role="status">
        <CircleCheck size={28} strokeWidth={1.5} aria-hidden="true" />
        <strong>{isReassign ? 'No active assigned tickets' : 'All tickets are assigned'}</strong>
        <span>{isReassign ? 'Assigned tickets will appear here when available.' : 'There are no tickets waiting for assignment in this view.'}</span>
      </div>
    );
    const totalPages = Math.max(1, Math.ceil(data.length / TICKETS_PER_PAGE));
    const currentPage = Math.min(ticketPage, totalPages);
    const startIndex = (currentPage - 1) * TICKETS_PER_PAGE;
    const pageTickets = data.slice(startIndex, startIndex + TICKETS_PER_PAGE);

    return (
      <div style={{
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}>
      <AppTable className="admin-ticket-table" style={{
        width: '100%',
        borderCollapse: 'collapse',
        minWidth: '600px',
      }}>
        <thead>
          <tr>
            {['Ticket #', 'Service Area', 'Subject', 'Priority', 'Status',
              isReassign ? 'Assigned To' : '',
              isReassign ? 'Reassign To' : 'Assign To', 'Action',
            ].filter(Boolean).map(h => (
              <th key={h} style={{
                textAlign: 'left', padding: '7px 10px',
                fontSize: 'var(--text-xs)', fontWeight: 500,
                color: '#6A7280',
                borderBottom: '0.5px solid #E5EAF0',
                background: '#F8FAFC',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageTickets.map(t => (
            <tr key={t.id}
              onMouseEnter={e => (e.currentTarget.style.background = '#F5F8FC')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              <td style={{ padding: '7px 10px', fontWeight: 500, color: 'var(--gov-navy)', fontSize: 'var(--text-sm)' }}>
                {t.ticket_number}
              </td>
              <td style={{ padding: '7px 10px', fontSize: 'var(--text-xs)', color: '#52657A', fontWeight: 600 }}>
                {t.service_area_code || 'Unassigned'}
              </td>
              <td style={{ padding: '7px 10px', fontSize: 'var(--text-sm)' }}>
                {t.subject}
              </td>
              <td style={{ padding: '7px 10px' }}>
                <PriorityBadge priority={t.priority} />
              </td>
              <td style={{ padding: '7px 10px' }}>
                <StatusBadge status={t.status} />
              </td>
              {isReassign && (
                <td style={{ padding: '7px 10px', fontSize: 'var(--text-xs)', color: '#5A6475' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: '#E8F1FA', color: 'var(--gov-navy)',
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 8, fontWeight: 600,
                    }}>
                      {getInitials(t.assigned_to ?? '')}
                    </div>
                    {t.assigned_to}
                  </div>
                </td>
              )}
              <td style={{ padding: '7px 10px' }}>
                <select
                  value={assignments[t.id] ?? ''}
                  onChange={e => setAssignments(prev => ({
                    ...prev, [t.id]: Number(e.target.value)
                  }))}
                  style={{
                    fontSize: 'var(--text-xs)', padding: '4px 6px',
                    border: '1px solid #C8D0DC',
                    borderRadius: 3, background: '#fff',
                  }}
                >
                  <option value="">
                    {isReassign ? <><Undo2 size={13} /> Reassign</> : <><Plus size={13} /> Assign</>}
                  </option>
                  {staffForTicket(t)
                    .filter(u => u.empno !== t.empno)
                    .map(u => (
                      <option key={u.id} value={u.id}>{u.full_name}</option>
                    ))
                  }
                </select>
              </td>
              <td style={{ padding: '7px 10px' }}>
                <button
                  onClick={() => isReassign
                    ? handleReassign(t.id, t.ticket_number)
                    : handleAssign(t.id, t.ticket_number)
                  }
                  style={{
                    padding: '4px 10px', fontSize: 'var(--text-xs)',
                    background: isReassign ? '#1A5490' : 'var(--gov-navy)',
                    color: '#fff', border: 'none',
                    borderRadius: 3, cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {isReassign ? '↩ Re-assign' : 'Assign'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </AppTable>
      {data.length > 0 && (
        <Pagination attached page={currentPage} total={data.length} pageSize={TICKETS_PER_PAGE} onPageChange={setTicketPage} onPageSizeChange={setTicketPageSize} />
      )}
      </div>
    );
  }

  return (
    <div className="admin-management-page" style={{ minWidth: 0 }}>
      {/* BREADCRUMB */}
      <div style={{
        fontSize: 'clamp(9px, 1.8vw, 11px)',
        color: '#4A4A4A',
        marginBottom: 14,
      }}>
        Home <span style={{ color: 'var(--gov-navy)', fontWeight: 500 }}>
          / Admin Management
        </span>
      </div>

      <SummaryCards cards={[
        { label: 'Total Tickets', value: visibleTickets.length, color: '#0D3B6E', background: '#E8F1FA', icon: Tickets },
        { label: 'Unassigned', value: unassigned.length, color: '#CC7700', background: '#FEF3DC', icon: UserRoundSearch },
        { label: 'Active Staff', value: assignableStaff.length, color: '#1B6B3A', background: '#E8F5EE', icon: Users },
      ]} />

      <div className="admin-management-columns" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 'clamp(10px, 2vw, 14px)',
        width: '100%',
      }}>

        {/* LEFT — Ticket Queue */}
        <div style={{
          background: '#fff', border: '0.5px solid #D0D9E4',
          borderRadius: 8, overflow: 'hidden',
        }}>
          <div className="admin-queue-tabs" role="group" aria-label="Ticket assignment queue">
            <button aria-pressed={activeTab === 'unassigned'} onClick={() => setActiveTab('unassigned')}><UserRoundSearch size={15} />Unassigned<span>{unassigned.length}</span></button>
            <button aria-pressed={activeTab === 'assigned'} onClick={() => setActiveTab('assigned')}><Undo2 size={15} />Reassign<span>{assigned.length}</span></button>
            <button aria-pressed={activeTab === 'workload'} onClick={() => setActiveTab('workload')}><Users size={15} />Staff Workload<span>{assignableStaff.length}</span></button>
        <details ref={filtersRef} className="sla-filter-dropdown" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}>
          <summary><SlidersHorizontal size={14} />Filters{serviceAreaFilter !== 'all' && <span>1</span>}<ChevronDown size={14} /></summary>
          <div className="sla-filter-menu"><label>Service area<select value={serviceAreaFilter} onChange={event => setServiceAreaFilter(event.target.value)}><option value="all">All service areas</option>{serviceAreas.map(area => <option key={area.id} value={area.id}>{area.code} ? {area.name}</option>)}</select></label><div className="sla-filter-actions"><button onClick={() => setServiceAreaFilter('all')}>Clear filter</button><button onClick={() => { if (filtersRef.current) filtersRef.current.open = false; }}>Done</button></div></div>
        </details>
          </div>

          {/* Table */}
          {activeTab === 'workload' ? <section className="admin-workload-panel" aria-label="Staff workload">
            <div className="admin-workload-heading"><span>Active tickets in the selected service area</span></div>
            {assignableStaff.length === 0 ? <p className="admin-workload-empty">No assignable technical staff found.</p> : <div className="admin-workload-list">{assignableStaff.map(staff => {
              const active = visibleTickets.filter(ticket => ticket.assigned_to === staff.full_name && !['Closed','Resolved','Cancelled'].includes(ticket.status)).length;
              const percent = Math.min(100, active / 6 * 100);
              const color = active >= 5 ? '#b94b4b' : active >= 3 ? '#d18b23' : '#36865c';
              return <div className="admin-workload-row" key={staff.id}><span className="admin-workload-avatar">{getInitials(staff.full_name)}</span><div className="admin-workload-info"><div><strong>{staff.full_name}</strong><span>{active} active {active === 1 ? 'ticket' : 'tickets'}</span></div><div className="admin-workload-track"><div style={{ width: `${percent}%`, background: color }} /></div><small>{staff.division || 'Division not provided'}</small></div></div>;
            })}</div>}
          </section> : (
          <TicketTable
            data={activeTab === 'unassigned' ? unassigned : assigned}
            isReassign={activeTab === 'assigned'}
          />
          )}
        </div>

      </div>


    </div>
  );
}
