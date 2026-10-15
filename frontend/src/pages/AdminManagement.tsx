import { useEffect, useState } from 'react';
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
}

interface User {
  id: number;
  empno: string;               // ✅ staff empno
  full_name: string;
  role: string;
  division: string;
  service_role?: string;
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
  const { user: currentUser } = useAuth();
  const isServiceAdmin = currentUser?.role !== 'super_admin' && (currentUser?.area_admin_service_ids?.length ?? 0) > 0;
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers]     = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Record<number, number>>({});
  const [toast, setToast]     = useState('');
  const [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab] = useState<'unassigned' | 'assigned'>('unassigned');

  async function loadManagementData() {
    setLoading(true);
    setLoadError('');

    try {
      const [ticketRes, userRes] = await Promise.all([
        api.get(isServiceAdmin ? '/tickets?serviceAdmin=true' : '/tickets'),
        api.get('/users/assignable-staff'),
      ]);

      setTickets(ticketRes.data);
      setUsers(userRes.data);
    } catch (err: any) {
      setLoadError(err.response?.data?.error || 'Unable to load Admin Management data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadManagementData();
  }, []);

  const assignableStaff = isServiceAdmin
    ? users.filter(u => ['supervisor', 'technical_staff'].includes(u.service_role || ''))
    : users.filter(u => u.role === 'ictms_staff' || u.role === 'super_admin');

  // Unassigned — Open tickets with no assigned_to
  const unassigned = tickets.filter(
    t => !t.assigned_to &&
    t.status !== 'Closed' &&
    t.status !== 'Resolved' &&
    t.status !== 'Cancelled'
  );

  // Assigned — tickets that have an assigned staff
  const assigned = tickets.filter(
    t => t.assigned_to &&
    t.status !== 'Closed' &&
    t.status !== 'Resolved' &&
    t.status !== 'Cancelled'
  );

  function getActiveCount(userName: string) {
    return tickets.filter(
      t => t.assigned_to === userName &&
      t.status !== 'Closed' &&
      t.status !== 'Resolved' &&
      t.status !== 'Cancelled'
    ).length;
  }

  async function handleAssign(ticketId: number, ticketNumber: string) {
    const userId = assignments[ticketId];
    if (!userId) { alert('Please select a staff member first.'); return; }

    // ✅ Double-check: prevent assigning to requestor
    const ticket      = tickets.find(t => t.id === ticketId);
    const selectedStaff = assignableStaff.find(u => u.id === userId);
    if (ticket?.empno && selectedStaff?.empno === ticket.empno) {
      alert('Ticket cannot be assigned to the requestor.');
      return;
    }

    try {
      await api.patch(`/tickets/${ticketId}/assign`, { assigned_to: userId });
      showToast(`${ticketNumber} assigned successfully!`);
      const res = await api.get(isServiceAdmin ? '/tickets?serviceAdmin=true' : '/tickets');
      setTickets(res.data);
      setAssignments(prev => { const n = { ...prev }; delete n[ticketId]; return n; });
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to assign ticket.');
    }
  }


  async function handleReassign(ticketId: number, ticketNumber: string) {
    const userId = assignments[ticketId];
    if (!userId) { alert('Please select a staff member to reassign to.'); return; }

    // ✅ Double-check: prevent reassigning to requestor
    const ticket        = tickets.find(t => t.id === ticketId);
    const selectedStaff = assignableStaff.find(u => u.id === userId);
    if (ticket?.empno && selectedStaff?.empno === ticket.empno) {
      alert('Ticket cannot be reassigned to the requestor.');
      return;
    }

    try {
      await api.patch(`/tickets/${ticketId}/assign`, { assigned_to: userId });
      showToast(`${ticketNumber} reassigned successfully!`);
      const res = await api.get(isServiceAdmin ? '/tickets?serviceAdmin=true' : '/tickets');
      setTickets(res.data);
      setAssignments(prev => { const n = { ...prev }; delete n[ticketId]; return n; });
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reassign ticket.');
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function getInitials(name: string) {
    return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '??';
  }

  const MAX_TICKETS = 6;

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
      <div style={{ padding: 24, textAlign: 'center', color: '#888', fontSize: 'var(--text-sm)' }}>
        {isReassign ? '✓ No active assigned tickets.' : '✓ All tickets are assigned!'}
      </div>
    );
    return (
      <div style={{
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        minWidth: '600px',
      }}>
        <thead>
          <tr>
            {['Ticket #', 'Subject', 'Priority', 'Status',
              isReassign ? 'Assigned To' : '',
              'Re-assign To', 'Action',
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
          {data.map(t => (
            <tr key={t.id}
              onMouseEnter={e => (e.currentTarget.style.background = '#F5F8FC')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              <td style={{ padding: '7px 10px', fontWeight: 500, color: 'var(--gov-navy)', fontSize: 'var(--text-sm)' }}>
                {t.ticket_number}
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
                    {isReassign ? 'Select new staff...' : 'Select staff...'}
                  </option>
                  {assignableStaff
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
      </table>
      </div>
    );
  }

  return (
    <div style={{ minWidth: 0 }}>
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

      {/* STATS ROW */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 'clamp(8px, 2vw, 12px)',
        marginBottom: 18,
      }}>
        {[
          { label: 'Total Tickets',  value: tickets.length,              color: 'var(--gov-navy)'  },
          { label: 'Unassigned',     value: unassigned.length,           color: 'var(--gov-amber)' },
          { label: 'Active Staff',   value: assignableStaff.length,      color: 'var(--gov-green)' },
        ].map(s => (
          <div key={s.label} style={{
            background: '#fff',
            border: '0.5px solid #D0D9E4',
            borderRadius: 8,
            padding: 'clamp(10px, 2.5vw, 14px)',
            borderTop: `3px solid ${s.color}`,
          }}>
            <div style={{
              fontSize: 'clamp(9px, 1.8vw, 11px)',
              color: '#4A4A4A',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 6,
            }}>
              {s.label}
            </div>
            <div style={{
              fontSize: 'clamp(20px, 8vw, 32px)',
              fontWeight: 500,
              color: s.color,
            }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{
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
          {/* Tabs */}
          <div style={{
            display: 'flex', borderBottom: '0.5px solid #E5EAF0',
          }}>
            <button
              onClick={() => setActiveTab('unassigned')}
              style={{
                flex: 1,
                padding: 'clamp(8px, 2vw, 10px) clamp(10px, 2vw, 14px)',
                fontSize: 'clamp(9px, 1.8vw, 11px)',
                fontWeight: 500,
                background: activeTab === 'unassigned' ? 'var(--gov-navy)' : '#F8FAFC',
                color: activeTab === 'unassigned' ? '#fff' : '#4A4A4A',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              ⚠ Unassigned
              {unassigned.length > 0 && (
                <span style={{
                  background: activeTab === 'unassigned' ? 'rgba(255,255,255,0.25)' : '#CC7700',
                  color: '#fff',
                  fontSize: 'clamp(8px, 1.5vw, 10px)',
                  padding: '1px 6px',
                  borderRadius: 10,
                }}>
                  {unassigned.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('assigned')}
              style={{
                flex: 1,
                padding: 'clamp(8px, 2vw, 10px) clamp(10px, 2vw, 14px)',
                fontSize: 'clamp(9px, 1.8vw, 11px)',
                fontWeight: 500,
                background: activeTab === 'assigned' ? 'var(--gov-navy)' : '#F8FAFC',
                color: activeTab === 'assigned' ? '#fff' : '#4A4A4A',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              ↩ Re-assign
              {assigned.length > 0 && (
                <span style={{
                  background: activeTab === 'assigned' ? 'rgba(255,255,255,0.25)' : '#1A5490',
                  color: '#fff',
                  fontSize: 'clamp(8px, 1.5vw, 10px)',
                  padding: '1px 6px',
                  borderRadius: 10,
                }}>
                  {assigned.length}
                </span>
              )}
            </button>
          </div>

          {/* Table */}
          <TicketTable
            data={activeTab === 'unassigned' ? unassigned : assigned}
            isReassign={activeTab === 'assigned'}
          />
        </div>

        {/* RIGHT — Staff Workload */}
        <div style={{
          background: '#fff',
          border: '0.5px solid #D0D9E4',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          <div style={{
            background: 'var(--gov-navy)',
            padding: 'clamp(8px, 2vw, 10px) clamp(12px, 2.5vw, 16px)',
            fontSize: 'clamp(11px, 2vw, 13px)',
            fontWeight: 500,
            color: '#fff',
          }}>
            👥 Staff Workload
          </div>
          <div style={{
            padding: 'clamp(10px, 2vw, 16px)',
            overflowY: 'auto',
            maxHeight: 'clamp(300px, 60vh, 500px)',
          }}>
            {assignableStaff.length === 0 ? (
              <div style={{ fontSize: 'var(--text-sm)', color: '#888', textAlign: 'center', padding: 20 }}>
                No assignable technical staff found.
              </div>
            ) : assignableStaff.map(u => {
              const active = getActiveCount(u.full_name);
              const pct    = Math.round((active / MAX_TICKETS) * 100);
              const barColor = pct >= 80 ? 'var(--gov-red)'
                : pct >= 50 ? 'var(--gov-amber)'
                : 'var(--gov-green)';

              return (
                <div key={u.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 0',
                  borderBottom: '0.5px solid #EEF1F5',
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: '#E8F1FA', color: 'var(--gov-navy)',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 'var(--text-xs)',
                    fontWeight: 600, flexShrink: 0,
                  }}>
                    {getInitials(u.full_name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      marginBottom: 4,
                    }}>
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: '#1A2A3A' }}>
                        {u.full_name}
                      </span>
                      <span style={{ fontSize: 'var(--text-xs)', color: '#888' }}>
                        {active}/{MAX_TICKETS} tickets
                      </span>
                    </div>
                    <div style={{
                      height: 5, borderRadius: 3,
                      background: '#E8ECF0', overflow: 'hidden',
                      marginBottom: 3,
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        width: `${pct}%`, background: barColor,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    <span style={{ fontSize: 'var(--text-xs)', color: '#6A7280' }}>
                      {u.division}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20,
          background: 'var(--gov-green)', color: '#fff',
          padding: '10px 16px', borderRadius: 4,
          fontSize: 'var(--text-sm)', fontWeight: 500, zIndex: 200,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
