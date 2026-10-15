import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';


interface Ticket {
  id: number;
  ticket_number: string;
  subject: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  category: string;
  assigned_to: string | null;
  created_at: string;
}

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
      borderRadius: 3, fontWeight: 500,
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
      borderRadius: 3, fontWeight: 500,
    }}>
      {priority}
    </span>
  );
}

export default function StaffDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      api.get(`/tickets?requestor_id=${user.id}`).then(res => {
        setTickets(res.data);
        setLoading(false);
      });
    }
  }, [user]);

  const open     = tickets.filter(t => t.status === 'Open').length;
  const inProg   = tickets.filter(t => t.status === 'In Progress').length;
  const resolved = tickets.filter(t => t.status === 'Resolved').length;
  const closed   = tickets.filter(t => t.status === 'Closed').length;

  const recent = tickets.slice(0, 5);

  return (
    <div style={{ padding: 'clamp(14px, 3vw, 24px)' }}>
      {/* BREADCRUMB */}
      <div style={{ fontSize: 'clamp(10px, 1.8vw, 13px)', color: '#4A4A4A', marginBottom: 'clamp(10px, 2vw, 14px)' }}>
        Home <span style={{ color: 'var(--gov-navy)', fontWeight: 500 }}>
          / My Dashboard
        </span>
      </div>

      {/* WELCOME STRIP */}
      <div style={{
        background: '#E8F1FA', borderLeft: '3px solid var(--gov-navy)',
        borderRadius: '0 4px 4px 0', padding: 'clamp(8px, 2vw, 12px) clamp(10px, 3vw, 16px)',
        fontSize: 'clamp(10px, 1.8vw, 13px)', color: 'var(--gov-navy)', marginBottom: 'clamp(12px, 2.5vw, 18px)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 'clamp(8px, 2vw, 12px)',
      }}>
        <span>
          Welcome back, <strong>{user?.full_name}</strong>.
          You have <strong>{open + inProg} active ticket{open + inProg !== 1 ? 's' : ''}</strong> in the system.
        </span>
        <button
          onClick={() => navigate('/submit')}
          style={{
            padding: 'clamp(5px, 1vw, 8px) clamp(10px, 2vw, 16px)', fontSize: 'clamp(10px, 1.8vw, 13px)',
            background: 'var(--gov-green)', color: '#fff',
            border: 'none', borderRadius: 4,
            cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          + Submit New Ticket
        </button>
      </div>

      {/* STAT CARDS */}
      {loading ? (
        <div style={{ color: 'var(--gov-navy)', padding: 'clamp(14px, 3vw, 24px)', textAlign: 'center' }}>Loading...</div>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 'clamp(8px, 2vw, 12px)', marginBottom: 'clamp(12px, 2.5vw, 18px)',
        }}>
          {[
            { label: 'Total Tickets',  value: tickets.length, color: 'var(--gov-navy)',  sub: 'All my requests'        },
            { label: 'Open',           value: open,           color: 'var(--gov-amber)', sub: 'Awaiting action'        },
            { label: 'In Progress',    value: inProg,         color: '#185FA5',          sub: 'Being worked on'        },
            { label: 'Resolved / Closed', value: resolved + closed, color: 'var(--gov-green)', sub: 'Completed tickets' },
          ].map(c => (
            <div key={c.label} style={{
              background: '#fff', border: '0.5px solid #D0D9E4',
              borderRadius: 8, padding: 'clamp(10px, 2vw, 16px)',
              borderTop: `3px solid ${c.color}`,
            }}>
              <div style={{
                fontSize: 'clamp(9px, 1.6vw, 12px)', color: '#4A4A4A',
                textTransform: 'uppercase', letterSpacing: 0.5,
                marginBottom: 'clamp(4px, 1vw, 8px)', fontWeight: 500,
              }}>
                {c.label}
              </div>
              <div style={{ fontSize: 'clamp(20px, 4vw, 26px)', fontWeight: 500, color: c.color }}>
                {c.value}
              </div>
              <div style={{ fontSize: 'clamp(8px, 1.5vw, 11px)', color: '#888', marginTop: 'clamp(3px, 0.6vw, 6px)' }}>{c.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* TICKET PROGRESS SUMMARY */}
      {!loading && tickets.length > 0 && (
        <div style={{
          background: '#fff', border: '0.5px solid #D0D9E4',
          borderRadius: 8, padding: 'clamp(12px, 2.5vw, 18px)', marginBottom: 'clamp(10px, 2vw, 14px)',
        }}>
          <div style={{
            fontSize: 'clamp(9px, 1.6vw, 12px)', fontWeight: 500, color: 'var(--gov-navy)',
            textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 'clamp(8px, 2vw, 12px)',
          }}>
            My Ticket Progress
          </div>
          <div style={{ display: 'flex', gap: 0, height: 'clamp(16px, 3vw, 24px)', borderRadius: 4, overflow: 'hidden', marginBottom: 'clamp(8px, 2vw, 12px)' }}>
            {[
              { count: open,     color: '#1A5490', label: 'Open'        },
              { count: inProg,   color: '#CC7700', label: 'In Progress' },
              { count: resolved, color: '#1B6B3A', label: 'Resolved'    },
              { count: closed,   color: '#888',    label: 'Closed'      },
            ].filter(s => s.count > 0).map(s => (
              <div
                key={s.label}
                title={`${s.label}: ${s.count}`}
                style={{
                  width: `${(s.count / tickets.length) * 100}%`,
                  background: s.color,
                  transition: 'width 0.3s',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'clamp(8px, 1.5vw, 11px)', color: '#fff', fontWeight: 500,
                }}
              >
                {s.count > 0 && s.count}
              </div>
            ))}
          </div>
          <div style={{
            display: 'flex', gap: 'clamp(10px, 2vw, 18px)', flexWrap: 'wrap',
          }}>
            {[
              { color: '#1A5490', label: 'Open'        },
              { color: '#CC7700', label: 'In Progress' },
              { color: '#1B6B3A', label: 'Resolved'    },
              { color: '#888',    label: 'Closed'      },
            ].map(l => (
              <div key={l.label} style={{
                display: 'flex', alignItems: 'center', gap: 'clamp(3px, 0.6vw, 6px)',
              }}>
                <div style={{
                  width: 'clamp(6px, 1.2vw, 10px)', height: 'clamp(6px, 1.2vw, 10px)', borderRadius: '50%',
                  background: l.color,
                }} />
                <span style={{ fontSize: 'clamp(9px, 1.6vw, 12px)', color: '#5A6475' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RECENT TICKETS */}
      <div style={{
        background: '#fff', border: '0.5px solid #D0D9E4',
        borderRadius: 8, overflow: 'hidden',
      }}>
        <div style={{
          background: 'var(--gov-navy)', padding: 'clamp(8px, 1.5vw, 12px) clamp(12px, 2.5vw, 18px)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'clamp(8px, 2vw, 12px)',
        }}>
          <span style={{ fontSize: 'clamp(11px, 1.9vw, 14px)', fontWeight: 500, color: '#fff' }}>
            My Recent Tickets
          </span>
          <button
            onClick={() => navigate('/tickets')}
            style={{
              background: 'rgba(255,255,255,0.15)', border: 'none',
              borderRadius: 4, padding: 'clamp(4px, 0.8vw, 6px) clamp(8px, 1.5vw, 12px)',
              color: '#fff', fontSize: 'clamp(9px, 1.6vw, 12px)', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            View All →
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 'clamp(18px, 4vw, 28px)', textAlign: 'center', color: '#888', fontSize: 'clamp(11px, 1.9vw, 14px)' }}>
            Loading tickets...
          </div>
        ) : tickets.length === 0 ? (
          <div style={{ padding: 'clamp(30px, 8vw, 48px)', textAlign: 'center' }}>
            <div style={{ fontSize: 'clamp(24px, 6vw, 32px)', marginBottom: 'clamp(8px, 2vw, 12px)' }}>🎫</div>
            <p style={{ fontSize: 'clamp(12px, 2vw, 16px)', fontWeight: 500, color: '#4A4A4A', marginBottom: 'clamp(4px, 1vw, 8px)', margin: 0 }}>
              No tickets yet
            </p>
            <p style={{ fontSize: 'clamp(9px, 1.6vw, 12px)', color: '#888', marginBottom: 'clamp(10px, 2vw, 16px)', margin: 0 }}>
              Submit your first IT support request to get started.
            </p>
            <button
              onClick={() => navigate('/submit')}
              style={{
                padding: 'clamp(6px, 1.2vw, 9px) clamp(12px, 2vw, 18px)', fontSize: 'clamp(11px, 1.9vw, 14px)',
                background: 'var(--gov-navy)', color: '#fff',
                border: 'none', borderRadius: 4, cursor: 'pointer',
              }}
            >
              Submit a Ticket
            </button>
          </div>
        ) : (
          <div style={{
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead>
                <tr>
                  {['Ticket #', 'Subject', 'Category', 'Priority', 'Status', 'Assigned To', 'Date'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: 'clamp(6px, 1.2vw, 10px) clamp(8px, 1.5vw, 12px)',
                      fontSize: 'clamp(9px, 1.6vw, 12px)', fontWeight: 500,
                      color: '#6A7280', borderBottom: '0.5px solid #E5EAF0',
                      background: '#F8FAFC', whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map(t => (
                  <tr key={t.id}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F5F8FC')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    <td style={{ padding: 'clamp(7px, 1.5vw, 10px) clamp(8px, 1.5vw, 12px)', fontWeight: 500, color: 'var(--gov-navy)', fontSize: 'clamp(10px, 1.8vw, 13px)' }}>
                      {t.ticket_number}
                    </td>
                    <td style={{ padding: 'clamp(7px, 1.5vw, 10px) clamp(8px, 1.5vw, 12px)', fontSize: 'clamp(10px, 1.8vw, 13px)' }}>
                      {t.subject}
                    </td>
                    <td style={{ padding: 'clamp(7px, 1.5vw, 10px) clamp(8px, 1.5vw, 12px)', fontSize: 'clamp(9px, 1.6vw, 12px)', color: '#5A6475' }}>
                      {t.category}
                    </td>
                    <td style={{ padding: 'clamp(7px, 1.5vw, 10px) clamp(8px, 1.5vw, 12px)' }}>
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td style={{ padding: 'clamp(7px, 1.5vw, 10px) clamp(8px, 1.5vw, 12px)' }}>
                      <StatusBadge status={t.status} />
                    </td>
                    <td style={{ padding: 'clamp(7px, 1.5vw, 10px) clamp(8px, 1.5vw, 12px)', fontSize: 'clamp(9px, 1.6vw, 12px)', color: '#5A6475', whiteSpace: 'nowrap' }}>
                      {t.assigned_to || '—'}
                    </td>
                    <td style={{ padding: 'clamp(7px, 1.5vw, 10px) clamp(8px, 1.5vw, 12px)', fontSize: 'clamp(9px, 1.6vw, 12px)', color: '#888', whiteSpace: 'nowrap' }}>
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
