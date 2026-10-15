import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import TicketDetailModal from '../components/TicketDetailModal';


interface Ticket {
  id: number;
  ticket_number: string;
  subject: string;
  status: 'Open' | 'Assigned' | 'In Progress' | 'On-Hold' | 'Resolved' | 'Cancelled' | 'Closed';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  category: string;
  assigned_to: string | null;
  created_at: string;
  description?: string;
  requestor_name?: string;
  division?: string;
  unit?: string;
  office_location?: string;
  cancel_reason?: string;
}

export default function IctmsDashboard() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    api.get('/tickets').then(res => {
      setTickets(res.data);
      setLoading(false);
    });
  }, []);

  const open     = tickets.filter(t =>
    t.status === 'Open' || t.status === 'Assigned' || t.status === 'In Progress'
  ).length;
  const resolved = tickets.filter(t => t.status === 'Resolved').length;
  const critical = tickets.filter(t => t.priority === 'Critical').length;

  const assigned  = tickets.filter(t => t.status === 'Assigned').length;
  const inProgress = tickets.filter(t => t.status === 'In Progress').length;
  const onHold    = tickets.filter(t => t.status === 'On-Hold').length;
  const cancelled = tickets.filter(t => t.status === 'Cancelled').length;
  const closed    = tickets.filter(t => t.status === 'Closed').length;
  const totalExcludingCancelled = tickets.length - cancelled;

  const ticketStatCards = [
    { label: 'Total Tickets', value: tickets.length, sub: 'All tickets recorded, including cancelled tickets', color: 'var(--gov-navy)' },
    { label: 'Served Ticket', value: totalExcludingCancelled, sub: 'All valid tickets excluding cancelled request', color: '#1A5490' },
    { label: 'Open', value: tickets.filter(t => t.status === 'Open').length, sub: 'New tickets waiting to be assigned', color: '#CC7700' },
    { label: 'Assigned', value: assigned, sub: 'Tickets assigned to ICTMS personnel', color: '#087A5B' },
    { label: 'In Progress', value: inProgress, sub: 'Tickets currently being worked on', color: '#5B21B6' },
    { label: 'On-Hold', value: onHold, sub: 'Tickets temporarily paused or awaiting action', color: '#854F0B' },
    { label: 'Resolved', value: resolved, sub: 'Tickets completed and awaiting closure', color: 'var(--gov-green)' },
    { label: 'Cancelled', value: cancelled, sub: 'Requests cancelled by users or ICTMS', color: 'var(--gov-red)' },
    { label: 'Closed', value: closed, sub: 'Resolved tickets formally closed', color: '#4A4A4A' },
  ];


  const handleTicketClick = async (ticketId: number) => {
    try {
      const res = await api.get(`/tickets/${ticketId}`);
      setSelectedTicket(res.data);
    } catch (err) {
      console.error('Failed to load ticket:', err);
    }
  };

  const handleCloseModal = () => {
    setSelectedTicket(null);
  };

  const handleTicketResolved = () => {
    // Refresh ticket list
    api.get('/tickets').then(res => {
      setTickets(res.data);
    });
  };

  return (
    <div>
      {/* BREADCRUMB */}
      <div style={{
        fontSize: 'clamp(9px, 1.8vw, 11px)',
        color: '#4A4A4A',
        marginBottom: 14,
      }}>
        Home <span style={{ color: 'var(--gov-navy)', fontWeight: 500 }}>
          / Dashboard
        </span>
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
        Welcome back, <strong>{user?.full_name}</strong>. You have{' '}
        <strong>{open} open tickets</strong> in the system.
      </div>

      {/* STAT CARDS */}
      {loading ? (
        <div style={{
          color: 'var(--gov-navy)',
          padding: 'clamp(16px, 3vw, 20px)',
          fontSize: 'clamp(11px, 2vw, 13px)',
        }}>
          Loading stats...
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 'clamp(8px, 2vw, 12px)',
          marginBottom: 18,
        }}>
          {ticketStatCards.map(c => (
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
                fontSize: 'clamp(20px, 6vw, 28px)',
                fontWeight: 500,
                color: c.color,
              }}>
                {c.value}
              </div>
              <div style={{
                fontSize: 'clamp(8px, 1.5vw, 10px)',
                color: '#4A4A4A',
                marginTop: 4,
              }}>
                {c.sub}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* RECENT TICKETS */}
      <div style={{
        background: '#fff',
        border: '0.5px solid #D0D9E4',
        borderRadius: 8,
        padding: 'clamp(12px, 2.5vw, 16px)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: '0.5px solid #E5EAF0',
        }}>
          <span style={{
            fontSize: 'clamp(11px, 2vw, 13px)',
            fontWeight: 500,
            color: 'var(--gov-navy)',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            Recent Tickets
          </span>
        </div>
        {tickets.slice(0, 5).map(t => (
          <div key={t.id} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'clamp(6px, 1.5vw, 8px)',
            padding: 'clamp(6px, 1.5vw, 8px) 0',
            borderBottom: '0.5px solid #EEF1F5',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {/* ← TICKET NUMBER — CLICKABLE */}
            <button
              onClick={() => handleTicketClick(t.id)}
              style={{
                fontSize: 'clamp(8px, 1.5vw, 10px)',
                fontWeight: 600,
                color: 'var(--gov-navy)',
                minWidth: 'clamp(60px, 12vw, 80px)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
                textDecorationColor: 'transparent',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                (e.target as HTMLButtonElement).style.textDecorationColor = 'var(--gov-navy)';
              }}
              onMouseLeave={e => {
                (e.target as HTMLButtonElement).style.textDecorationColor = 'transparent';
              }}
            >
              {t.ticket_number}
            </button>

            <span style={{
              fontSize: 'clamp(10px, 1.8vw, 12px)',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {t.subject}
            </span>
            <span style={{
              fontSize: 'clamp(7px, 1.2vw, 9px)',
              padding: '2px clamp(4px, 1vw, 8px)',
              borderRadius: 3,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              background:
                t.status === 'Open'        ? '#E8F1FA' :
                t.status === 'Assigned'    ? '#E1F5EE' :
                t.status === 'In Progress' ? '#FEF3DC' :
                t.status === 'On-Hold'     ? '#FDF5DC' :
                t.status === 'Resolved'    ? '#E8F5EE' :
                t.status === 'Cancelled'   ? '#FDE8E8' :
                t.status === 'Closed'      ? '#F0F0F0' :
                '#F0F0F0',
              color:
                t.status === 'Open'        ? '#0D3B6E' :
                t.status === 'Assigned'    ? '#085041' :
                t.status === 'In Progress' ? '#CC7700' :
                t.status === 'On-Hold'     ? '#854F0B' :
                t.status === 'Resolved'    ? '#1B6B3A' :
                t.status === 'Cancelled'   ? '#8B1A1A' :
                t.status === 'Closed'      ? '#4A4A4A' :
                '#4A4A4A',
            }}>
              {t.status}
            </span>
          </div>
        ))}
      </div>

      {/* TICKET DETAIL MODAL */}
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={handleCloseModal}
          onResolved={handleTicketResolved}
        />
      )}
    </div>
  );
}
