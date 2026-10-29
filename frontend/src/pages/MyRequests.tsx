import Pagination from '../components/Pagination';
import AppTable from '../components/AppTable';
import './TicketList.css';
import './TicketMonitoring.css';
import { Search, SlidersHorizontal, ChevronDown, CircleDot, Layers, CalendarDays } from 'lucide-react';
import SummaryCards from '../components/dashboard/SummaryCards';
import { Inbox, LoaderCircle, CircleCheck, Archive } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import TicketDetailModal from '../components/TicketDetailModal';


interface Ticket {
  id: number;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  sub_category: string | null;
  sub_item: string | null;
  assigned_to: string | null;
  created_at: string;
  cancel_reason: string | null;
  division:      string | null;
  unit:          string | null;
  office_location: string | null;
  service_area_id: number | null;
  service_area_code: string | null;
  service_area_name: string | null;
}

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

export default function MyRequests() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [tickets, setTickets]           = useState<Ticket[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterService, setFilterService] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'service' | 'newest'>('service');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    if (!user?.empno) { setLoading(false); return; }
    setLoading(true);
    api.get('/tickets', {
      params: {
        empno: user.empno,
        onlyMine: true
      }
      })
      .then(res => setTickets(res.data))
      .catch(() => setTickets([]))
      .finally(() => {
        setLoading(false);
      });
  }, [user?.empno]);

  // A changed filter should always return the user to the first result page.
  useEffect(() => {
    setPage(1);
  }, [search, filterStatus, filterService, dateFrom, dateTo, sortBy, pageSize]);

  const serviceAreas = Array.from(new Map(
    tickets
      .filter(t => t.service_area_id && t.service_area_name)
      .map(t => [t.service_area_id, { id: t.service_area_id!, label: `${t.service_area_code || 'SERVICE'} — ${t.service_area_name}` }])
  ).values()).sort((a, b) => a.label.localeCompare(b.label));

  const filtered = tickets.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      t.ticket_number.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q);
    const matchStatus = !filterStatus || t.status === filterStatus;
    const matchService = !filterService || String(t.service_area_id) === filterService;
    const filedAt = new Date(t.created_at).getTime();
    const fromAt = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toAt = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    const matchDateFrom = fromAt === null || filedAt >= fromAt;
    const matchDateTo = toAt === null || filedAt <= toAt;
    return matchSearch && matchStatus && matchService && matchDateFrom && matchDateTo;
  }).sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    const serviceCompare = (a.service_area_name || 'Unassigned service').localeCompare(b.service_area_name || 'Unassigned service');
    return serviceCompare || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedTickets = filtered.slice(pageStart, pageStart + pageSize);

  // Summary counts
  const open      = tickets.filter(t => t.status === 'Open').length;
  const inProg    = tickets.filter(t => ['Assigned', 'In Progress'].includes(t.status)).length;
  const resolved  = tickets.filter(t => t.status === 'Resolved').length;
  const closed    = tickets.filter(t => t.status === 'Closed').length;


  return (
    <div>
      {/* BREADCRUMB */}
      <div style={{ fontSize: 'clamp(10px, 1.8vw, 13px)', color: '#4A4A4A', marginBottom: 'clamp(10px, 2vw, 14px)' }}>
        Home <span style={{ color: 'var(--gov-navy)', fontWeight: 500 }}>/ My Requests</span>
      </div>

      {/* INFO STRIP */}
      <div style={{
        background: '#E8F1FA', borderLeft: '3px solid var(--gov-navy)',
        borderRadius: '0 4px 4px 0', padding: 'clamp(8px, 2vw, 12px) clamp(10px, 3vw, 16px)',
        fontSize: 'clamp(10px, 1.8vw, 13px)', color: 'var(--gov-navy)', marginBottom: 'clamp(10px, 2vw, 14px)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 'clamp(8px, 2vw, 12px)',
      }}>
        <span>
          Tickets you submitted as a requestor. Track the status of your IT support requests here.
        </span>
        <button
          onClick={() => navigate('/submit')}
          style={{
            padding: 'clamp(5px, 1.2vw, 8px) clamp(10px, 2vw, 16px)', fontSize: 'clamp(10px, 1.8vw, 13px)',
            background: 'var(--gov-green)', color: '#fff',
            border: 'none', borderRadius: 4,
            cursor: 'pointer', fontWeight: 500,
            whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          + Submit New Ticket
        </button>
      </div>

      <div>
      <SummaryCards cards={[
        { label: 'Open', value: open, color: '#0D3B6E', background: '#E8F1FA', icon: Inbox },
        { label: 'In Progress', value: inProg, color: '#5B21B6', background: '#F3EFFF', icon: LoaderCircle },
        { label: 'Resolved', value: resolved, color: '#1B6B3A', background: '#E8F5EE', icon: CircleCheck },
        { label: 'Closed', value: closed, color: '#4A4A4A', background: '#F0F0F0', icon: Archive },
      ]} />

      <section className="ticket-monitor-grid submitted-tickets-grid" aria-busy={loading}>
        <div className="ticket-grid-toolbar" data-shimmer-ignore>
          <label className="ticket-grid-search"><Search size={14} /><input aria-label="Search tickets" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} /></label>
          <details className="ticket-filter-dropdown" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}>
            <summary><SlidersHorizontal size={15} />Ticket Filters{[!!filterService, !!filterStatus, !!dateFrom, !!dateTo].filter(Boolean).length > 0 && <span className="ticket-filter-count">{[!!filterService, !!filterStatus, !!dateFrom, !!dateTo].filter(Boolean).length}</span>}<ChevronDown size={14} /></summary>
            <div className="ticket-filter-popover">
              <div className="ticket-filter-popover-heading">Filter tickets</div>
              <label><span><CircleDot size={14} />Status</span><select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="">All statuses</option>{['Open', 'Assigned', 'On-Hold', 'Cancelled', 'In Progress', 'Resolved', 'Closed'].map(status => <option key={status}>{status}</option>)}</select></label>
              <label><span><Layers size={14} />Service</span><select value={filterService} onChange={e => setFilterService(e.target.value)}><option value="">All services</option>{serviceAreas.map(area => <option key={area.id} value={area.id}>{area.label}</option>)}</select></label>
              <label><span>Sort by</span><select value={sortBy} onChange={e => setSortBy(e.target.value as 'service' | 'newest')}><option value="service">Service, newest first</option><option value="newest">Newest first</option></select></label>
              <div className="ticket-filter-date-heading"><CalendarDays size={14} />Date Added</div>
              <div className="ticket-filter-dates"><label><span>From</span><input type="date" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)} /></label><label><span>To</span><input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} /></label></div>
              <div className="ticket-filter-footer"><button onClick={() => { setFilterStatus(''); setFilterService(''); setSortBy('service'); setDateFrom(''); setDateTo(''); }}>Clear filters</button><button onClick={event => { const details = event.currentTarget.closest('details'); if (details) details.open = false; }}>Done</button></div>
            </div>
          </details>
        </div>
      {/* TICKETS TABLE WRAPPER */}
      <div style={{
        background: '#fff', border: '0.5px solid #D0D9E4',
        borderRadius: 8, overflow: 'hidden',
      }}>
        <div style={{
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}>
          <AppTable className="ticket-monitor-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead className={loading ? "monitor-header-loading" : undefined}>
              <tr>
                {['Ticket No.', 'Service', 'Subject', 'Category', 'Division / Unit', 'Office Location', 'Priority', 'Assigned To', 'Status', 'Date Filed'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: 'clamp(7px, 1.5vw, 12px) clamp(10px, 2vw, 16px)',
                    fontSize: 'clamp(9px, 1.6vw, 12px)', fontWeight: 500,
                    color: '#fff', background: 'var(--gov-navy)',
                    whiteSpace: 'nowrap',
                  }}>
                    {h}{loading && h === "Date Filed" && <div className="ticket-progress-track monitor-progress-track" role="progressbar" aria-label="Loading submitted tickets"><span /></div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={10} style={{ height: 180 }}><span className="ticket-loading-status" role="status">Loading submitted tickets...</span></td></tr> : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: 'clamp(30px, 8vw, 48px)', textAlign: 'center' }}>
                    <div style={{ fontSize: 'clamp(24px, 6vw, 32px)', marginBottom: 'clamp(8px, 2vw, 12px)' }}>📭</div>
                    <div style={{ fontSize: 'clamp(14px, 2.5vw, 18px)', fontWeight: 600, color: '#333', marginBottom: 'clamp(4px, 1vw, 8px)' }}>
                      {tickets.length === 0
                        ? 'You have not submitted any tickets yet.'
                        : 'No tickets match your filters.'}
                    </div>
                    {tickets.length === 0 && (
                      <button
                        onClick={() => navigate('/submit')}
                        style={{
                          marginTop: 'clamp(6px, 1.5vw, 10px)', padding: 'clamp(6px, 1.2vw, 9px) clamp(14px, 3vw, 20px)', fontSize: 'clamp(11px, 1.9vw, 14px)',
                          background: 'var(--gov-navy)', color: '#fff',
                          border: 'none', borderRadius: 4, cursor: 'pointer',
                        }}
                      >
                        Submit your first ticket
                      </button>
                    )}
                  </td>
                </tr>
              ) : paginatedTickets.map(t => {
                const ss = STATUS_STYLE[t.status]     ?? { bg: '#F0F0F0', color: '#666' };
                const ps = PRIORITY_STYLE[t.priority] ?? { bg: '#F0F0F0', color: '#666' };
                const isResolved = t.status === 'Resolved';
                return (
                  <tr
                    key={t.id}
                    className="ticket-grid-clickable" onClick={() => setSelectedTicket(t)}
                    style={{ borderLeft: isResolved ? '3px solid var(--gov-amber)' : '3px solid transparent' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F5F8FC')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    {/* Ticket No */}
                    <td style={{ padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', whiteSpace: 'nowrap' }}><div className="ticket-skeleton-cell" data-shimmer-no-children>
                      <button className="ticket-grid-id" aria-label={`View ticket ${t.ticket_number}`} style={{ fontSize: 'clamp(9px, 1.6vw, 12px)', fontWeight: 600, color: 'var(--gov-navy)' }}>
                        {t.ticket_number}
                      </button>
                    </div></td>

                    {/* Service Area */}
                    <td style={{ padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', whiteSpace: 'nowrap' }}><div className="ticket-skeleton-cell" data-shimmer-no-children>
                      <div style={{ fontSize: 'clamp(9px, 1.6vw, 12px)', color: '#0D3B6E', fontWeight: 600 }}>
                        {t.service_area_code || 'Unassigned'}
                      </div>

                      {t.service_area_name && (
                        <div style={{ fontSize: 'clamp(8px, 1.5vw, 11px)', color: '#6A7280', marginTop: 2, maxWidth: 170, whiteSpace: 'normal' }}>{t.service_area_name}</div>
                      )}
                    </div></td>

                    {/* Subject */}
                    <td style={{ padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', maxWidth: 'clamp(180px, 20vw, 300px)' }}><div className="ticket-skeleton-cell" data-shimmer-no-children>
                      <div style={{
                        fontSize: 'clamp(10px, 1.8vw, 13px)', fontWeight: 500, color: '#1A2A3A',
                        overflow: 'hidden', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      }}>
                        {t.subject}
                      </div>
                      {isResolved && (
                        <div style={{ fontSize: 'clamp(8px, 1.5vw, 11px)', color: 'var(--gov-amber)', marginTop: 'clamp(2px, 0.5vw, 4px)', fontWeight: 500 }}>
                          ⚠ Please fill the CSMF to close this ticket
                        </div>
                      )}
                      {t.status === 'Cancelled' && t.cancel_reason && (
                        <div style={{ fontSize: 'clamp(8px, 1.5vw, 11px)', color: '#888', marginTop: 'clamp(2px, 0.5vw, 4px)' }}>
                          Reason: {t.cancel_reason}
                        </div>
                      )}
                    </div></td>

                    {/* Category */}
                    <td style={{ padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)' }}><div className="ticket-skeleton-cell" data-shimmer-no-children>
                      <div style={{ fontSize: 'clamp(9px, 1.6vw, 12px)', color: '#2A2A2A' }}>{t.category || '—'}</div>
                      {t.sub_category && <div style={{ fontSize: 'clamp(8px, 1.5vw, 11px)', color: '#888', marginTop: 'clamp(1px, 0.5vw, 3px)' }}>{t.sub_category}</div>}
                      {t.sub_item && <div style={{ fontSize: 'clamp(8px, 1.5vw, 11px)', color: '#aaa', marginTop: 'clamp(1px, 0.5vw, 2px)' }}>{t.sub_item}</div>}
                    </div></td>
                    {/* Division / Unit */}
                    <td style={{ padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)' }}><div className="ticket-skeleton-cell" data-shimmer-no-children>
                      <div style={{ fontSize: 'clamp(9px, 1.6vw, 12px)', color: '#2A2A2A', fontWeight: 500 }}>{t.division || '—'}</div>
                      {t.unit && <div style={{ fontSize: 'clamp(8px, 1.5vw, 11px)', color: '#888', marginTop: 'clamp(1px, 0.5vw, 3px)' }}>{t.unit}</div>}
                    </div></td>
                    {/* Office Location */}
                    <td style={{ padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', whiteSpace: 'nowrap' }}><div className="ticket-skeleton-cell" data-shimmer-no-children>
                      {t.office_location ? <span className="submitted-office-location" title={t.office_location} style={{ fontSize: 'clamp(8px, 1.5vw, 11px)', padding: 'clamp(1px, 0.5vw, 3px) clamp(6px, 1.5vw, 10px)', background: '#E8F1FA', color: '#0D3B6E', borderRadius: 3, fontWeight: 500 }}>{t.office_location}</span> : <span style={{ color: '#bbb', fontStyle: 'italic', fontSize: 'clamp(8px, 1.5vw, 11px)' }}>—</span>}
                    </div></td>

                    {/* Priority */}
                    <td style={{ padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', whiteSpace: 'nowrap' }}><div className="ticket-skeleton-cell" data-shimmer-no-children>
                      <span data-priority={t.priority} style={{
                        background: ps.bg, color: ps.color,
                        fontSize: 'clamp(8px, 1.5vw, 11px)', fontWeight: 600,
                        padding: 'clamp(1px, 0.5vw, 3px) clamp(6px, 1.5vw, 10px)', borderRadius: 3,
                      }}>
                        {t.priority}
                      </span>
                    </div></td>

                    {/* Assigned To */}
                    <td style={{ padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', fontSize: 'clamp(9px, 1.6vw, 12px)', color: '#5A6475', whiteSpace: 'nowrap' }}><div className="ticket-skeleton-cell" data-shimmer-no-children>
                      {t.assigned_to || (
                        <span style={{ color: '#bbb', fontStyle: 'italic' }}>Unassigned</span>
                      )}
                    </div></td>

                    {/* Status */}
                    <td style={{ padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', whiteSpace: 'nowrap' }}><div className="ticket-skeleton-cell" data-shimmer-no-children>
                      <span style={{
                        background: ss.bg, color: ss.color,
                        fontSize: 'clamp(8px, 1.5vw, 11px)', fontWeight: 500,
                        padding: 'clamp(1px, 0.5vw, 3px) clamp(6px, 1.5vw, 10px)', borderRadius: 3,
                      }}>
                        {t.status}
                      </span>
                    </div></td>

                    {/* Date */}
                    <td style={{ padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', fontSize: 'clamp(8px, 1.5vw, 11px)', color: '#6A7280', whiteSpace: 'nowrap' }}><div className="ticket-skeleton-cell" data-shimmer-no-children>
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
        forceRequestorView={true}
        onClose={() => setSelectedTicket(null)}
        onResolved={() => {
          setSelectedTicket(null);
        }}
      />
    </div>
  );
}
