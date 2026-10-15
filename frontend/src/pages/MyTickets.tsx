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
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

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
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTickets();
  }, [user?.empno, isServiceAdmin]);

  const filtered = tickets.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      t.ticket_number.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      t.requestor?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q);
    const matchStatus   = !filterStatus   || t.status   === filterStatus;
    const matchPriority = !filterPriority || t.priority === filterPriority;
    return matchSearch && matchStatus && matchPriority;
  });

  // Summary counts
  const assigned   = tickets.filter(t => t.status === 'Assigned').length;
  const inProgress = tickets.filter(t => t.status === 'In Progress').length;
  const onHold     = tickets.filter(t => t.status === 'On-Hold').length;
  const resolved   = tickets.filter(t => t.status === 'Resolved').length;

  if (loading) return (
    <div style={{
      color: 'var(--gov-navy)',
      padding: 'clamp(24px, 5vw, 40px)',
      textAlign: 'center',
      fontSize: 'clamp(11px, 2vw, 13px)',
    }}>
      Loading your tickets...
    </div>
  );

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
      <div style={{
        background: '#E8F1FA',
        borderLeft: '3px solid var(--gov-navy)',
        borderRadius: '0 4px 4px 0',
        padding: 'clamp(8px, 2vw, 12px)',
        fontSize: 'clamp(9px, 1.8vw, 12px)',
        color: 'var(--gov-navy)',
        marginBottom: 14,
        lineHeight: 1.5,
      }}>
        Showing all tickets currently assigned to <strong>{user?.full_name}</strong>
        {isServiceAdmin ? ' within your designated service area.' : '.'}
      </div>

      {/* SUMMARY CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 'clamp(8px, 2vw, 12px)',
        marginBottom: 16,
      }}>
        {[
          { label: 'Assigned',    value: assigned,   color: 'var(--gov-amber)' },
          { label: 'In Progress', value: inProgress, color: '#5B21B6'          },
          { label: 'On-Hold',     value: onHold,     color: 'var(--gov-red)'   },
          { label: 'Resolved',    value: resolved,   color: 'var(--gov-green)' },
        ].map(c => (
          <div key={c.label} style={{
            background: '#fff',
            border: '0.5px solid #D0D9E4',
            borderRadius: 8,
            padding: 'clamp(10px, 2.5vw, 14px)',
            borderTop: `3px solid ${c.color}`,
          }}>
            <div style={{
              fontSize: 'clamp(9px, 1.8vw, 11px)',
              color: '#4A4A4A',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 6,
              fontWeight: 500,
            }}>
              {c.label}
            </div>
            <div style={{
              fontSize: 'clamp(18px, 5vw, 26px)',
              fontWeight: 500,
              color: c.color,
            }}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {/* FILTER BAR */}
      <div style={{
        background: '#fff',
        border: '0.5px solid #D0D9E4',
        borderRadius: 8,
        padding: 'clamp(8px, 2vw, 12px)',
        marginBottom: 14,
        display: 'flex',
        gap: 'clamp(6px, 1.5vw, 10px)',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <input
          type="text"
          placeholder="Search by ticket no, subject, requestor..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: '1 1 auto',
            minWidth: 'clamp(150px, 50vw, 280px)',
            padding: 'clamp(5px, 1.5vw, 6px) clamp(8px, 1.5vw, 10px)',
            fontSize: 'clamp(10px, 1.8vw, 12px)',
            border: '1px solid #C8D0DC',
            borderRadius: 4,
          }}
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{
            padding: 'clamp(5px, 1.5vw, 6px) clamp(8px, 1.5vw, 10px)',
            fontSize: 'clamp(10px, 1.8vw, 12px)',
            border: '1px solid #C8D0DC',
            borderRadius: 4,
            flex: '0 1 auto',
            minWidth: '130px',
          }}
        >
          <option value="">All Statuses</option>
          {['Assigned', 'In Progress', 'On-Hold', 'Resolved'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value)}
          style={{
            padding: 'clamp(5px, 1.5vw, 6px) clamp(8px, 1.5vw, 10px)',
            fontSize: 'clamp(10px, 1.8vw, 12px)',
            border: '1px solid #C8D0DC',
            borderRadius: 4,
            flex: '0 1 auto',
            minWidth: '130px',
          }}
        >
          <option value="">All Priorities</option>
          {['Low', 'Medium', 'High', 'Critical'].map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {(search || filterStatus || filterPriority) && (
          <button
            onClick={() => { setSearch(''); setFilterStatus(''); setFilterPriority(''); }}
            style={{
              padding: 'clamp(5px, 1.5vw, 6px) clamp(8px, 1.5vw, 12px)',
              fontSize: 'clamp(10px, 1.8vw, 12px)',
              border: '1px solid #C8D0DC',
              borderRadius: 4,
              background: '#F5F8FC',
              cursor: 'pointer',
              color: '#4A4A4A',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              flex: '0 0 auto',
            }}
          >
            ✕ Clear
          </button>
        )}
        <span style={{
          fontSize: 'clamp(9px, 1.8vw, 11px)',
          color: '#6A7280',
          marginLeft: 'auto',
          whiteSpace: 'nowrap',
          flex: '0 0 auto',
        }}>
          {filtered.length} of {tickets.length}
        </span>
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
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          minWidth: '1000px',
        }}>
          <thead>
            <tr>
              {['Ticket No.', 'Subject', 'Requestor', 'Division / Unit', 'Office Location', 'Category', 'Priority', 'Status', 'Date Filed', 'Action'].map(h => (
                <th key={h} style={{
                  textAlign: 'left',
                  padding: 'clamp(6px, 1.5vw, 9px) clamp(8px, 2vw, 14px)',
                  fontSize: 'clamp(8px, 1.5vw, 10px)',
                  fontWeight: 500,
                  color: '#fff',
                  background: 'var(--gov-navy)',
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
                <td colSpan={10} style={{
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
            ) : filtered.map(t => {
              const ss = STATUS_STYLE[t.status]   ?? { bg: '#F0F0F0', color: '#666' };
              const ps = PRIORITY_STYLE[t.priority] ?? { bg: '#F0F0F0', color: '#666' };
              return (
                <tr
                  key={t.id}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F5F8FC')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                >
                  {/* Ticket No */}
                  <td style={{
                    padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 14px)',
                    whiteSpace: 'nowrap',
                  }}>
                    <span style={{
                      fontSize: 'clamp(8px, 1.5vw, 10px)',
                      fontWeight: 600,
                      color: 'var(--gov-navy)',
                    }}>
                      {t.ticket_number}
                    </span>
                  </td>

                  {/* Subject */}
                  <td style={{
                    padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 14px)',
                    maxWidth: 240,
                  }}>
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
                  </td>

                  {/* Requestor */}
                  <td style={{
                    padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 14px)',
                  }}>
                    <div style={{
                      fontSize: 'clamp(8px, 1.5vw, 10px)',
                      color: '#2A2A2A',
                      fontWeight: 500,
                    }}>
                      {t.requestor || '—'}
                    </div>
                  </td>

                  {/* Division / Unit */}
                  <td style={{
                    padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 14px)',
                  }}>
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
                  </td>

                  {/* Office Location */}
                  <td style={{
                    padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 14px)',
                    whiteSpace: 'nowrap',
                  }}>
                    <div style={{
                      fontSize: 'clamp(8px, 1.5vw, 10px)',
                      color: '#5A6475',
                    }}>
                      {t.office_location || '—'}
                    </div>
                  </td>

                  {/* Category */}
                  <td style={{
                    padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 14px)',
                  }}>
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
                  </td>

                  {/* Priority */}
                  <td style={{
                    padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 14px)',
                    whiteSpace: 'nowrap',
                  }}>
                    <span style={{
                      background: ps.bg,
                      color: ps.color,
                      fontSize: 'clamp(7px, 1.2vw, 9px)',
                      fontWeight: 600,
                      padding: '2px clamp(4px, 1vw, 8px)',
                      borderRadius: 3,
                    }}>
                      {t.priority}
                    </span>
                  </td>

                  {/* Status */}
                  <td style={{
                    padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 14px)',
                    whiteSpace: 'nowrap',
                  }}>
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
                  </td>

                  {/* Date */}
                  <td style={{
                    padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 14px)',
                    fontSize: 'clamp(8px, 1.5vw, 10px)',
                    color: '#6A7280',
                    whiteSpace: 'nowrap',
                  }}>
                    {formatDate(t.created_at)}
                  </td>
                  
                  {/* Action Button */}
                  <td style={{
                    padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 14px)',
                  }}>
                    <button
                      onClick={() => setSelectedTicket(t)}
                      style={{
                        padding: 'clamp(3px, 1vw, 5px) clamp(8px, 1.5vw, 12px)',
                        fontSize: 'clamp(8px, 1.5vw, 10px)',
                        background: 'var(--gov-navy)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
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
