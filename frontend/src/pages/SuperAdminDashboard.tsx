import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';


interface Ticket {
  id: number;
  ticket_number: string;
  subject: string;
  status: 'Open' | 'Assigned' | 'In Progress' | 'On-Hold' | 'Resolved' | 'Cancelled' | 'Closed';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  created_at: string;
  assigned_to?: string | null;
  service_area_id?: number | null;
  service_area_code?: string | null;
}
interface ServiceArea { id: number; code: string; name: string; is_active: number; }

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const isServiceAdmin = user?.role !== 'super_admin' && (user?.area_admin_service_ids?.length ?? 0) > 0;
  const managedAreaIds = user?.area_admin_service_ids || [];
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [csmCount, setCsmCount] = useState(0);
  const [kbCount, setKbCount]   = useState(0);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [serviceAreaFilter, setServiceAreaFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get('/tickets'),
      api.get('/users'),
      api.get('/csm'),
      api.get('/knowledge-base'),
      api.get('/service-areas'),
    ]).then(([ticketResult, userResult, csmResult, kbResult, serviceAreaResult]) => {
      if (ticketResult.status === 'fulfilled') setTickets(ticketResult.value.data);
      if (userResult.status === 'fulfilled') setUsers(userResult.value.data);
      if (csmResult.status === 'fulfilled') setCsmCount(csmResult.value.data.length);
      if (kbResult.status === 'fulfilled') setKbCount(kbResult.value.data.length);
      if (serviceAreaResult.status === 'fulfilled') setServiceAreas(serviceAreaResult.value.data.filter((area: ServiceArea) => !isServiceAdmin || managedAreaIds.includes(area.id)));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isServiceAdmin && managedAreaIds.length === 1) setServiceAreaFilter(String(managedAreaIds[0]));
  }, [isServiceAdmin, user?.id]);

  const scopedTickets = isServiceAdmin ? tickets.filter(ticket => managedAreaIds.includes(Number(ticket.service_area_id))) : tickets;
  const displayedTickets = serviceAreaFilter === 'all' ? scopedTickets : scopedTickets.filter(ticket => String(ticket.service_area_id) === serviceAreaFilter);
  const open      = displayedTickets.filter(t => t.status === 'Open').length;
  const inProg    = displayedTickets.filter(t => t.status === 'In Progress').length;
  const resolved  = displayedTickets.filter(t => t.status === 'Resolved').length;
  const critical  = displayedTickets.filter(t => t.priority === 'Critical').length;
  const closed    = displayedTickets.filter(t => t.status === 'Closed').length;
  const assigned   = displayedTickets.filter(t => t.status === 'Assigned').length;
  const onHold     = displayedTickets.filter(t => t.status === 'On-Hold').length;
  const cancelled  = displayedTickets.filter(t => t.status === 'Cancelled').length;
  const totalExcludingCancelled = displayedTickets.length - cancelled;

  const ticketStatCards = [
    { label: 'Total Tickets', value: displayedTickets.length, sub: serviceAreaFilter === 'all' ? 'All tickets recorded, including cancelled tickets' : 'Tickets for the selected service area', color: 'var(--gov-navy)' },
    { label: 'Served Ticket', value: totalExcludingCancelled, sub: 'All valid tickets excluding cancelled request', color: '#1A5490' },
    { label: 'Open', value: open, sub: 'New tickets waiting to be assigned', color: '#CC7700' },
    { label: 'Assigned', value: assigned, sub: 'Tickets assigned to service desk personnel', color: '#087A5B' },
    { label: 'In Progress', value: inProg, sub: 'Tickets currently being worked on', color: '#5B21B6' },
    { label: 'On-Hold', value: onHold, sub: 'Tickets temporarily paused or awaiting action', color: '#854F0B' },
    { label: 'Resolved', value: resolved, sub: 'Tickets completed and awaiting closure', color: 'var(--gov-green)' },
    { label: 'Cancelled', value: cancelled, sub: 'Requests cancelled by users or service desk staff', color: 'var(--gov-red)' },
    { label: 'Closed', value: closed, sub: 'Resolved tickets formally closed', color: '#4A4A4A' },
  ];

  const unassigned = displayedTickets.filter(
    t => !t.assigned_to &&
    t.status !== 'Closed' &&
    t.status !== 'Resolved'
  ).length;
  const serviceDeskStaff = users.filter(u => u.role === 'ictms_staff').length;
  const recent = displayedTickets.slice(0, 5);

  const personalTicketTiles = [
    {
      icon: '➕', label: 'Submit a Ticket',
      sub: 'Create a support request for yourself',
      bg: '#E8F5EE', path: '/submit',
    },
    {
      icon: '📋', label: 'My Submitted Tickets',
      sub: 'Track tickets you submitted for yourself',
      bg: '#FEF3DC', path: '/my-requests',
    },
    {
      icon: '🛠️', label: 'Assigned to Me',
      sub: 'Work tickets assigned to you as technical staff',
      bg: '#F3F0FF', path: '/my-tickets',
    },
  ];

  // System-wide ticket and reporting tools
  const quickTiles = [
    {
      icon: '🎫', label: 'Ticket List',
      sub: `${tickets.length} total ticket${tickets.length !== 1 ? 's' : ''}`,
      bg: '#E8F1FA', path: '/tickets',
    },
    {
      icon: '⚙', label: 'Admin Management',
      sub: `${unassigned} unassigned ticket${unassigned !== 1 ? 's' : ''}`,
      bg: '#E8F5EE', path: '/admin',
    },
    {
      icon: '📋', label: 'CSM Reports',
      sub: `${csmCount} response${csmCount !== 1 ? 's' : ''} submitted`,
      bg: '#FDE8E8', path: '/csm-reports',
    },
    {
      icon: '📥', label: 'Download Hub',
      sub: 'Service forms and templates',
      bg: '#E8F1FA', path: '/templates',
    },
    {
      icon: '📚', label: 'Knowledge Base',
      sub: `${kbCount} article${kbCount !== 1 ? 's' : ''} available`,
      bg: '#F3F0FF', path: '/kb',
    },
    {
      icon: '📊', label: 'Ticket Monitoring',
      sub: 'SLA tracking & alerts',
      bg: '#FDE8E8', path: '/monitoring',
    },
  ];

  // Settings tiles
  const settingsTiles = [
    {
      icon: '👥', label: 'User Management',
      sub: `${users.length} active user${users.length !== 1 ? 's' : ''}`,
      bg: '#FEF3DC', path: '/users',
    },
    {
      icon: '🏷️', label: 'Status Management',
      sub: 'Manage ticket statuses',
      bg: '#EEF0F5', path: '/statuses',
    },
    {
      icon: '📂', label: 'Category Management',
      sub: 'Manage the service catalog',
      bg: '#E8F5EE', path: '/categories',
    },
    {
      icon: '🏢', label: 'Service Areas & Staff',
      sub: 'Configure ICT, BGMS, and scoped staff roles',
      bg: '#E8F1FA', path: '/service-areas',
    },
    {
      icon: '⏱', label: 'SLA Management',
      sub: 'Response & resolution times',
      bg: '#FDE8E8', path: '/sla',
    },
    {
      icon: '📚', label: 'KB Management',
      sub: 'Manage knowledge base articles',
      bg: '#F3F0FF', path: '/admin/knowledge_base',
    },
    {
      icon: '📄', label: 'Service Templates',
      sub: 'Publish request forms and templates',
      bg: '#E8F1FA', path: '/service-templates',
    },
  ];
  const visibleSettingsTiles = isServiceAdmin
    ? settingsTiles.filter(tile => ['User Management', 'Category Management', 'SLA Management', 'KB Management', 'Service Templates'].includes(tile.label))
    : settingsTiles;

  if (loading) return (
    <div style={{ color: 'var(--gov-navy)', padding: 40, textAlign: 'center' }}>
      Loading dashboard...
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
        Home <span style={{ color: 'var(--gov-navy)', fontWeight: 500 }}>
          / {isServiceAdmin ? 'Service Admin Dashboard' : 'Super Admin Dashboard'}
        </span>
      </div>

      {/* WELCOME STRIP */}
      <div style={{
        background: '#E8F1FA',
        borderLeft: '3px solid var(--gov-navy)',
        borderRadius: '0 4px 4px 0',
        padding: 'clamp(8px, 2vw, 12px)',
        fontSize: 'clamp(9px, 1.8vw, 11px)',
        color: 'var(--gov-navy)',
        marginBottom: 14,
      }}>
        Welcome back, <strong>{user?.full_name}</strong>.
        {isServiceAdmin ? 'Here is the overview for your assigned service area.' : 'Here is a full system overview for today.'}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12, padding: '10px 12px', border: '1px solid #D0D9E4', borderRadius: 8, background: '#fff' }}>
        <div><strong style={{ color: 'var(--gov-navy)' }}>Ticket Overview</strong><span style={{ marginLeft: 8, color: '#62748A', fontSize: 'var(--text-xs)' }}>{serviceAreaFilter === 'all' ? (isServiceAdmin ? 'Your assigned service-area totals' : 'FO3-wide ticket totals') : 'Selected service-area ticket totals'}</span></div>
        <select value={serviceAreaFilter} onChange={e => setServiceAreaFilter(e.target.value)} style={{ padding: '7px 10px', border: '1px solid #C8D0DC', borderRadius: 4, background: '#fff', color: '#172B4D' }}>
          {managedAreaIds.length !== 1 && <option value="all">All service areas</option>}
          {serviceAreas.filter(area => area.is_active).map(area => <option key={area.id} value={area.id}>{area.code} — {area.name}</option>)}
        </select>
      </div>

      {/* STAT CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 'clamp(8px, 2vw, 12px)',
        marginBottom: 16,
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
              marginBottom: 4,
              fontWeight: 500,
            }}>
              {c.label}
            </div>
            <div style={{
              fontSize: 'clamp(20px, 6vw, 26px)',
              fontWeight: 500,
              color: c.color,
            }}>
              {c.value}
            </div>
            <div style={{
              fontSize: 'clamp(8px, 1.5vw, 11px)',
              color: '#888',
              marginTop: 3,
            }}>
              {c.sub}
            </div>
          </div>
        ))}
      </div>

      {[
        { title: 'My Ticket Workspace', tiles: personalTicketTiles },
        { title: 'Quick Access', tiles: quickTiles },
      ].map(section => (
        <div key={section.title}>
          <div style={{
            fontSize: 'clamp(9px, 1.8vw, 12px)',
            color: '#4A4A4A',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 8,
            fontWeight: 500,
          }}>
            {section.title}
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 'clamp(8px, 2vw, 12px)',
            marginBottom: 20,
          }}>
            {section.tiles.map(tile => (
          <div
            key={tile.label}
            onClick={() => navigate(tile.path)}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gov-navy)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#D0D9E4')}
            style={{
              background: '#fff',
              border: '0.5px solid #D0D9E4',
              borderRadius: 8,
              padding: 'clamp(10px, 2vw, 14px)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'clamp(6px, 1.5vw, 8px)',
              textAlign: 'center',
              transition: 'border-color 0.15s',
            }}
          >
            <div style={{
              width: 'clamp(36px, 8vw, 42px)',
              height: 'clamp(36px, 8vw, 42px)',
              borderRadius: 10,
              background: tile.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'clamp(18px, 4vw, 23px)',
            }}>
              {tile.icon}
            </div>
            <div style={{
              fontSize: 'clamp(9px, 1.8vw, 11px)',
              fontWeight: 500,
              color: '#1A2A3A',
            }}>
              {tile.label}
            </div>
            <div style={{
              fontSize: 'clamp(8px, 1.5vw, 11px)',
              color: '#6A7280',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}>
              {tile.sub}
            </div>
          </div>
            ))}
          </div>
        </div>
      ))}

      {/* SETTINGS SECTION */}
      <div style={{
        fontSize: 'clamp(9px, 1.8vw, 12px)',
        color: '#4A4A4A',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
        fontWeight: 500,
      }}>
        Settings
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 'clamp(8px, 2vw, 12px)',
        marginBottom: 20,
      }}>
        {visibleSettingsTiles.map(tile => (
          <div
            key={tile.label}
            onClick={() => navigate(tile.path)}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--gov-navy)';
              e.currentTarget.style.background = '#F5F8FC';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#D0D9E4';
              e.currentTarget.style.background = '#fff';
            }}
            style={{
              background: '#fff',
              border: '0.5px solid #D0D9E4',
              borderLeft: '3px solid var(--gov-navy)',
              borderRadius: 8,
              padding: 'clamp(10px, 2vw, 14px)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 'clamp(8px, 2vw, 12px)',
              transition: 'all 0.15s',
              minHeight: 'auto',
            }}
          >
            <div style={{
              width: 'clamp(32px, 7vw, 38px)',
              height: 'clamp(32px, 7vw, 38px)',
              borderRadius: 8,
              background: tile.bg,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'clamp(18px, 4vw, 23px)',
            }}>
              {tile.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 'clamp(9px, 1.8vw, 13px)',
                fontWeight: 500,
                color: '#1A2A3A',
              }}>
                {tile.label}
              </div>
              <div style={{
                fontSize: 'clamp(8px, 1.5vw, 11px)',
                color: '#6A7280',
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {tile.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* BOTTOM — System Health + Recent Tickets */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 'clamp(8px, 2vw, 12px)',
      }}>

        {/* SYSTEM HEALTH */}
        <div style={{
          background: '#fff',
          border: '0.5px solid #D0D9E4',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          <div style={{
            background: 'var(--gov-navy)',
            padding: 'clamp(8px, 2vw, 12px)',
            fontSize: 'clamp(9px, 1.8vw, 11px)',
            fontWeight: 500,
            color: '#fff',
          }}>
            System Health
          </div>
          <div style={{ padding: 'clamp(8px, 2vw, 12px)' }}>
            {[
              { label: 'Total Users',           value: users.length,  color: 'var(--gov-navy)'  },
              { label: 'Service Desk Staff', value: serviceDeskStaff, color: 'var(--gov-green)' },
              { label: 'CSM Responses',          value: csmCount,      color: 'var(--gov-amber)' },
              {
                label: 'Unassigned Tickets',
                value: unassigned,
                color: unassigned > 0 ? 'var(--gov-red)' : 'var(--gov-green)',
              },
              { label: 'Closed Tickets',         value: closed,        color: '#888'             },
            ].map(row => (
              <div key={row.label} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 'clamp(6px, 1.5vw, 8px) 0',
                borderBottom: '0.5px solid #EEF1F5',
              }}>
                <span style={{
                  fontSize: 'clamp(8px, 1.5vw, 11px)',
                  color: '#3A3A3A',
                }}>
                  {row.label}
                </span>
                <span style={{
                  fontSize: 'clamp(11px, 2vw, 14px)',
                  fontWeight: 500,
                  color: row.color,
                }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* RECENT TICKETS */}
        <div style={{
          background: '#fff',
          border: '0.5px solid #D0D9E4',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          <div style={{
            background: 'var(--gov-navy)',
            padding: 'clamp(8px, 2vw, 12px)',
            fontSize: 'clamp(9px, 1.8vw, 11px)',
            fontWeight: 500,
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span>Recent Tickets</span>
            <button
              onClick={() => navigate('/tickets')}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: 4,
                padding: '3px clamp(6px, 1.5vw, 8px)',
                color: '#fff',
                fontSize: 'clamp(8px, 1.5vw, 10px)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              View All →
            </button>
          </div>
          <div style={{ padding: 'clamp(8px, 2vw, 12px)' }}>
            {recent.length === 0 ? (
              <div style={{
                padding: 'clamp(16px, 5vw, 24px)',
                textAlign: 'center',
                color: '#888',
                fontSize: 'clamp(11px, 2vw, 13px)',
              }}>
                No tickets yet.
              </div>
            ) : recent.map(t => (
              <div key={t.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'clamp(6px, 1.5vw, 8px)',
                padding: 'clamp(6px, 1.5vw, 8px) 0',
                borderBottom: '0.5px solid #EEF1F5',
                minWidth: 0,
              }}>
                <span style={{
                  fontSize: 'clamp(8px, 1.5vw, 11px)',
                  fontWeight: 500,
                  color: 'var(--gov-navy)',
                  minWidth: 'clamp(60px, 15vw, 72px)',
                  flexShrink: 0,
                }}>
                  {t.ticket_number}
                </span>
                <span style={{
                  fontSize: 'clamp(8px, 1.5vw, 11px)',
                  flex: 1,
                  color: '#2A2A2A',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {t.subject}
                </span>
                <span style={{
                  fontSize: 'clamp(7px, 1.2vw, 10px)',
                  padding: '2px clamp(4px, 1vw, 6px)',
                  borderRadius: 3,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  background:
                    t.status === 'Open'        ? '#E8F1FA' :
                    t.status === 'In Progress' ? '#FEF3DC' :
                    t.status === 'Resolved'    ? '#E8F5EE' : '#F0F0F0',
                  color:
                    t.status === 'Open'        ? '#0D3B6E' :
                    t.status === 'In Progress' ? '#CC7700' :
                    t.status === 'Resolved'    ? '#1B6B3A' : '#666',
                  flexShrink: 0,
                }}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
