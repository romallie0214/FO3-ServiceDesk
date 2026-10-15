import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import TicketDetailModal from '../components/TicketDetailModal';




interface Ticket {
  id: number;
  ticket_number: string;
  subject: string;
  description: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  category: string;
  requestor: string;
  division: string;
  assigned_to: string | null;
  office_location: string | null;
  created_at: string;
  service_area_id?: number | null;
  service_area_code?: string | null;
  service_area_name?: string | null;
}
interface ServiceArea { id: number; code: string; name: string; is_active: number; }

function StatusBadge({ status }: { status: Ticket['status'] }) {
  const styles: Record<string, React.CSSProperties> = {
    'Open':        { background: '#E8F1FA', color: '#0D3B6E' },
    'In Progress': { background: '#FEF3DC', color: '#CC7700' },
    'Resolved':    { background: '#E8F5EE', color: '#1B6B3A' },
    'Closed':      { background: '#F0F0F0', color: '#666'    },
  };
  return (
    <span style={{
      ...styles[status],
      fontSize: 'clamp(8px, 1.5vw, 11px)', padding: 'clamp(1px, 0.3vw, 2px) clamp(6px, 1.2vw, 10px)',
      borderRadius: 3, fontWeight: 500, whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Ticket['priority'] }) {
  const styles: Record<string, React.CSSProperties> = {
    'Critical': { background: '#FDE8E8', color: '#8B1A1A' },
    'High':     { background: '#FEF3DC', color: '#CC7700' },
    'Medium':   { background: '#E8F1FA', color: '#0D3B6E' },
    'Low':      { background: '#F0F0F0', color: '#666'    },
  };
  return (
    <span style={{
      ...styles[priority],
      fontSize: 'clamp(8px, 1.5vw, 11px)', padding: 'clamp(1px, 0.3vw, 2px) clamp(6px, 1.2vw, 10px)',
      borderRadius: 3, fontWeight: 500, whiteSpace: 'nowrap',
    }}>
      {priority}
    </span>
  );
}

export default function TicketList() {
  const { user } = useAuth();
  const isServiceAdmin = user?.role !== 'super_admin' && (user?.area_admin_service_ids?.length ?? 0) > 0;
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [serviceAreaFilter, setServiceAreaFilter] = useState('all');
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    fetchTickets();
    if (user?.role === 'super_admin' || isServiceAdmin) api.get('/service-areas').then(res => setServiceAreas(res.data.filter((area: ServiceArea) => !isServiceAdmin || user?.area_admin_service_ids?.includes(area.id)))).catch(() => setServiceAreas([]));
  }, []);

  useEffect(() => {
    if (isServiceAdmin && user?.area_admin_service_ids?.length) setServiceAreaFilter(String(user.area_admin_service_ids[0]));
  }, [user?.id]);

  async function fetchTickets() {
    try {
      setLoading(true);
      let url = '/tickets';
      if (isServiceAdmin) {
        url = '/tickets?serviceAdmin=true';
      } else if (user?.role === 'dswd_staff') {
        url = `/tickets?empno=${user.empno}&role=dswd_staff`;
      } else if (user?.role === 'ictms_staff') {
        url = `/tickets?empno=${user.empno}&role=ictms_staff`;
      }
      const res = await api.get(url);
      setTickets(res.data);
    } catch (err) {
      console.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }

  const filtered = tickets.filter(t => {
    const matchSearch = !search ||
      t.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      (t.requestor?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !statusFilter || t.status === statusFilter;
    const matchPriority = !priorityFilter || t.priority === priorityFilter;
    const matchService = serviceAreaFilter === 'all' || String(t.service_area_id) === serviceAreaFilter;
    return matchSearch && matchStatus && matchPriority && matchService;
  });

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 'clamp(30px, 8vw, 48px)', color: 'var(--gov-navy)', fontSize: 'clamp(11px, 1.9vw, 14px)' }}>
      Loading tickets...
    </div>
  );

  return (
    <div style={{ padding: 'clamp(14px, 3vw, 24px)' }}>
      {/* BREADCRUMB */}
      <div style={{ fontSize: 'clamp(10px, 1.8vw, 13px)', color: '#4A4A4A', marginBottom: 'clamp(10px, 2vw, 14px)' }}>
        Home <span style={{ color: 'var(--gov-navy)', fontWeight: 500 }}>
          / Ticket List & Tracking
        </span>
      </div>

      {/* Show info strip for DSWD Staff */}
      {user?.role === 'dswd_staff' && !isServiceAdmin && (
        <div style={{
          background: '#E8F1FA', borderLeft: '3px solid var(--gov-navy)',
          borderRadius: '0 4px 4px 0', padding: 'clamp(8px, 2vw, 12px) clamp(10px, 3vw, 16px)',
          fontSize: 'clamp(10px, 1.8vw, 13px)', color: 'var(--gov-navy)', marginBottom: 'clamp(10px, 2vw, 14px)',
        }}>
          Showing only <strong>your submitted tickets</strong>.
          To submit a new request, click <strong>Submit a Ticket</strong> in the nav.
        </div>
      )}

      {/* FILTER BAR */}
      <div style={{
        background: '#fff', border: '0.5px solid #D0D9E4',
        borderRadius: 8, padding: 'clamp(10px, 2vw, 14px)',
        marginBottom: 'clamp(8px, 2vw, 12px)', display: 'flex',
        alignItems: 'center', gap: 'clamp(6px, 1.5vw, 10px)', flexWrap: 'wrap',
      }}>
        <input
          type="text"
          placeholder="Search ticket No., subject, requestor..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 'clamp(140px, 60vw, 240px)', padding: 'clamp(5px, 1.2vw, 8px) clamp(8px, 1.5vw, 12px)',
            fontSize: 'clamp(10px, 1.8vw, 13px)', border: '1px solid #C8D0DC', borderRadius: 4, boxSizing: 'border-box',
          }}
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{
            padding: 'clamp(5px, 1.2vw, 8px) clamp(8px, 1.5vw, 12px)', fontSize: 'clamp(10px, 1.8vw, 13px)',
            border: '1px solid #C8D0DC', borderRadius: 4,
          }}
        >
          <option value="">All Status</option>
          <option>Open</option>
          <option>In Progress</option>
          <option>Resolved</option>
          <option>Closed</option>
        </select>
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
          style={{
            padding: 'clamp(5px, 1.2vw, 8px) clamp(8px, 1.5vw, 12px)', fontSize: 'clamp(10px, 1.8vw, 13px)',
            border: '1px solid #C8D0DC', borderRadius: 4,
          }}
        >
          <option value="">All Priority</option>
          <option>Critical</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
        {(user?.role === 'super_admin' || isServiceAdmin) && <select value={serviceAreaFilter} onChange={e => setServiceAreaFilter(e.target.value)} style={{ padding: 'clamp(5px, 1.2vw, 8px) clamp(8px, 1.5vw, 12px)', fontSize: 'clamp(10px, 1.8vw, 13px)', border: '1px solid #C8D0DC', borderRadius: 4 }}>{!isServiceAdmin && <option value="all">All service areas</option>}{serviceAreas.filter(area => area.is_active).map(area => <option key={area.id} value={area.id}>{area.code} — {area.name}</option>)}</select>}
      </div>

      {/* TICKET COUNT */}
      <div style={{ fontSize: 'clamp(9px, 1.6vw, 12px)', color: '#4A4A4A', marginBottom: 'clamp(6px, 1.5vw, 10px)' }}>
        Showing <strong>{filtered.length}</strong> of{' '}
        <strong>{tickets.length}</strong> tickets
      </div>

      {/* TABLE */}
      <div style={{
        background: '#fff', border: '0.5px solid #D0D9E4',
        borderRadius: 8, overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px' }}>
            <thead>
              <tr>
                {[
                  'Ticket No.', 'Service Area', 'Subject', 'Category', 'Requestor',
                  'Office Location', 'Priority', 'Status', 'Assigned To', 'Date', 'Action'
                ].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: 'clamp(6px, 1.2vw, 10px) clamp(8px, 1.5vw, 12px)',
                    fontSize: 'clamp(9px, 1.6vw, 12px)', fontWeight: 500,
                    color: '#fff', background: 'var(--gov-navy)',
                    whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{
                    textAlign: 'center', padding: 'clamp(20px, 5vw, 32px)', color: '#888', fontSize: 'clamp(11px, 1.9vw, 14px)',
                  }}>
                    No tickets found.
                  </td>
                </tr>
              ) : (
                filtered.map(ticket => (
                  <tr
                    key={ticket.id}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F5F8FC')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    <td style={{
                      padding: 'clamp(6px, 1.2vw, 10px) clamp(8px, 1.5vw, 12px)', fontWeight: 500,
                      color: 'var(--gov-navy)', fontSize: 'clamp(10px, 1.8vw, 13px)',
                    }}>
                      {ticket.ticket_number}
                    </td>
                    <td style={{ padding: 'clamp(6px, 1.2vw, 10px) clamp(8px, 1.5vw, 12px)', fontSize: 'var(--text-xs)', fontWeight: 600, color: '#0D3B6E' }}>{ticket.service_area_code || 'Unassigned'}</td>
                    <td style={{ padding: 'clamp(6px, 1.2vw, 10px) clamp(8px, 1.5vw, 12px)', fontSize: 'clamp(10px, 1.8vw, 13px)' }}>
                      {ticket.subject}
                    </td>
                    <td style={{ padding: 'clamp(6px, 1.2vw, 10px) clamp(8px, 1.5vw, 12px)', fontSize: 'clamp(9px, 1.6vw, 12px)', color: '#5A6475' }}>
                      {ticket.category}
                    </td>
                    <td style={{ padding: 'clamp(6px, 1.2vw, 10px) clamp(8px, 1.5vw, 12px)', fontSize: 'clamp(9px, 1.6vw, 12px)' }}>
                      {ticket.requestor}
                    </td>
                    <td style={{ padding: 'clamp(6px, 1.2vw, 10px) clamp(8px, 1.5vw, 12px)', fontSize: 'clamp(9px, 1.6vw, 12px)', color: '#5A6475', whiteSpace: 'nowrap' }}>
                      {ticket.office_location || '—'}
                    </td>
                    <td style={{ padding: 'clamp(6px, 1.2vw, 10px) clamp(8px, 1.5vw, 12px)' }}>
                      <PriorityBadge priority={ticket.priority} />
                    </td>
                    <td style={{ padding: 'clamp(6px, 1.2vw, 10px) clamp(8px, 1.5vw, 12px)' }}>
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td style={{ padding: 'clamp(6px, 1.2vw, 10px) clamp(8px, 1.5vw, 12px)', fontSize: 'clamp(9px, 1.6vw, 12px)', color: '#5A6475', whiteSpace: 'nowrap' }}>
                      {ticket.assigned_to || '—'}
                    </td>
                    <td style={{ padding: 'clamp(6px, 1.2vw, 10px) clamp(8px, 1.5vw, 12px)', fontSize: 'clamp(9px, 1.6vw, 12px)', color: '#888', whiteSpace: 'nowrap' }}>
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: 'clamp(6px, 1.2vw, 10px) clamp(8px, 1.5vw, 12px)' }}>
                      <button
                        onClick={() => setSelectedTicket(ticket)}
                        style={{
                          padding: 'clamp(4px, 0.8vw, 6px) clamp(8px, 1.5vw, 12px)', fontSize: 'clamp(9px, 1.6vw, 12px)',
                          background: 'var(--gov-navy)', color: '#fff',
                          border: 'none', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TICKET DETAIL MODAL */}
      <TicketDetailModal
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onResolved={() => {
          fetchTickets();
          setSelectedTicket(null);
        }}
      />
    </div>
  );
}
