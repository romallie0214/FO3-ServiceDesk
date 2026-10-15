import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';


// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────
interface MonitorTicket {
  id:                   number;
  ticket_number:        string;
  subject:              string;
  status:               string;
  priority:             string;
  created_at:           string;
  category:             string;
  sub_category:         string | null;
  sub_item:             string | null;
  requestor:            string;
  division:             string;
  assigned_to:          string | null;
  sla_priority:         string | null;
  sla_impact:           string | null;
  sla_response_hours:   number | null;
  sla_resolution_hours: number | null;
  sla_escalation_hours: number | null;
  sla_level:            string | null;
  first_response_at:    string | null;
  assigned_at:          string | null;
  escalation_started_at:string | null;
  resolved_at:          string | null;
}

interface ReportTicket extends MonitorTicket {
  unit?:             string;
  office_location?:  string;
  updated_at?:       string;
}

type SLAStatus = 'breached' | 'escalated' | 'warning' | 'ok' | 'no-sla';

interface SLACalc {
  status:               SLAStatus;
  responseBreached:     boolean;
  escalationBreached:   boolean;
  resolutionBreached:   boolean;
  responseDeadline:     Date | null;
  resolutionDeadline:   Date | null;
  escalationDeadline:   Date | null;
  hoursRemaining:       number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SLA HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function calcSLA(ticket: MonitorTicket): SLACalc | null {
  if (ticket.status === 'Cancelled' || !ticket.sla_response_hours) return null;
  const now = new Date();
  const resolvedAt = ticket.resolved_at ? new Date(ticket.resolved_at) : null;
  const created = new Date(ticket.created_at);
  const assignedAt = ticket.assigned_at ? new Date(ticket.assigned_at) : null;
  const escalationStartedAt = ticket.escalation_started_at ? new Date(ticket.escalation_started_at) : null;
  const responseStoppedAt = ticket.first_response_at
    ? new Date(ticket.first_response_at)
    : resolvedAt || now;
  const terminalTime = resolvedAt || now;

  const responseDeadline = new Date(created.getTime() + ticket.sla_response_hours * 3600000);
  const resolutionDeadline = assignedAt && ticket.sla_resolution_hours
    ? new Date(assignedAt.getTime() + ticket.sla_resolution_hours * 3600000)
    : null;
  const escalationDeadline = escalationStartedAt && ticket.sla_escalation_hours
    ? new Date(escalationStartedAt.getTime() + ticket.sla_escalation_hours * 3600000)
    : null;
  const responseBreached = responseStoppedAt > responseDeadline;
  const resolutionBreached = Boolean(resolutionDeadline && terminalTime > resolutionDeadline);
  const escalationBreached = Boolean(escalationDeadline && terminalTime > escalationDeadline);
  const activeDeadline = resolutionDeadline || responseDeadline;
  const hoursRemaining = (activeDeadline.getTime() - terminalTime.getTime()) / 3600000;

  let status: SLAStatus = 'ok';
  if (resolutionBreached)  status = 'breached';
  else if (escalationBreached) status = 'escalated';
  else if (hoursRemaining <= 2) status = 'warning';

  return {
    status, responseBreached, escalationBreached,
    resolutionBreached, responseDeadline,
    resolutionDeadline, escalationDeadline,
    hoursRemaining,
  };
}

function getSLAStatusLabel(ticket: ReportTicket): string {
  const sla = calcSLA(ticket);
  if (!sla) return 'No SLA';
  if (sla.resolutionBreached)  return 'SLA Breached';
  if (sla.escalationBreached)  return 'Escalated';
  if (sla.hoursRemaining <= 2) return 'Warning';
  return 'On Track';
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE MAPS
// ─────────────────────────────────────────────────────────────────────────────
const SLA_STYLE: Record<SLAStatus, { bg: string; color: string; label: string }> = {
  breached:  { bg: '#FDE8E8', color: '#8B1A1A', label: 'SLA Breached'  },
  escalated: { bg: '#FEF3DC', color: '#CC7700', label: 'Escalated'     },
  warning:   { bg: '#FDF5DC', color: '#854F0B', label: 'Warning <2hrs' },
  ok:        { bg: '#E8F5EE', color: '#1B6B3A', label: 'On Track'      },
  'no-sla':  { bg: '#F0F0F0', color: '#666',    label: 'No SLA'        },
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  'Open':        { bg: '#E8F1FA', color: '#0D3B6E' },
  'Assigned':    { bg: '#E1F5EE', color: '#085041' },
  'In Progress': { bg: '#FEF3DC', color: '#CC7700' },
  'On-Hold':     { bg: '#FDF5DC', color: '#854F0B' },
  'Resolved':    { bg: '#E8F5EE', color: '#1B6B3A' },
  'Closed':      { bg: '#F0F0F0', color: '#4A4A4A' },
};

const PRIORITY_STYLE: Record<string, { bg: string; color: string }> = {
  'Critical': { bg: '#FDE8E8', color: '#8B1A1A' },
  'High':     { bg: '#FEF3DC', color: '#CC7700' },
  'Medium':   { bg: '#E8F1FA', color: '#0D3B6E' },
  'Low':      { bg: '#F0F0F0', color: '#4A4A4A' },
};

// ─────────────────────────────────────────────────────────────────────────────
// FORMAT HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function fmt(d: Date | null) {
  if (!d) return 'Not started';
  return d.toLocaleString('en-PH', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtFull(str: string) {
  return new Date(str).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatHours(h: number): string {
  if (h < 0) {
    const abs = Math.abs(h);
    if (abs < 1) return `-${Math.round(abs * 60)}m overdue`;
    return `-${abs.toFixed(1)}h overdue`;
  }
  if (h < 1) return `${Math.round(h * 60)}m left`;
  if (h < 24) return `${h.toFixed(1)}h left`;
  return `${(h / 24).toFixed(1)}d left`;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function firstDayOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL EXPORT
// ─────────────────────────────────────────────────────────────────────────────
function exportToExcel(
  tickets: ReportTicket[],
  dateFrom: string,
  dateTo: string,
  staffFilter: string
) {
  const rows = tickets.map((t, i) => {
    const sla       = calcSLA(t);
    const slaStatus = getSLAStatusLabel(t);

    return {
      'No.':                i + 1,
      'Ticket Number':      t.ticket_number,
      'Subject':            t.subject,
      'Category':           t.category || '',
      'Sub-Category':       t.sub_category || '',
      'Sub-Item':           t.sub_item || '',
      'Requestor':          t.requestor || '',
      'Division':           t.division || '',
      'Unit':               (t as any).unit || '',
      'Office Location':    (t as any).office_location || '',
      'Priority':           t.priority,
      'Status':             t.status,
      'Assigned To':        t.assigned_to || 'Unassigned',
      'Date Filed':         fmtFull(t.created_at),
      'SLA Priority':       t.sla_priority || 'No SLA',
      'SLA Impact':         t.sla_impact || '',
      'Response Time (hrs)':   t.sla_response_hours ?? '',
      'Escalation Time (hrs)': t.sla_escalation_hours ?? '',
      'Resolution Time (hrs)': t.sla_resolution_hours ?? '',
      'Response Deadline':  sla ? fmt(sla.responseDeadline)   : '',
      'Escalation Deadline':sla ? fmt(sla.escalationDeadline) : '',
      'Resolution Deadline':sla ? fmt(sla.resolutionDeadline) : '',
      'Response Status':    sla ? (sla.responseBreached   ? 'BREACHED' : 'On Time') : 'No SLA',
      'Escalation Status':  sla ? (sla.escalationBreached ? 'ESCALATED': 'Not Yet')  : 'No SLA',
      'Resolution Status':  sla ? (sla.resolutionBreached ? 'BREACHED' : 'On Time') : 'No SLA',
      'Overall SLA Status': slaStatus,
      'Hours Remaining':    sla ? parseFloat(sla.hoursRemaining.toFixed(2)) : '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws['!cols'] = [
    { wch: 5  }, { wch: 16 }, { wch: 35 }, { wch: 18 },
    { wch: 18 }, { wch: 18 }, { wch: 25 }, { wch: 25 },
    { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 12 },
    { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 16 },
    { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 20 },
    { wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 16 },
    { wch: 14 }, { wch: 16 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ticket Report');

  const staffSuffix = staffFilter ? `_${staffFilter.replace(/\s+/g, '_')}` : '';
  const fileName    = `ICTMS_Ticket_Report_${dateFrom}_to_${dateTo}${staffSuffix}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function TicketMonitoring({ publicMode = false }: { publicMode?: boolean }) {
  const { user } = useAuth();
  const isServiceAdmin = user?.role !== 'super_admin' && (user?.area_admin_service_ids?.length ?? 0) > 0;
  // Live monitoring state
  const [tickets, setTickets]               = useState<MonitorTicket[]>([]);
  const [loading, setLoading]               = useState(true);
  const [accessDenied, setAccessDenied]     = useState(false);
  const [lastRefresh, setLastRefresh]       = useState(new Date());
  const [filterSLA, setFilterSLA]           = useState<SLAStatus | ''>('');
  const [filterStatus, setFilterStatus]     = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [search, setSearch]                 = useState('');
  const [sortBy, setSortBy]                 = useState<'sla' | 'created' | 'priority'>('sla');

  // Report state
  const [activeTab, setActiveTab]       = useState<'monitoring' | 'report'>('monitoring');
  const [dateFrom, setDateFrom]         = useState(firstDayOfMonth());
  const [dateTo, setDateTo]             = useState(todayStr());
  const [staffFilter, setStaffFilter]   = useState('');
  const [reportStatusFilter, setReportStatusFilter] = useState('');
  const [staffList, setStaffList]       = useState<string[]>([]);
  const [reportData, setReportData]     = useState<ReportTicket[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);

  // ── Fetch live monitoring data ─────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setAccessDenied(false);
      const res = await api.get(
        publicMode ? '/public-monitoring/tickets' : '/tickets/monitoring/sla',
        !publicMode && isServiceAdmin ? { params: { serviceAdmin: 'true' } } : undefined,
      );
      setTickets(res.data);
      setLastRefresh(new Date());

      // Build staff list for report dropdown
      const staffNames: string[] = Array.from(
        new Set(
          res.data
            .map((t: MonitorTicket) => t.assigned_to)
            .filter(Boolean) as string[]
        )
      ).sort();
      setStaffList(staffNames);
    } catch (err: unknown) {
      console.error('Failed to fetch monitoring data');
      if (publicMode && axios.isAxiosError(err) && err.response?.status === 403) {
        setAccessDenied(true);
      }
    } finally {
      setLoading(false);
    }
  }, [publicMode, isServiceAdmin]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 120000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Generate Report ────────────────────────────────────────────────────────
  async function generateReport() {
    if (!dateFrom || !dateTo) { alert('Please select a date range.'); return; }
    if (new Date(dateFrom) > new Date(dateTo)) {
      alert('Start date cannot be after end date.');
      return;
    }
    setReportLoading(true);
    setReportGenerated(false);
    try {
      const params: Record<string, string> = { from: dateFrom, to: dateTo };
      if (staffFilter) params.staff = staffFilter;
      if (reportStatusFilter) params.status = reportStatusFilter;
      if (isServiceAdmin) params.serviceAdmin = 'true';

      const res = await api.get('/tickets/report', { params });
      setReportData(res.data.filter((ticket: ReportTicket) => ticket.status !== 'Cancelled'));
      setReportGenerated(true);
    } catch (err) {
      console.error('Report generation failed');
      alert('Failed to generate report. Please try again.');
    } finally {
      setReportLoading(false);
    }
  }

  // ── Compute SLA for all live tickets ──────────────────────────────────────
  const withSLA = tickets.map(t => ({ ...t, sla: calcSLA(t) }));

  const filtered = withSLA.filter(t => {
    const slaStatus: SLAStatus = t.sla?.status ?? 'no-sla';
    const matchSLA      = !filterSLA      || slaStatus === filterSLA;
    const matchStatus   = !filterStatus   || t.status === filterStatus;
    const matchPriority = !filterPriority || t.priority === filterPriority;
    const matchSearch   = !search ||
      t.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.requestor?.toLowerCase().includes(search.toLowerCase()) ||
      (t.assigned_to?.toLowerCase().includes(search.toLowerCase()) ?? false);
    return matchSLA && matchStatus && matchPriority && matchSearch;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'sla') {
      const order: Record<SLAStatus, number> = {
        breached: 0, escalated: 1, warning: 2, ok: 3, 'no-sla': 4,
      };
      return order[a.sla?.status ?? 'no-sla'] - order[b.sla?.status ?? 'no-sla'];
    }
    if (sortBy === 'priority') {
      const order: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      return (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  // Summary counts
  const breached  = withSLA.filter(t => t.sla?.status === 'breached').length;
  const escalated = withSLA.filter(t => t.sla?.status === 'escalated').length;
  const warning   = withSLA.filter(t => t.sla?.status === 'warning').length;
  const onTrack   = withSLA.filter(t => t.sla?.status === 'ok').length;
  const noSLA     = withSLA.filter(t => !t.sla).length;

  if (loading) return (
    <div style={{ color: 'var(--gov-navy)', padding: 40, textAlign: 'center', minHeight: publicMode ? '100vh' : undefined }}>
      Loading monitoring data...
    </div>
  );

  if (accessDenied) return (
    <div style={{ minHeight: '100vh', background: '#F3F6FA', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ maxWidth: 520, background: '#fff', border: '1px solid #D0D9E4', borderRadius: 8, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#8B1A1A', marginBottom: 10 }}>Access denied</div>
        <div style={{ color: '#5A6475', lineHeight: 1.5 }}>
          This live monitoring page is only available from approved IP addresses.
        </div>
      </div>
    </div>
  );

  return (
    <div style={publicMode ? { minHeight: '100vh', background: '#F3F6FA', padding: 'clamp(12px, 2vw, 24px)' } : undefined}>
      {/* BREADCRUMB */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
          flexWrap: 'wrap',
          gap: 'clamp(8px, 2vw, 12px)',
        }}>
 
        <div style={{ fontSize: publicMode ? 'clamp(16px, 2vw, 22px)' : 'var(--text-xs)', color: 'var(--gov-navy)', fontWeight: publicMode ? 600 : 400 }}>
          {publicMode ? 'ICTMS Live Ticket Monitoring' : (
            <>Home <span style={{ color: 'var(--gov-navy)', fontWeight: 500 }}>/ Ticket Monitoring</span></>
          )}
        </div>
        {activeTab === 'monitoring' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 'var(--text-xs)', color: '#888' }}>
              Last refresh: {lastRefresh.toLocaleTimeString('en-PH')} · Auto-refreshes every 2 min
            </span>
            <button
              onClick={fetchData}
              style={{
                padding: '4px 12px', fontSize: 'var(--text-xs)',
                background: 'var(--gov-navy)', color: '#fff',
                border: 'none', borderRadius: 4, cursor: 'pointer',
              }}
            >
              ↻ Refresh
            </button>
          </div>
        )}
      </div>

      {/* TABS */}
      {!publicMode && <div style={{
        display: 'flex', gap: 0,
        borderBottom: '2px solid #D0D9E4',
        marginBottom: 16,
      }}>
        {[
          { key: 'monitoring', label: '📡 Live Monitoring' },
          { key: 'report',     label: '📊 Generate Report' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            style={{
              padding: 'clamp(6px, 1.5vw, 8px) clamp(12px, 2vw, 20px)',
              fontSize: 'clamp(10px, 1.8vw, 13px)',     
              border: 'none', cursor: 'pointer',
              fontWeight: activeTab === tab.key ? 600 : 400,
              color:      activeTab === tab.key ? 'var(--gov-navy)' : '#6A7280',
              background: 'transparent',
              borderBottom: activeTab === tab.key
                ? '2px solid var(--gov-navy)'
                : '2px solid transparent',
              marginBottom: -2,
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 1 — LIVE MONITORING                                            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'monitoring' && (
        <>
          {/* INFO STRIP */}
          <div style={{
            background: '#E8F1FA',
            borderLeft: '3px solid var(--gov-navy)',
            borderRadius: '0 4px 4px 0',
            padding: 'clamp(8px, 2vw, 12px)',
            fontSize: 'clamp(10px, 1.8vw, 12px)',
            color: 'var(--gov-navy)',
            marginBottom: 14,
          }}>
            Real-time SLA monitoring for all active tickets.
            Tickets are sorted by urgency — breached tickets appear first.
            Page auto-refreshes every 2 minutes.
          </div>

          {/* SLA SUMMARY CARDS */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: 'clamp(8px, 2vw, 12px)',
            marginBottom: 16,
          }}>
            {[
              { label: 'SLA Breached',  value: breached,  color: '#8B1A1A', bg: '#FDE8E8', key: 'breached'  },
              { label: 'Escalated',     value: escalated, color: '#CC7700', bg: '#FEF3DC', key: 'escalated' },
              { label: 'Warning <2hrs', value: warning,   color: '#854F0B', bg: '#FDF5DC', key: 'warning'   },
              { label: 'On Track',      value: onTrack,   color: '#1B6B3A', bg: '#E8F5EE', key: 'ok'        },
              { label: 'No SLA Mapped', value: noSLA,     color: '#4A4A4A', bg: '#F0F0F0', key: 'no-sla'    },
            ].map(c => (
              <div
                key={c.key}
                onClick={() => setFilterSLA(filterSLA === c.key ? '' : c.key as SLAStatus)}
                style={{
                  background: filterSLA === c.key ? c.bg : '#fff',
                  border: `${filterSLA === c.key ? '2px' : '0.5px'} solid ${filterSLA === c.key ? c.color : '#D0D9E4'}`,
                  borderRadius: 8,
                  padding: 'clamp(8px, 2vw, 12px)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  fontSize: 'var(--text-xs)', color: '#4A4A4A',
                  textTransform: 'uppercase', letterSpacing: 0.5,
                  marginBottom: 4, fontWeight: 500,
                }}>
                  {c.label}
                </div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 500, color: c.color }}>
                  {c.value}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: '#888', marginTop: 2 }}>
                  {filterSLA === c.key ? 'Click to clear' : 'Click to filter'}
                </div>
              </div>
            ))}
          </div>

          {/* FILTER BAR */}
          <div style={{
            background: '#fff', border: '0.5px solid #D0D9E4',
            borderRadius: 8, padding: '10px 14px',
            marginBottom: 16, display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'clamp(8px, 2vw, 12px)',
          }}>
            <input
              type="text"
              placeholder={publicMode ? 'Search ticket #, subject, assignee...' : 'Search ticket #, subject, requestor, assignee...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, minWidth: 180, padding: '5px 9px',
                fontSize: 'var(--text-xs)', border: '1px solid #C8D0DC', borderRadius: 4,
              }}
            />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{ padding: '5px 9px', fontSize: 'var(--text-xs)', border: '1px solid #C8D0DC', borderRadius: 4 }}
            >
              <option value="">All Status</option>
              {['Open','Assigned','In Progress','On-Hold','Resolved','Closed'].map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              style={{ padding: '5px 9px', fontSize: 'var(--text-xs)', border: '1px solid #C8D0DC', borderRadius: 4 }}
            >
              <option value="">All Priority</option>
              {['Critical','High','Medium','Low'].map(p => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              style={{ padding: '5px 9px', fontSize: 'var(--text-xs)', border: '1px solid #C8D0DC', borderRadius: 4 }}
            >
              <option value="sla">Sort: SLA Urgency</option>
              <option value="priority">Sort: Priority</option>
              <option value="created">Sort: Date Filed</option>
            </select>
            <span style={{ fontSize: 'var(--text-xs)', color: '#888', whiteSpace: 'nowrap' }}>
              {sorted.length} of {tickets.length} tickets
            </span>
          </div>

          {/* MONITORING TABLE */}
          <div style={{
            background: '#fff', border: '0.5px solid #D0D9E4',
            borderRadius: 8, overflow: 'hidden',
          }}>
            <div style={{
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              borderRadius: '6px',
              border: '0.5px solid #D0D9E4',
            }}>
                <table style={{
                  width: '100%', borderCollapse: 'collapse', tableLayout: 'auto',
                  minWidth: '800px',
                }}>
                <thead>
                  <tr>
                    {[
                      { label: 'SLA',         w: '9%'  },
                      { label: 'Ticket #',    w: '8%'  },
                      { label: 'Subject',     w: '16%' },
                      { label: 'Category',    w: '11%' },
                      { label: 'Status',      w: '9%'  },
                      { label: 'Priority',    w: '8%'  },
                      { label: 'Assigned To', w: '9%'  },
                      { label: 'Response',    w: '11%' },
                      { label: 'Escalation',  w: '11%' },
                      { label: 'Resolution',  w: '8%'  },
                    ].map(h => (
                      <th key={h.label} style={{
                        textAlign: 'left', padding: '8px 10px',
                        fontSize: 'var(--text-xs)', fontWeight: 500,
                        color: '#fff', background: 'var(--gov-navy)',
                        whiteSpace: 'nowrap', width: h.w,
                      }}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: 32, color: '#888' }}>
                        No tickets found.
                      </td>
                    </tr>
                  ) : sorted.map(ticket => {
                    const sla       = ticket.sla;
                    const slaStatus: SLAStatus = sla?.status ?? 'no-sla';
                    const slaStyle  = SLA_STYLE[slaStatus];
                    const stStyle   = STATUS_STYLE[ticket.status] ?? STATUS_STYLE['Open'];
                    const prStyle   = PRIORITY_STYLE[ticket.priority] ?? PRIORITY_STYLE['Medium'];
                    const rowBg     = slaStatus === 'breached'  ? '#FFF8F8'
                      : slaStatus === 'escalated' ? '#FFFBF0'
                      : slaStatus === 'warning'   ? '#FFFDF0'
                      : '#fff';

                    return (
                      <tr
                        key={ticket.id}
                        style={{
                          background: rowBg,
                          borderLeft: slaStatus === 'breached'
                            ? '3px solid #8B1A1A'
                            : slaStatus === 'escalated'
                            ? '3px solid #CC7700'
                            : '3px solid transparent',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                      >
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            ...slaStyle, fontSize: 'var(--text-xs)', padding: '2px 6px',
                            borderRadius: 3, fontWeight: 500, display: 'inline-block',
                          }}>
                            {slaStyle.label}
                          </span>
                          {sla && (
                            <div style={{
                              fontSize: 'var(--text-xs)', marginTop: 3,
                              color: slaStatus === 'breached' || slaStatus === 'escalated'
                                ? '#8B1A1A' : '#888',
                            }}>
                              {formatHours(sla.hoursRemaining)}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 500, color: 'var(--gov-navy)', fontSize: 'var(--text-xs)' }}>
                          {ticket.ticket_number}
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: 'var(--text-xs)' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ticket.subject}
                          </div>
                          {ticket.sub_item && (
                            <div style={{ fontSize: 'var(--text-xs)', color: '#888', marginTop: 2 }}>
                              {ticket.sub_item}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: 'var(--text-xs)', color: '#5A6475' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ticket.category}
                          </div>
                          {ticket.sub_category && (
                            <div style={{ fontSize: 'var(--text-xs)', color: '#999' }}>
                              {ticket.sub_category}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ ...stStyle, fontSize: 'var(--text-xs)', padding: '2px 6px', borderRadius: 3, fontWeight: 500 }}>
                            {ticket.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ ...prStyle, fontSize: 'var(--text-xs)', padding: '2px 6px', borderRadius: 3, fontWeight: 500 }}>
                            {ticket.priority}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: 'var(--text-xs)', color: '#5A6475' }}>
                          {ticket.assigned_to || (
                            <span style={{ color: '#CC7700', fontSize: 'var(--text-xs)', fontWeight: 500 }}>
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          {sla ? (
                            <>
                              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: sla.responseBreached ? '#8B1A1A' : '#1B6B3A' }}>
                                {sla.responseBreached ? '⚠ Breached' : '✓ On Time'}
                              </div>
                              <div style={{ fontSize: 'var(--text-xs)', color: '#888', marginTop: 2 }}>{fmt(sla.responseDeadline)}</div>
                            </>
                          ) : <span style={{ fontSize: 'var(--text-xs)', color: '#999' }}>—</span>}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          {sla ? (
                            <>
                              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: sla.escalationBreached ? '#CC7700' : '#1B6B3A' }}>
                                {sla.escalationBreached ? '⚠ Escalated' : '✓ Not Yet'}
                              </div>
                              <div style={{ fontSize: 'var(--text-xs)', color: '#888', marginTop: 2 }}>{fmt(sla.escalationDeadline)}</div>
                            </>
                          ) : <span style={{ fontSize: 'var(--text-xs)', color: '#999' }}>—</span>}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          {sla ? (
                            <>
                              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: sla.resolutionBreached ? '#8B1A1A' : '#1B6B3A' }}>
                                {sla.resolutionBreached ? '⚠ Breached' : '✓ On Time'}
                              </div>
                              <div style={{ fontSize: 'var(--text-xs)', color: '#888', marginTop: 2 }}>{fmt(sla.resolutionDeadline)}</div>
                            </>
                          ) : <span style={{ fontSize: 'var(--text-xs)', color: '#999' }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* LEGEND */}
          <div style={{
            marginTop: 12, padding: '8px 14px',
            background: '#fff', border: '0.5px solid #D0D9E4',
            borderRadius: 8, display: 'flex',
            alignItems: 'center', gap: 16, flexWrap: 'wrap',
            fontSize: 'var(--text-xs)', color: '#4A4A4A',
          }}>
            <span style={{ fontWeight: 500 }}>Legend:</span>
            {Object.entries(SLA_STYLE).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ background: val.bg, color: val.color, fontSize: 'var(--text-xs)', padding: '1px 6px', borderRadius: 3, fontWeight: 500 }}>
                  {val.label}
                </span>
              </div>
            ))}
            <span style={{ marginLeft: 'auto', color: '#888' }}>
              Red border row = SLA Breached · Amber border = Escalated
            </span>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 2 — GENERATE REPORT                                             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'report' && (
        <>
          {/* INFO STRIP */}
          <div style={{
            background: '#E8F1FA', borderLeft: '3px solid var(--gov-navy)',
            borderRadius: '0 4px 4px 0', padding: '8px 12px',
            fontSize: 'var(--text-xs)', color: 'var(--gov-navy)', marginBottom: 14,
          }}>
            Generate a detailed served-ticket report for a specific date range. Cancelled tickets are excluded.
            Optionally filter by ICTMS Technical Staff. Export to Excel for submission.
          </div>

          {/* REPORT FILTERS */}
          <div style={{
            background: '#fff', border: '0.5px solid #D0D9E4',
            borderRadius: 8, padding: 20, marginBottom: 14,
          }}>
            <div style={{
              fontSize: 'var(--text-xs)', fontWeight: 600, color: '#5A6475',
              textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 14,
            }}>
              Report Filters
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 14, marginBottom: 16,
            }}>
              {/* Date From */}
              <div>
                <label style={{
                  fontSize: 'var(--text-xs)', fontWeight: 600, color: '#5A6475',
                  textTransform: 'uppercase', letterSpacing: 0.4,
                  display: 'block', marginBottom: 5,
                }}>
                  Date From <span style={{ color: '#8B1A1A' }}>*</span>
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo}
                  onChange={e => setDateFrom(e.target.value)}
                  style={{
                    width: '100%', padding: '7px 10px',
                    fontSize: 'var(--text-sm)', border: '1px solid #C8D0DC',
                    borderRadius: 4, boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Date To */}
              <div>
                <label style={{
                  fontSize: 'var(--text-xs)', fontWeight: 600, color: '#5A6475',
                  textTransform: 'uppercase', letterSpacing: 0.4,
                  display: 'block', marginBottom: 5,
                }}>
                  Date To <span style={{ color: '#8B1A1A' }}>*</span>
                </label>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom}
                  max={todayStr()}
                  onChange={e => setDateTo(e.target.value)}
                  style={{
                    width: '100%', padding: '7px 10px',
                    fontSize: 'var(--text-sm)', border: '1px solid #C8D0DC',
                    borderRadius: 4, boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* ICTMS Staff */}
              <div>
                <label style={{
                  fontSize: 'var(--text-xs)', fontWeight: 600, color: '#5A6475',
                  textTransform: 'uppercase', letterSpacing: 0.4,
                  display: 'block', marginBottom: 5,
                }}>
                  ICTMS Staff (Optional)
                </label>
                <select
                  value={staffFilter}
                  onChange={e => setStaffFilter(e.target.value)}
                  style={{
                    width: '100%', padding: '7px 10px',
                    fontSize: 'var(--text-sm)', border: '1px solid #C8D0DC',
                    borderRadius: 4, boxSizing: 'border-box',
                    background: '#fff',
                  }}
                >
                  <option value="">All ICTMS Staff</option>
                  {staffList.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              {/* Ticket Status */}
              <div>
                <label style={{
                  fontSize: 'var(--text-xs)', fontWeight: 600, color: '#5A6475',
                  textTransform: 'uppercase', letterSpacing: 0.4,
                  display: 'block', marginBottom: 5,
                }}>
                  Ticket Status (Optional)
                </label>
                <select
                  value={reportStatusFilter}
                  onChange={e => setReportStatusFilter(e.target.value)}
                  style={{
                    width: '100%', padding: '7px 10px',
                    fontSize: 'var(--text-sm)', border: '1px solid #C8D0DC',
                    borderRadius: 4, boxSizing: 'border-box', background: '#fff',
                  }}
                >
                  <option value="">All Statuses</option>
                  {['Open', 'Assigned', 'In Progress', 'On-Hold', 'Resolved', 'Closed'].map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick date range presets */}
            <div style={{
              display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16,
            }}>
              <span style={{ fontSize: 'var(--text-xs)', color: '#6A7280', marginRight: 4, alignSelf: 'center' }}>
                Quick:
              </span>
              {[
                {
                  label: 'This Month',
                  from: firstDayOfMonth(),
                  to:   todayStr(),
                },
                {
                  label: 'Last Month',
                  from: (() => {
                    const d = new Date();
                    d.setMonth(d.getMonth() - 1, 1);
                    return d.toISOString().split('T')[0];
                  })(),
                  to: (() => {
                    const d = new Date();
                    d.setDate(0);
                    return d.toISOString().split('T')[0];
                  })(),
                },
                {
                  label: 'Last 7 Days',
                  from: (() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 7);
                    return d.toISOString().split('T')[0];
                  })(),
                  to: todayStr(),
                },
                {
                  label: 'Last 30 Days',
                  from: (() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 30);
                    return d.toISOString().split('T')[0];
                  })(),
                  to: todayStr(),
                },
                {
                  label: 'This Year',
                  from: `${new Date().getFullYear()}-01-01`,
                  to:   todayStr(),
                },
              ].map(preset => (
                <button
                  key={preset.label}
                  onClick={() => { setDateFrom(preset.from); setDateTo(preset.to); }}
                  style={{
                    padding: '4px 10px', fontSize: 'var(--text-xs)',
                    border: '1px solid #C8D0DC', borderRadius: 4,
                    background: dateFrom === preset.from && dateTo === preset.to
                      ? '#E8F1FA' : '#fff',
                    color: dateFrom === preset.from && dateTo === preset.to
                      ? 'var(--gov-navy)' : '#4A4A4A',
                    cursor: 'pointer', fontWeight: 500,
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={generateReport}
                disabled={reportLoading}
                style={{
                  padding: '8px 20px', fontSize: 'var(--text-sm)',
                  background: reportLoading ? '#C8D0DC' : 'var(--gov-navy)',
                  color: '#fff', border: 'none', borderRadius: 4,
                  cursor: reportLoading ? 'not-allowed' : 'pointer',
                  fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {reportLoading ? '⏳ Generating...' : '🔍 Generate Report'}
              </button>

              {reportGenerated && reportData.length > 0 && (
                <button
                  onClick={() => exportToExcel(reportData, dateFrom, dateTo, staffFilter)}
                  style={{
                    padding: '8px 20px', fontSize: 'var(--text-sm)',
                    background: '#1B6B3A', color: '#fff',
                    border: 'none', borderRadius: 4,
                    cursor: 'pointer', fontWeight: 500,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  📥 Export to Excel
                </button>
              )}
            </div>
          </div>

          {/* REPORT RESULTS */}
          {reportGenerated && (
            <>
              {/* Report Summary Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 'clamp(8px, 2vw, 12px)',
                marginBottom: 14,
              }}>
                {[
                  {
                    label: 'Served Ticket',
                    value: reportData.length,
                    color: 'var(--gov-navy)',
                    bg: '#E8F1FA',
                  },
                  {
                    label: 'SLA Breached',
                    value: reportData.filter(t => getSLAStatusLabel(t) === 'SLA Breached').length,
                    color: '#8B1A1A',
                    bg: '#FDE8E8',
                  },
                  {
                    label: 'Resolved',
                    value: reportData.filter(t => t.status === 'Resolved').length,
                    color: '#1B6B3A',
                    bg: '#E8F5EE',
                  },
                  {
                    label: 'Closed',
                    value: reportData.filter(t => t.status === 'Closed').length,
                    color: '#4A4A4A',
                    bg: '#F0F0F0',
                  },
                  {
                    label: 'Still Open/Active',
                    value: reportData.filter(t =>
                      ['Open','Assigned','In Progress','On-Hold'].includes(t.status)
                    ).length,
                    color: '#CC7700',
                    bg: '#FEF3DC',
                  },
                ].map(c => (
                  <div key={c.label} style={{
                    background: c.bg, border: `0.5px solid ${c.color}`,
                    borderRadius: 8, padding: 12,
                    borderTop: `3px solid ${c.color}`,
                  }}>
                    <div style={{
                      fontSize: 'var(--text-xs)', color: c.color,
                      textTransform: 'uppercase', letterSpacing: 0.5,
                      marginBottom: 4, fontWeight: 600,
                    }}>
                      {c.label}
                    </div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: c.color }}>
                      {c.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Report info bar */}
              <div style={{
                background: '#fff', border: '0.5px solid #D0D9E4',
                borderRadius: '8px 8px 0 0', padding: '8px 14px',
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: 10,
              }}>
                <div style={{ fontSize: 'var(--text-xs)', color: '#3A3A3A' }}>
                  Showing <strong>{reportData.length}</strong> tickets
                  from <strong>{fmtFull(dateFrom + 'T00:00:00')}</strong>
                  {' '}to <strong>{fmtFull(dateTo + 'T23:59:59')}</strong>
                  {staffFilter && (
                    <span> · Staff: <strong>{staffFilter}</strong></span>
                  )}
                </div>
                <button
                  onClick={() => exportToExcel(reportData, dateFrom, dateTo, staffFilter)}
                  style={{
                    padding: '5px 14px', fontSize: 'var(--text-xs)',
                    background: '#1B6B3A', color: '#fff',
                    border: 'none', borderRadius: 4,
                    cursor: 'pointer', fontWeight: 500,
                  }}
                >
                  📥 Export Excel
                </button>
              </div>

              {/* Report Table */}
              {/* Report Table — same structure as monitoring table */}
              <div style={{
                background: '#fff', border: '0.5px solid #D0D9E4',
                borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden',
              }}>
                <div style={{
                  overflowX: 'auto', WebkitOverflowScrolling: 'touch',
                  borderRadius: '6px', border: '0.5px solid #D0D9E4',
                  maxHeight: 560, overflowY: 'auto',
                }}>
                  <table style={{
                    width: '100%', borderCollapse: 'collapse', tableLayout: 'auto',
                    minWidth: '800px',
                  }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                      <tr>
                        {[
                          { label: 'SLA',         w: '9%'  },
                          { label: 'Ticket #',    w: '9%'  },
                          { label: 'Subject',     w: '15%' },
                          { label: 'Category',    w: '11%' },
                          { label: 'Status',      w: '9%'  },
                          { label: 'Priority',    w: '8%'  },
                          { label: 'Assigned To', w: '10%' },
                          { label: 'Response',    w: '11%' },
                          { label: 'Escalation',  w: '11%' },
                          { label: 'Resolution',  w: '7%'  },
                        ].map(h => (
                          <th key={h.label} style={{
                            textAlign: 'left', padding: '8px 10px',
                            fontSize: 'var(--text-xs)', fontWeight: 500,
                            color: '#fff', background: 'var(--gov-navy)',
                            whiteSpace: 'nowrap', width: h.w,
                          }}>
                            {h.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.length === 0 ? (
                        <tr>
                          <td colSpan={10} style={{
                            textAlign: 'center', padding: 32,
                            color: '#888', fontSize: 'var(--text-base)',
                          }}>
                            No tickets found for the selected criteria.
                          </td>
                        </tr>
                      ) : reportData.map(t => {
                        const sla       = calcSLA(t);
                        const slaStatus: SLAStatus = sla?.status ?? 'no-sla';
                        const slaStyle  = SLA_STYLE[slaStatus];
                        const stStyle   = STATUS_STYLE[t.status] ?? { bg: '#F0F0F0', color: '#666' };
                        const prStyle   = PRIORITY_STYLE[t.priority] ?? { bg: '#F0F0F0', color: '#666' };

                        // For resolved/closed tickets — show final status instead of breach
                        const isDone = ['Resolved', 'Closed', 'Cancelled'].includes(t.status);

                        const rowBg =
                          isDone            ? '#fff'     :
                          slaStatus === 'breached'  ? '#FFF8F8' :
                          slaStatus === 'escalated' ? '#FFFBF0' :
                          slaStatus === 'warning'   ? '#FFFDF0' : '#fff';

                        return (
                          <tr
                            key={t.id}
                            style={{
                              background: rowBg,
                              borderLeft:
                                !isDone && slaStatus === 'breached'  ? '3px solid #8B1A1A' :
                                !isDone && slaStatus === 'escalated' ? '3px solid #CC7700' :
                                '3px solid transparent',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                          >
                            {/* SLA */}
                            <td style={{ padding: '8px 10px' }}>
                              {isDone ? (
                                <span style={{
                                  fontSize: 'var(--text-xs)', padding: '2px 6px', borderRadius: 3,
                                  fontWeight: 500, display: 'inline-block',
                                  background: stStyle.bg, color: stStyle.color,
                                }}>
                                  {t.status}
                                </span>
                              ) : (
                                <>
                                  <span style={{
                                    ...slaStyle, fontSize: 'var(--text-xs)', padding: '2px 6px',
                                    borderRadius: 3, fontWeight: 500, display: 'inline-block',
                                  }}>
                                    {slaStyle.label}
                                  </span>
                                  {sla && (
                                    <div style={{
                                      fontSize: 'var(--text-xs)', marginTop: 3,
                                      color: slaStatus === 'breached' || slaStatus === 'escalated'
                                        ? '#8B1A1A' : '#888',
                                    }}>
                                      {formatHours(sla.hoursRemaining)}
                                    </div>
                                  )}
                                </>
                              )}
                            </td>

                            {/* Ticket # */}
                            <td style={{ padding: '8px 10px', fontWeight: 500, color: 'var(--gov-navy)', fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>
                              {t.ticket_number}
                            </td>

                            {/* Subject */}
                            <td style={{ padding: '8px 10px', fontSize: 'var(--text-xs)' }}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {t.subject}
                              </div>
                              {t.sub_item && (
                                <div style={{ fontSize: 'var(--text-xs)', color: '#888', marginTop: 2 }}>
                                  {t.sub_item}
                                </div>
                              )}
                            </td>

                            {/* Category */}
                            <td style={{ padding: '8px 10px', fontSize: 'var(--text-xs)', color: '#5A6475' }}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {t.category || '—'}
                              </div>
                              {t.sub_category && (
                                <div style={{ fontSize: 'var(--text-xs)', color: '#999', marginTop: 1 }}>
                                  {t.sub_category}
                                </div>
                              )}
                            </td>

                            {/* Status */}
                            <td style={{ padding: '8px 10px' }}>
                              <span style={{ ...stStyle, fontSize: 'var(--text-xs)', padding: '2px 6px', borderRadius: 3, fontWeight: 500 }}>
                                {t.status}
                              </span>
                            </td>

                            {/* Priority */}
                            <td style={{ padding: '8px 10px' }}>
                              <span style={{ ...prStyle, fontSize: 'var(--text-xs)', padding: '2px 6px', borderRadius: 3, fontWeight: 500 }}>
                                {t.priority}
                              </span>
                            </td>

                            {/* Assigned To */}
                            <td style={{ padding: '8px 10px', fontSize: 'var(--text-xs)', color: '#5A6475' }}>
                              {t.assigned_to || (
                                <span style={{ color: '#CC7700', fontSize: 'var(--text-xs)', fontStyle: 'italic' }}>
                                  Unassigned
                                </span>
                              )}
                            </td>

                            {/* Response */}
                            <td style={{ padding: '8px 10px' }}>
                              {sla ? (
                                <>
                                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: sla.responseBreached ? '#8B1A1A' : '#1B6B3A' }}>
                                    {sla.responseBreached ? '⚠ Breached' : '✓ On Time'}
                                  </div>
                                  <div style={{ fontSize: 'var(--text-xs)', color: '#888', marginTop: 2 }}>
                                    {fmt(sla.responseDeadline)}
                                  </div>
                                </>
                              ) : (
                                <span style={{ fontSize: 'var(--text-xs)', color: '#999' }}>—</span>
                              )}
                            </td>

                            {/* Escalation */}
                            <td style={{ padding: '8px 10px' }}>
                              {sla ? (
                                <>
                                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: sla.escalationBreached ? '#CC7700' : '#1B6B3A' }}>
                                    {sla.escalationBreached ? '⚠ Escalated' : '✓ Not Yet'}
                                  </div>
                                  <div style={{ fontSize: 'var(--text-xs)', color: '#888', marginTop: 2 }}>
                                    {fmt(sla.escalationDeadline)}
                                  </div>
                                </>
                              ) : (
                                <span style={{ fontSize: 'var(--text-xs)', color: '#999' }}>—</span>
                              )}
                            </td>

                            {/* Resolution */}
                            <td style={{ padding: '8px 10px' }}>
                              {sla ? (
                                <>
                                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: sla.resolutionBreached ? '#8B1A1A' : '#1B6B3A' }}>
                                    {sla.resolutionBreached ? '⚠ Breached' : '✓ On Time'}
                                  </div>
                                  <div style={{ fontSize: 'var(--text-xs)', color: '#888', marginTop: 2 }}>
                                    {fmt(sla.resolutionDeadline)}
                                  </div>
                                </>
                              ) : (
                                <span style={{ fontSize: 'var(--text-xs)', color: '#999' }}>—</span>
                              )}
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Legend — same as monitoring */}
              <div style={{
                marginTop: 10, padding: '8px 14px',
                background: '#fff', border: '0.5px solid #D0D9E4',
                borderRadius: 8, display: 'flex',
                alignItems: 'center', gap: 16, flexWrap: 'wrap',
                fontSize: 'var(--text-xs)', color: '#4A4A4A',
              }}>
                <span style={{ fontWeight: 500 }}>Legend:</span>
                {Object.entries(SLA_STYLE).map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{
                      background: val.bg, color: val.color,
                      fontSize: 'var(--text-xs)', padding: '1px 6px',
                      borderRadius: 3, fontWeight: 500,
                    }}>
                      {val.label}
                    </span>
                  </div>
                ))}
                <span style={{ marginLeft: 'auto', color: '#888' }}>
                  Resolved / Closed tickets show final status · Active tickets show SLA urgency
                </span>
              </div>

        
            </>
          )}
        </>
      )}
    </div>
  );
}
