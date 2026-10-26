import ticketBannerImage from '../assets/banner.png';
import Pagination from '../components/Pagination';
import AppTable from '../components/AppTable';
import { Link, useSearchParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import './TicketList.css';
import { Search, SlidersHorizontal, CalendarDays, Flag, CircleDot, ChevronDown, Layers, Ticket as TicketIcon, X, ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import TicketDetailModal from '../components/TicketDetailModal';




interface Ticket {
  id: number;
  ticket_number: string;
  subject: string;
  description: string;
  status: string;
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

function PriorityBadge({ priority }: { priority: Ticket['priority'] }) {
  const styles: Record<string, React.CSSProperties> = {
    'Critical': { background: '#FDE8E8', color: '#8B1A1A' },
    'High':     { background: '#FEF3DC', color: '#CC7700' },
    'Medium':   { background: '#E8F1FA', color: '#0D3B6E' },
    'Low':      { background: '#F0F0F0', color: '#666'    },
  };
  return (
    <span data-priority={priority} style={{
      ...styles[priority],
      fontSize: 'clamp(8px, 1.5vw, 11px)', padding: 'clamp(1px, 0.3vw, 2px) clamp(6px, 1.2vw, 10px)',
      borderRadius: 3, fontWeight: 500, whiteSpace: 'nowrap',
    }}>
      {priority}
    </span>
  );
}

export default function TicketList() {
  const { user, canAccess } = useAuth();
  const [searchParams] = useSearchParams();
  const isServiceAdmin = user?.role !== 'super_admin' && (user?.area_admin_service_ids?.length ?? 0) > 0;
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [serviceAreaFilter, setServiceAreaFilter] = useState(searchParams.get('service_area') || 'all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showTicketBanner, setShowTicketBanner] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    fetchTickets();
    if (user?.role === 'super_admin' || isServiceAdmin) api.get('/service-areas').then(res => setServiceAreas(res.data.filter((area: ServiceArea) => !isServiceAdmin || user?.area_admin_service_ids?.includes(area.id)))).catch(() => setServiceAreas([]));
  }, []);

  useEffect(() => {
    if (isServiceAdmin && user?.area_admin_service_ids?.length && !searchParams.has('service_area')) setServiceAreaFilter(String(user.area_admin_service_ids[0]));
  }, [user?.id]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, priorityFilter, serviceAreaFilter, dateFrom, dateTo, pageSize]);

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
    const filedAt = new Date(t.created_at).getTime();
    const fromAt = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toAt = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    const matchDateFrom = fromAt === null || filedAt >= fromAt;
    const matchDateTo = toAt === null || filedAt <= toAt;
    return matchSearch && matchStatus && matchPriority && matchService && matchDateFrom && matchDateTo;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedTickets = filtered.slice(pageStart, pageStart + pageSize);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 'clamp(30px, 8vw, 48px)', color: 'var(--gov-navy)', fontSize: 'clamp(11px, 1.9vw, 14px)' }}>
      Loading tickets...
    </div>
  );

  return (
    <div className="ticket-list-preview">
      {/* BREADCRUMB */}
      <div style={{ fontSize: 'clamp(10px, 1.8vw, 13px)', color: '#4A4A4A', marginBottom: 'clamp(10px, 2vw, 14px)' }}>
        Home <span style={{ color: 'var(--gov-navy)', fontWeight: 500 }}>
          / Ticket List & Tracking
        </span>
      </div>

      {showTicketBanner && <aside className="ticket-benefits-banner" aria-label="Why submit a ticket">
        <div className="ticket-benefits-copy">
          <span className="ticket-benefits-eyebrow">WHY SUBMIT A TICKET?</span>
          <h2>A ticket makes sure your concern is never lost.</h2>
          <p>Every ticket is recorded, assigned to the right team, and tracked until it’s resolved. Emails and verbal requests get missed. A ticket gives you proof of your request, a reference number, and updates you can follow.</p>
          {canAccess('submit') && <Link to="/submit" className="ticket-benefits-action">Submit a ticket <ArrowRight size={15} aria-hidden="true" /></Link>}
        </div>
        <div className="ticket-benefits-art" aria-hidden="true">
          <img className="ticket-benefits-illustration" src={ticketBannerImage} alt="" />
        </div>
        <button type="button" className="ticket-benefits-close" aria-label="Dismiss ticket information" onClick={() => setShowTicketBanner(false)}><X size={17} /></button>
      </aside>}

      <section className="ticket-grid" aria-label="Tickets">
        <div className="ticket-grid-toolbar">
          <label className="ticket-grid-search"><Search size={14} /><input aria-label="Search tickets" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} /></label>
          <details className="ticket-filter-dropdown" open={showFilters} onToggle={event => setShowFilters(event.currentTarget.open)} onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}>
            <summary><SlidersHorizontal size={15} />Ticket Filters{[!!statusFilter, !!priorityFilter, serviceAreaFilter !== 'all', !!dateFrom, !!dateTo].filter(Boolean).length > 0 && <span className="ticket-filter-count">{[!!statusFilter, !!priorityFilter, serviceAreaFilter !== 'all', !!dateFrom, !!dateTo].filter(Boolean).length}</span>}<ChevronDown size={14} /></summary>
            <div className="ticket-filter-popover">
              <div className="ticket-filter-popover-heading">Filter tickets</div>
              <label><span><CircleDot size={14} />Status</span><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">All statuses</option>{['Open', 'Assigned', 'On-Hold', 'Cancelled', 'In Progress', 'Resolved', 'Closed'].map(status => <option key={status}>{status}</option>)}</select></label>
              <label><span><Flag size={14} />Priority</span><select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}><option value="">All priorities</option>{['Critical', 'High', 'Medium', 'Low'].map(priority => <option key={priority}>{priority}</option>)}</select></label>
              {(user?.role === 'super_admin' || isServiceAdmin) && <label><span><Layers size={14} />Service Area</span><select value={serviceAreaFilter} onChange={e => setServiceAreaFilter(e.target.value)}>{!isServiceAdmin && <option value="all">All service areas</option>}{serviceAreas.filter(area => area.is_active).map(area => <option key={area.id} value={area.id}>{area.code}</option>)}</select></label>}
              <div className="ticket-filter-date-heading"><CalendarDays size={14} />Date Added</div>
              <div className="ticket-filter-dates"><label><span>From</span><input type="date" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)} /></label><label><span>To</span><input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} /></label></div>
              <div className="ticket-filter-footer"><button onClick={() => { setStatusFilter(''); setPriorityFilter(''); setDateFrom(''); setDateTo(''); setServiceAreaFilter(isServiceAdmin && user?.area_admin_service_ids?.length ? String(user.area_admin_service_ids[0]) : 'all'); }}>Clear filters</button><button onClick={() => setShowFilters(false)}>Done</button></div>
            </div>
          </details>
        </div>
        <div className="ticket-grid-scroll">
          <AppTable aria-label="Ticket List and Tracking">
            <thead><tr>
              <th>Ticket ID</th><th>Subject</th><th>Priority</th><th>Category</th><th>Requestor</th><th>Status</th><th>Request Date</th>
            </tr></thead>
            <tbody>{paginatedTickets.length === 0 ? <tr><td colSpan={7} className="ticket-grid-empty"><div className="ticket-empty-state">
              <span className="ticket-empty-icon"><TicketIcon size={28} strokeWidth={1.5} aria-hidden="true" /></span>
              <strong>{tickets.length === 0 ? 'No tickets yet' : 'No tickets found'}</strong>
              <p>{tickets.length === 0 ? 'Submit a ticket to get help from the service team.' : 'Try adjusting your search or filters.'}</p>

            </div></td></tr> : paginatedTickets.map(ticket => <tr key={ticket.id} className="ticket-grid-clickable" onClick={() => setSelectedTicket(ticket)}>
              <td><button className="ticket-grid-id" aria-label={`View ticket ${ticket.ticket_number}`}>{ticket.ticket_number}</button></td>
              <td className="ticket-grid-subject" title={ticket.subject}>{ticket.subject}</td>
              <td><PriorityBadge priority={ticket.priority} /></td>
              <td><span className="ticket-grid-category" title={ticket.category}><Layers size={12} />{ticket.category || 'Uncategorized'}</span></td>
              <td><span className="ticket-grid-person"><span className="ticket-grid-avatar" aria-hidden="true">{(ticket.requestor || '?').split(/\s+/).map(part => part[0]).slice(0, 2).join('')}</span>{ticket.requestor || 'Unassigned'}</span></td>
              <td><StatusBadge status={ticket.status} /></td>
              <td className="ticket-grid-date">{new Date(ticket.created_at).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</td>
            </tr>)}</tbody>
          </AppTable>
        </div>
{filtered.length > 0 && (
        <Pagination attached page={currentPage} total={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      )}

      </section>
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
