import Pagination from '../components/Pagination';
import AppTable from '../components/AppTable';
import './TicketList.css';
import './TicketMonitoring.css';
import { Search, SlidersHorizontal, ChevronDown, CircleDot, Flag, CalendarDays } from 'lucide-react';
import SummaryCards from '../components/dashboard/SummaryCards';
import { UserCheck, LoaderCircle, PauseCircle, CircleCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import TicketDetailModal from '../components/TicketDetailModal';


interface Ticket {
  id: number;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  sub_category: string | null;
  requestor: string;
  division: string;
  unit: string | null;
  office_location: string | null;
  created_at: string;
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  'Open':        { bg: '#E8F1FA', color: '#0D3B6E' },
  'Assigned':    { bg: '#FEF3DC', color: '#CC7700' },
  'In Progress': { bg: '#F3F0FF', color: '#5B21B6' },
  'On-Hold':     { bg: '#FDE8E8', color: '#8B1A1A' },
  'Resolved':    { bg: '#E8F5EE', color: '#1B6B3A' },
  'Closed':      { bg: '#F0F0F0', color: '#4A4A4A' },
  'Cancelled':   { bg: '#F5F5F5', color: '#888'    },
};

const PRIORITY_STYLE: Record<string, { bg: string; color: string }> = {
  'Low':      { bg: '#E8F5EE', color: '#1B6B3A' },
  'Medium':   { bg: '#FEF3DC', color: '#CC7700' },
  'High':     { bg: '#FDE8E8', color: '#8B1A1A' },
  'Critical': { bg: '#8B1A1A', color: '#fff'    },
};

function formatDate(str: string) {
  return new Date(str).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function MyTickets() {
  const { user } = useAuth();
  const isServiceAdmin = user?.role !== 'super_admin' && (user?.area_admin_service_ids?.length ?? 0) > 0;
  const [tickets, setTickets]       = useState<Ticket[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showAssignmentNote, setShowAssignmentNote] = useState(true);
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const fetchTickets = () => {
    if (!user?.empno) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    api.get('/tickets', {
      params: { assignedToMe: true, ...(isServiceAdmin ? { serviceAdmin: true } : {}) }
    })
      .then(res => setTickets(res.data))
      .catch(err => {
        console.error('Failed to load assigned tickets:', err);
        setTickets([]);
        setError(err.response?.data?.error || 'Unable to load your assigned tickets. Please try again.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTickets();
  }, [user?.empno, isServiceAdmin]);

  useEffect(() => {
    setPage(1);
  }, [search, filterStatus, filterPriority, dateFrom, dateTo, pageSize]);

  const filtered = tickets.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      t.ticket_number.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      t.requestor?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q);
    const matchStatus   = !filterStatus   || t.status   === filterStatus;
    const matchPriority = !filterPriority || t.priority === filterPriority;
    const filedAt = new Date(t.created_at).getTime();
    const fromAt = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toAt = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    const matchDateFrom = fromAt === null || filedAt >= fromAt;
    const matchDateTo = toAt === null || filedAt <= toAt;
    return matchSearch && matchStatus && matchPriority && matchDateFrom && matchDateTo;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedTickets = filtered.slice(pageStart, pageStart + pageSize);

  // Summary counts
  const assigned   = tickets.filter(t => t.status === 'Assigned').length;
  const inProgress = tickets.filter(t => t.status === 'In Progress').length;
  const onHold     = tickets.filter(t => t.status === 'On-Hold').length;
  const resolved   = tickets.filter(t => t.status === 'Resolved').length;


  return (
    <div>
      {/* BREADCRUMB */}
      <div style={{
        fontSize: 'clamp(9px, 1.8vw, 11px)',
        color: '#4A4A4A',
        marginBottom: 14,
      }}>
        Home <span style={{ color: 'var(--gov-navy)', fontWeight: 500 }}>/ My Tickets</span>
      </div>

      {/* INFO STRIP */}
      {showAssignmentNote && <div className="assignment-note" style={{
        background: '#E8F1FA',
        borderLeft: '3px solid var(--gov-navy)',
        borderRadius: '0 4px 4px 0',
        padding: 'clamp(8px, 2vw, 12px)',
        fontSize: 'clamp(9px, 1.8vw, 12px)',
        color: 'var(--gov-navy)',
        marginBottom: 14,
        lineHeight: 1.5,
      }}>
        <span>Showing all tickets currently assigned to <strong>{user?.full_name}</strong>
        {isServiceAdmin ? ' within your designated service area.' : '.'}</span>
        <button type="button" aria-label="Dismiss assignment note" onClick={() => setShowAssignmentNote(false)}><X size={16} /></button>
      </div>}

      <div>
      <SummaryCards cards={[
        { label: 'Assigned', value: assigned, color: '#CC7700', background: '#FEF3DC', icon: UserCheck },
        { label: 'In Progress', value: inProgress, color: '#5B21B6', background: '#F3EFFF', icon: LoaderCircle },
        { label: 'On-Hold', value: onHold, color: '#B91C1C', background: '#FDE8E8', icon: PauseCircle },
        { label: 'Resolved', value: resolved, color: '#1B6B3A', background: '#E8F5EE', icon: CircleCheck },
      ]} />

      <section className="ticket-monitor-grid assigned-tickets-grid" aria-busy={loading}>
        <div className="ticket-grid-toolbar" data-shimmer-ignore>
          <label className="ticket-grid-search"><Search size={14} /><input aria-label="Search tickets" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} /></label>
          <details className="ticket-filter-dropdown" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}>
            <summary><SlidersHorizontal size={15} />Ticket Filters{[!!filterStatus, !!filterPriority, !!dateFrom, !!dateTo].filter(Boolean).length > 0 && <span className="ticket-filter-count">{[!!filterStatus, !!filterPriority, !!dateFrom, !!dateTo].filter(Boolean).length}</span>}<ChevronDown size={14} /></summary>
            <div className="ticket-filter-popover">
              <div className="ticket-filter-popover-heading">Filter tickets</div>
              <label><span><CircleDot size={14} />Status</span><select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="">All statuses</option>{['Open', 'Assigned', 'On-Hold', 'Cancelled', 'In Progress', 'Resolved', 'Closed'].map(status => <option key={status}>{status}</option>)}</select></label>
              <label><span><Flag size={14} />Priority</span><select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}><option value="">All priorities</option>{['Critical', 'High', 'Medium', 'Low'].map(priority => <option key={priority}>{priority}</option>)}</select></label>
              <div className="ticket-filter-date-heading"><CalendarDays size={14} />Date Added</div>
              <div className="ticket-filter-dates"><label><span>From</span><input type="date" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)} /></label><label><span>To</span><input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} /></label></div>
              <div className="ticket-filter-footer"><button onClick={() => { setFilterStatus(''); setFilterPriority(''); setDateFrom(''); setDateTo(''); }}>Clear filters</button><button onClick={event => { const details = event.currentTarget.closest('details'); if (details) details.open = false; }}>Done</button></div>
            </div>
          </details>
        </div>
      {/* TICKETS TABLE */}
      <div style={{
        background: '#fff',
        border: '0.5px solid #D0D9E4',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        <div style={{
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}>
        <AppTable className="ticket-monitor-table" style={{
          width: '100%',
          borderCollapse: 'collapse',
          minWidth: '1000px',
        }}>
          <thead className={loading ? "monitor-header-loading" : undefined}>
            <tr>
              {['Ticket No.', 'Subject', 'Requestor', 'Division / Unit', 'Office Location', 'Category', 'Priority', 'Status', 'Date Filed'].map(h => (
                <th key={h} style={{
                  textAlign: 'left',
                  padding: 'clamp(6px, 1.5vw, 9px) clamp(8px, 2vw, 14px)',
                  fontSize: 'clamp(8px, 1.5vw, 10px)',
                  fontWeight: 500,
                  color: '#fff',
                  background: 'var(--gov-navy)',
                  whiteSpace: 'nowrap',
                }}>
                  {h}{loading && h === "Date Filed" && <div className="ticket-progress-track monitor-progress-track" role="progressbar" aria-label="Loading assigned tickets"><span /></div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={9} style={{ height: 180 }}><span className="ticket-loading-status" role="status">Loading assigned tickets...</span></td></tr> : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{
                  padding: 'clamp(24px, 5vw, 48px)',
                  textAlign: 'center',
                }}>
                  <div style={{
                    fontSize: 'clamp(24px, 8vw, 32px)',
                    marginBottom: 10,
                  }}>
                    📭
                  </div>
                  <div style={{
                    fontSize: 'clamp(12px, 2vw, 15px)',
                    fontWeight: 600,
                    color: error ? 'var(--gov-red)' : '#333',
                    marginBottom: 6,
                  }}>
                    {error || (tickets.length === 0
                      ? 'No tickets assigned to you yet.'
                      : 'No tickets match your filters.')}
                  </div>
                  {error ? (
                    <button
                      type="button"
                      onClick={fetchTickets}
                      style={{
                        marginTop: 4,
                        padding: '6px 14px',
                        border: 'none',
                        borderRadius: 4,
                        background: 'var(--gov-navy)',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: 'clamp(9px, 1.8vw, 11px)',
                      }}
                    >
                      Retry
                    </button>
                  ) : tickets.length === 0 && (
                    <div style={{
                      fontSize: 'clamp(9px, 1.8vw, 11px)',
                      color: '#888',
                    }}>
                      Tickets assigned to you by a supervisor will appear here.
                    </div>
                  )}
                </td>
              </tr>
            ) : paginatedTickets.map(t => {
              const ss = STATUS_STYLE[t.status]   ?? { bg: '#F0F0F0', color: '#666' };
              const ps = PRIORITY_STYLE[t.priority] ?? { bg: '#F0F0F0', color: '#666' };
              return (
                <tr
                  key={t.id}
                  className="ticket-grid-clickable" onClick={() => setSelectedTicket(t)}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F5F8FC')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                >
                  {/* Ticket No */}
                  <td style={{
                    padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 14px)',
                    whiteSpace: 'nowrap',
                  }}><div className="ticket-skeleton-cell" data-shimmer-no-children>
                    <button className="ticket-grid-id" aria-label={`View ticket ${t.ticket_number}`} style={{
                      fontSize: 'clamp(8px, 1.5vw, 10px)',
                      fontWeight: 600,
                      color: 'var(--gov-navy)',
                    }}>
                      {t.ticket_number}
                    </button>
                  </div></td>

                  {/* Subject */}
                  <td style={{
                    padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 14px)',
                    maxWidth: 240,
                  }}><div className="ticket-skeleton-cell" data-shimmer-no-children>
                    <div style={{
                      fontSize: 'clamp(10px, 1.8vw, 12px)',
                      fontWeight: 500,
                      color: '#1A2A3A',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {t.subject}
                    </div>
                  </div></td>

                  {/* Requestor */}
                  <td style={{
                    padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 14px)',
                  }}><div className="ticket-skeleton-cell" data-shimmer-no-children>
                    <div style={{
                      fontSize: 'clamp(8px, 1.5vw, 10px)',
                      color: '#2A2A2A',
                      fontWeight: 500,
                    }}>
                      {t.requestor || '—'}
                    </div>
                  </div></td>

                  {/* Division / Unit */}
                  <td style={{
                    padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 14px)',
                  }}><div className="ticket-skeleton-cell" data-shimmer-no-children>
                    <div style={{
                      fontSize: 'clamp(8px, 1.5vw, 10px)',
                      color: '#2A2A2A',
                    }}>
                      {t.division || '—'}
                    </div>
                    {t.unit && (
                      <div style={{
                        fontSize: 'clamp(8px, 1.5vw, 10px)',
                        color: '#888',
                        marginTop: 2,
                      }}>
                        {t.unit}
                      </div>
                    )}
                  </div></td>

                  {/* Office Location */}
                  <td style={{
                    padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 14px)',
                    whiteSpace: 'nowrap',
                  }}><div className="ticket-skeleton-cell" data-shimmer-no-children>
                    <div style={{
                      fontSize: 'clamp(8px, 1.5vw, 10px)',
                      color: '#5A6475',
                    }}>
                      {t.office_location || '—'}
                    </div>
                  </div></td>

                  {/* Category */}
                  <td style={{
                    padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 14px)',
                  }}><div className="ticket-skeleton-cell" data-shimmer-no-children>
                    <div style={{
                      fontSize: 'clamp(8px, 1.5vw, 10px)',
                      color: '#2A2A2A',
                    }}>
                      {t.category || '—'}
                    </div>
                    {t.sub_category && (
                      <div style={{
                        fontSize: 'clamp(8px, 1.5vw, 10px)',
                        color: '#888',
                        marginTop: 2,
                      }}>
                        {t.sub_category}
                      </div>
                    )}
                  </div></td>

                  {/* Priority */}
                  <td style={{
                    padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 14px)',
                    whiteSpace: 'nowrap',
                  }}><div className="ticket-skeleton-cell" data-shimmer-no-children>
                    <span data-priority={t.priority} style={{
                      background: ps.bg,
                      color: ps.color,
                      fontSize: 'clamp(7px, 1.2vw, 9px)',
                      fontWeight: 600,
                      padding: '2px clamp(4px, 1vw, 8px)',
                      borderRadius: 3,
                    }}>
                      {t.priority}
                    </span>
                  </div></td>

                  {/* Status */}
                  <td style={{
                    padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 14px)',
                    whiteSpace: 'nowrap',
                  }}><div className="ticket-skeleton-cell" data-shimmer-no-children>
                    <span style={{
                      background: ss.bg,
                      color: ss.color,
                      fontSize: 'clamp(7px, 1.2vw, 9px)',
                      fontWeight: 500,
                      padding: '2px clamp(4px, 1vw, 8px)',
                      borderRadius: 3,
                    }}>
                      {t.status}
                    </span>
                  </div></td>

                  {/* Date */}
                  <td style={{
                    padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 14px)',
                    fontSize: 'clamp(8px, 1.5vw, 10px)',
                    color: '#6A7280',
                    whiteSpace: 'nowrap',
                  }}><div className="ticket-skeleton-cell" data-shimmer-no-children>
                    {formatDate(t.created_at)}
                  </div></td>


                </tr>
              );
            })}
          </tbody>
        </AppTable>
        </div>
{!loading && filtered.length > 0 && (
        <div data-shimmer-ignore><Pagination attached page={currentPage} total={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} /></div>
      )}

      </div>
      </section></div>

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
