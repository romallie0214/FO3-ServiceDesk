import { Fragment, useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';


interface SLARule {
  id: number;
  service_area_id: number;
  service_area_name?: string;
  service_area_code?: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  impact_level: 'Enterprise-wide' | 'Departmental' | 'Individual';
  response_time_hours: number;
  resolution_time_hours: number;
  escalation_time_hours: number;
  is_active: number;
  description: string;
}
interface ServiceArea { id: number; code: string; name: string; is_active: number; }

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
const IMPACTS    = ['Enterprise-wide', 'Departmental', 'Individual'] as const;

const PRIORITY_STYLE: Record<string, React.CSSProperties> = {
  Critical: { background: '#FDE8E8', color: '#8B1A1A' },
  High:     { background: '#FEF3DC', color: '#CC7700' },
  Medium:   { background: '#E8F1FA', color: '#0D3B6E' },
  Low:      { background: '#F0F0F0', color: '#4A4A4A' },
};

const IMPACT_STYLE: Record<string, React.CSSProperties> = {
  'Enterprise-wide': { background: '#FDE8E8', color: '#8B1A1A' },
  'Departmental':    { background: '#FEF3DC', color: '#CC7700' },
  'Individual':      { background: '#E8F5EE', color: '#1B6B3A' },
};

const inputStyle: React.CSSProperties = {
  padding: 'clamp(5px, 1.5vw, 7px) clamp(8px, 1.5vw, 10px)',
  border: '1px solid #C8D0DC',
  borderRadius: 4,
  fontSize: 'clamp(10px, 1.8vw, 12px)',
  width: '100%',
  background: '#fff',
  color: '#2A2A2A',
};

const labelStyle: React.CSSProperties = {
  fontSize: 'clamp(8px, 1.5vw, 10px)',
  fontWeight: 500,
  color: '#5A6475',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  display: 'block',
  marginBottom: 4,
};

function formatTime(hours: number): string {
  if (hours < 1)  return `${Math.round(hours * 60)} mins`;
  if (hours < 24) return `${hours} hr${hours !== 1 ? 's' : ''}`;
  const days = hours / 24;
  return `${days} day${days !== 1 ? 's' : ''}`;
}

const EMPTY_FORM = {
  priority:               'Critical' as SLARule['priority'],
  impact_level:           'Enterprise-wide' as SLARule['impact_level'],
  response_time_hours:    1,
  resolution_time_hours:  4,
  escalation_time_hours:  2,
  is_active:              1,
  description:            '',
  service_area_id:        '',
};

export default function SLAManagement() {
  const { user } = useAuth();
  const managedAreaIds = user?.role === 'super_admin' ? null : (user?.area_admin_service_ids || []);
  const [rules, setRules]             = useState<SLARule[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [editRule, setEditRule]       = useState<SLARule | null>(null);
  const [form, setForm]               = useState({ ...EMPTY_FORM });
  const [saving, setSaving]           = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SLARule | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const [toast, setToast]             = useState({ msg: '', type: '' });
  const [filterPriority, setFilterPriority] = useState('');
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [serviceAreaFilter, setServiceAreaFilter] = useState('all');

  useEffect(() => { fetchRules(); api.get('/service-areas').then(res => setServiceAreas(res.data.filter((area: ServiceArea) => !managedAreaIds || managedAreaIds.includes(area.id)))).catch(() => setServiceAreas([])); }, []);

  useEffect(() => { if (managedAreaIds?.length) setServiceAreaFilter(String(managedAreaIds[0])); }, [user?.id]);

  async function fetchRules() {
    try {
      const res = await api.get('/sla');
      setRules(res.data);
    } catch {
      showToast('Failed to load SLA rules.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: '' }), 3000);
  }

  function openCreate() {
    setEditRule(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  }

  function openEdit(rule: SLARule) {
    setEditRule(rule);
    setForm({
      priority:              rule.priority,
      impact_level:          rule.impact_level,
      response_time_hours:   Number(rule.response_time_hours),
      resolution_time_hours: Number(rule.resolution_time_hours),
      escalation_time_hours: Number(rule.escalation_time_hours),
      is_active:             rule.is_active,
      description:           rule.description ?? '',
      service_area_id:       String(rule.service_area_id ?? ''),
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.service_area_id) {
      alert('Select a service area.'); return;
    }
    if (Number(form.response_time_hours) <= 0) {
      alert('Response time must be greater than 0.'); return;
    }
    if (Number(form.resolution_time_hours) <= Number(form.response_time_hours)) {
      alert('Resolution time must be greater than response time.'); return;
    }
    setSaving(true);
    try {
      if (editRule) {
        await api.put(`/sla/${editRule.id}`, form);
        showToast('SLA rule updated successfully.');
      } else {
        await api.post('/sla', form);
        showToast('SLA rule created successfully.');
      }
      setShowModal(false);
      fetchRules();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save SLA rule.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(rule: SLARule) {
    try {
      await api.patch(`/sla/${rule.id}/toggle`);
      showToast(`SLA rule ${rule.is_active ? 'deactivated' : 'activated'}.`);
      fetchRules();
    } catch {
      showToast('Failed to toggle status.', 'error');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/sla/${deleteTarget.id}`);
      showToast('SLA rule deleted.');
      setDeleteTarget(null);
      fetchRules();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete.');
    } finally {
      setDeleting(false);
    }
  }

  const scopedRules = managedAreaIds ? rules.filter(rule => managedAreaIds.includes(Number(rule.service_area_id))) : rules;
  const filtered = filterPriority
    ? scopedRules.filter(r => r.priority === filterPriority)
    : scopedRules;
  const visibleRules = serviceAreaFilter === 'all' ? filtered : filtered.filter(rule => String(rule.service_area_id) === serviceAreaFilter);

  const activeCount   = rules.filter(r => r.is_active).length;
  const criticalRule  = rules.find(r =>
    r.priority === 'Critical' && r.impact_level === 'Enterprise-wide'
  );
  const highRule      = rules.find(r =>
    r.priority === 'High' && r.impact_level === 'Enterprise-wide'
  );

  if (loading) return (
    <div style={{ color: 'var(--gov-navy)', padding: 40, textAlign: 'center' }}>
      Loading SLA rules...
    </div>
  );

  return (
    <div>
      {/* BREADCRUMB */}
      <div style={{
        fontSize: 'clamp(9px, 1.8vw, 11px)',
        color: '#4A4A4A',
        marginBottom: 'clamp(10px, 2vw, 14px)',
      }}>
        Home <span style={{ color: 'var(--gov-navy)', fontWeight: 500 }}>
          / SLA Management
        </span>
      </div>

      {/* INFO STRIP + ADD BUTTON */}
      <div style={{
        background: '#E8F1FA',
        borderLeft: '3px solid var(--gov-navy)',
        borderRadius: '0 4px 4px 0',
        padding: 'clamp(8px, 2vw, 12px)',
        fontSize: 'clamp(9px, 1.8vw, 12px)',
        color: 'var(--gov-navy)',
        marginBottom: 'clamp(10px, 2vw, 14px)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 'clamp(8px, 2vw, 12px)',
        flexWrap: 'wrap',
        lineHeight: 1.5,
      }}>
        <span>
          Define response and resolution times based on{' '}
          <strong>Priority</strong> and <strong>Impact Level</strong>.
          Each service area can define its own Priority + Impact SLA rules.
        </span>
        <button
          onClick={openCreate}
          style={{
            padding: 'clamp(5px, 1.5vw, 8px) clamp(10px, 2vw, 14px)',
            fontSize: 'clamp(10px, 1.8vw, 12px)',
            background: 'var(--gov-green)',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            flex: '0 0 auto',
          }}
        >
          + Add SLA Rule
        </button>
      </div>

      {/* STAT CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 'clamp(8px, 2vw, 12px)',
        marginBottom: 18,
      }}>
        {[
          {
            label: 'Total SLA Rules',
            value: rules.length,
            sub: 'Configured rules',
            color: 'var(--gov-navy)',
          },
          {
            label: 'Critical SLA',
            value: criticalRule
              ? `${formatTime(criticalRule.response_time_hours)} / ${formatTime(criticalRule.resolution_time_hours)}`
              : 'Not set',
            sub: 'Response / Resolution',
            color: 'var(--gov-red)',
          },
          {
            label: 'High SLA',
            value: highRule
              ? `${formatTime(highRule.response_time_hours)} / ${formatTime(highRule.resolution_time_hours)}`
              : 'Not set',
            sub: 'Response / Resolution',
            color: 'var(--gov-amber)',
          },
          {
            label: 'Active Rules',
            value: activeCount,
            sub: `${rules.length - activeCount} inactive`,
            color: 'var(--gov-green)',
          },
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
              marginBottom: 4,
              fontWeight: 500,
            }}>
              {c.label}
            </div>
            <div style={{
              fontSize: typeof c.value === 'string' && c.value.includes('/')
                ? 'clamp(12px, 2vw, 14px)'
                : 'clamp(18px, 5vw, 22px)',
              fontWeight: 500,
              color: c.color,
              lineHeight: 1.2,
            }}>
              {c.value}
            </div>
            <div style={{
              fontSize: 'clamp(8px, 1.5vw, 10px)',
              color: '#888',
              marginTop: 4,
            }}>
              {c.sub}
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
        marginBottom: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 'clamp(6px, 1.5vw, 10px)',
        flexWrap: 'wrap',
      }}>
        <span style={{
          fontSize: 'clamp(9px, 1.8vw, 11px)',
          color: '#4A4A4A',
          whiteSpace: 'nowrap',
          fontWeight: 500,
        }}>
          Filter by Priority:
        </span>
        {['', ...PRIORITIES].map(p => (
          <button
            key={p}
            onClick={() => setFilterPriority(p)}
            style={{
              padding: 'clamp(3px, 1vw, 4px) clamp(8px, 1.5vw, 12px)',
              fontSize: 'clamp(8px, 1.5vw, 10px)',
              background: filterPriority === p
                ? 'var(--gov-navy)' : '#F0F3F7',
              color: filterPriority === p ? '#fff' : '#4A4A4A',
              border: filterPriority === p
                ? '1px solid var(--gov-navy)' : '1px solid #D0D9E4',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: filterPriority === p ? 500 : 400,
              whiteSpace: 'nowrap',
            }}
          >
            {p || 'All'}
          </button>
        ))}
        <select value={serviceAreaFilter} onChange={e => setServiceAreaFilter(e.target.value)} style={{ ...inputStyle, width: 220 }}>
          {!managedAreaIds && <option value="all">All service areas</option>}
          {serviceAreas.filter(area => area.is_active).map(area => <option key={area.id} value={area.id}>{area.code} — {area.name}</option>)}
        </select>
        <span style={{
          marginLeft: 'auto',
          fontSize: 'clamp(8px, 1.5vw, 10px)',
          color: '#888',
          whiteSpace: 'nowrap',
          flex: '0 1 auto',
        }}>
          {visibleRules.length} rule{visibleRules.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* SLA TABLE */}
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
            minWidth: '920px',
          }}>
            <thead>
              <tr>
                {[
                  'Service Area', 'Priority', 'Impact Level', 'Response Time',
                  'Resolution Time', 'Escalation Time',
                  'Description', 'Status', 'Actions',
                ].map(h => (
                  <th key={h} style={{
                    textAlign: 'left',
                    padding: 'clamp(6px, 1.5vw, 9px) clamp(8px, 2vw, 12px)',
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
              {visibleRules.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{
                    textAlign: 'center',
                    padding: 'clamp(20px, 5vw, 32px)',
                    color: '#888',
                    fontSize: 'clamp(11px, 2vw, 13px)',
                  }}>
                    No SLA rules found.
                  </td>
                </tr>
              ) : visibleRules.map((rule, index) => (
                <Fragment key={rule.id}>
                {serviceAreaFilter === 'all' && (index === 0 || visibleRules[index - 1].service_area_id !== rule.service_area_id) && <tr key={`group-${rule.service_area_id}`}><td colSpan={9} style={{ padding: '8px 12px', background: '#E8F1FA', borderTop: '1px solid #C7D8EA', borderBottom: '1px solid #C7D8EA', color: '#0D3B6E', fontWeight: 700, fontSize: 'var(--text-xs)' }}>{rule.service_area_code || 'UNASSIGNED'} — {rule.service_area_name || 'Unassigned Service Area'}</td></tr>}
                <tr
                  key={rule.id}
                  style={{ opacity: rule.is_active ? 1 : 0.5 }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F5F8FC')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                >
                  <td style={{ padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 12px)', fontSize: 'var(--text-xs)', fontWeight: 600, color: '#0D3B6E' }}>{rule.service_area_code || rule.service_area_name || 'Unassigned'}</td>
                  {/* Priority */}
                  <td style={{
                    padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 12px)',
                  }}>
                    <span style={{
                      ...PRIORITY_STYLE[rule.priority],
                      fontSize: 'clamp(7px, 1.2vw, 9px)',
                      padding: '2px 8px',
                      borderRadius: 3,
                      fontWeight: 500,
                    }}>
                      {rule.priority}
                    </span>
                  </td>

                  {/* Impact */}
                  <td style={{
                    padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 12px)',
                  }}>
                    <span style={{
                      ...IMPACT_STYLE[rule.impact_level],
                      fontSize: 'clamp(7px, 1.2vw, 9px)',
                      padding: '2px 8px',
                      borderRadius: 3,
                      fontWeight: 500,
                    }}>
                      {rule.impact_level}
                    </span>
                  </td>

                  {/* Response */}
                  <td style={{
                    padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 12px)',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--gov-amber)',
                        flexShrink: 0,
                      }} />
                      <span style={{
                        fontSize: 'clamp(9px, 1.8vw, 11px)',
                        fontWeight: 500,
                        color: '#2A2A2A',
                      }}>
                        {formatTime(Number(rule.response_time_hours))}
                      </span>
                    </div>
                  </td>

                  {/* Resolution */}
                  <td style={{ padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 12px)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: 'var(--gov-green)', flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 'clamp(10px, 1.8vw, 12px)', fontWeight: 500, color: '#2A2A2A' }}>
                        {formatTime(Number(rule.resolution_time_hours))}
                      </span>
                    </div>
                  </td>

                  {/* Escalation */}
                  <td style={{ padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 12px)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: 'var(--gov-red)', flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 'clamp(10px, 1.8vw, 12px)', fontWeight: 500, color: '#2A2A2A' }}>
                        {formatTime(Number(rule.escalation_time_hours))}
                      </span>
                    </div>
                  </td>

                  {/* Description */}
                  <td style={{
                    padding: '10px 12px', fontSize: 'clamp(8px, 1.5vw, 10px)',
                    color: '#5A6475', maxWidth: 200,
                  }}>
                    <span style={{
                      display: 'block', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {rule.description || '—'}
                    </span>
                  </td>

                  {/* Status toggle */}
                  <td style={{ padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 12px)' }}>
                    <button
                      onClick={() => handleToggle(rule)}
                      style={{
                        fontSize: 'clamp(8px, 1.5vw, 10px)', padding: '2px 8px',
                        borderRadius: 3, fontWeight: 500,
                        cursor: 'pointer', border: 'none',
                        background: rule.is_active ? '#E8F5EE' : '#F0F0F0',
                        color: rule.is_active ? '#1B6B3A' : '#666',
                      }}
                    >
                      {rule.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: 'clamp(6px, 1.5vw, 10px) clamp(8px, 2vw, 12px)' }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button
                        onClick={() => openEdit(rule)}
                        style={{
                          padding: '4px 10px', fontSize: 'clamp(8px, 1.5vw, 10px)',
                          background: 'var(--gov-navy)', color: '#fff',
                          border: 'none', borderRadius: 4, cursor: 'pointer',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(rule)}
                        style={{
                          padding: '4px 10px', fontSize: 'clamp(8px, 1.5vw, 10px)',
                          background: '#FDE8E8', color: '#8B1A1A',
                          border: '1px solid #F5C0C0',
                          borderRadius: 4, cursor: 'pointer',
                        }}
                      >
                        Del
                      </button>
                    </div>
                  </td>
                </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== ADD / EDIT MODAL ===== */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,20,0.55)',
            zIndex: 200, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              width: 'clamp(90vw, 95vw, 520px)',
              maxWidth: '95vw',
              borderRadius: 10,
              border: '0.5px solid #C0C8D4',
              overflow: 'hidden',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div style={{
              background: 'var(--gov-navy)',
              padding: 'clamp(10px, 2vw, 14px) clamp(14px, 3vw, 20px)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
              flexShrink: 0,
            }}>
              <p style={{
                color: '#fff',
                fontSize: 'clamp(12px, 2vw, 15px)',
                fontWeight: 600,
                margin: 0,
              }}>
                {editRule ? 'Edit SLA Rule' : 'New SLA Rule'}
              </p>
              <button onClick={() => setShowModal(false)} style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: 4,
                width: 'clamp(24px, 6vw, 28px)',
                height: 'clamp(24px, 6vw, 28px)',
                color: '#fff',
                fontSize: 'clamp(16px, 3vw, 20px)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>×</button>
            </div>

            {/* Modal Body */}
            <div style={{
              padding: 'clamp(12px, 3vw, 20px)',
              overflowY: 'auto',
              flex: 1,
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 'clamp(10px, 2vw, 12px)',
                marginBottom: 'clamp(10px, 2vw, 14px)',
              }}>
                <div>
                  <label style={labelStyle}>Service Area <span style={{ color: '#8B1A1A' }}>*</span></label>
                  <select value={form.service_area_id} onChange={e => setForm(p => ({ ...p, service_area_id: e.target.value }))} style={inputStyle}>
                    <option value="">Select a service area</option>
                    {serviceAreas.filter(area => area.is_active).map(area => <option key={area.id} value={area.id}>{area.code} — {area.name}</option>)}
                  </select>
                </div>
                {/* Priority */}
                <div>
                  <label style={labelStyle}>
                    Priority <span style={{ color: '#8B1A1A' }}>*</span>
                  </label>
                  <select
                    value={form.priority}
                    onChange={e => setForm(p => ({
                      ...p, priority: e.target.value as SLARule['priority']
                    }))}
                    style={inputStyle}
                  >
                    {PRIORITIES.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* Impact Level */}
                <div>
                  <label style={labelStyle}>
                    Impact Level <span style={{ color: '#8B1A1A' }}>*</span>
                  </label>
                  <select
                    value={form.impact_level}
                    onChange={e => setForm(p => ({
                      ...p, impact_level: e.target.value as SLARule['impact_level']
                    }))}
                    style={inputStyle}
                  >
                    {IMPACTS.map(i => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Time fields */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 'clamp(10px, 2vw, 12px)',
                marginBottom: 'clamp(10px, 2vw, 14px)',
              }}>
                {/* Response Time */}
                <div>
                  <label style={labelStyle}>
                    Response Time (hrs) <span style={{ color: '#8B1A1A' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={form.response_time_hours}
                    onChange={e => setForm(p => ({
                      ...p, response_time_hours: Number(e.target.value)
                    }))}
                    style={inputStyle}
                  />
                  <div style={{ fontSize: 'clamp(8px, 1.5vw, 10px)', color: '#888', marginTop: 3 }}>
                    = {formatTime(form.response_time_hours)}
                  </div>
                </div>

                {/* Resolution Time */}
                <div>
                  <label style={labelStyle}>
                    Resolution Time (hrs) <span style={{ color: '#8B1A1A' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={form.resolution_time_hours}
                    onChange={e => setForm(p => ({
                      ...p, resolution_time_hours: Number(e.target.value)
                    }))}
                    style={inputStyle}
                  />
                  <div style={{ fontSize: 'clamp(8px, 1.5vw, 10px)', color: '#888', marginTop: 3 }}>
                    = {formatTime(form.resolution_time_hours)}
                  </div>
                </div>

                {/* Escalation Time */}
                <div>
                  <label style={labelStyle}>
                    Escalation Time (hrs) <span style={{ color: '#8B1A1A' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={form.escalation_time_hours}
                    onChange={e => setForm(p => ({
                      ...p, escalation_time_hours: Number(e.target.value)
                    }))}
                    style={inputStyle}
                  />
                  <div style={{ fontSize: 'clamp(8px, 1.5vw, 10px)', color: '#888', marginTop: 3 }}>
                    = {formatTime(form.escalation_time_hours)}
                  </div>
                </div>
              </div>

              {/* Active toggle */}
              <div style={{ marginBottom: 'clamp(10px, 2vw, 14px)' }}>
                <label style={labelStyle}>Status</label>
                <div style={{ display: 'flex', gap: 12 }}>
                  {[1, 0].map(val => (
                    <label key={val} style={{
                      display: 'flex', alignItems: 'center',
                      gap: 6, cursor: 'pointer', fontSize: 'clamp(10px, 1.8vw, 12px)',
                    }}>
                      <input
                        type="radio"
                        name="is_active"
                        value={val}
                        checked={form.is_active === val}
                        onChange={() => setForm(p => ({ ...p, is_active: val }))}
                      />
                      {val === 1 ? 'Active' : 'Inactive'}
                    </label>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={labelStyle}>Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Describe when this SLA applies..."
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              {/* Validation hint */}
              <div style={{
                marginTop: 12, background: '#F5F8FC',
                borderRadius: 4, padding: '8px 12px',
                fontSize: 'clamp(8px, 1.5vw, 10px)', color: '#5A6475', lineHeight: 1.7,
              }}>
                <strong style={{ color: '#1A2A3A' }}>Rules:</strong>
                &nbsp; Response Time must be less than Resolution Time.
                &nbsp; Escalation Time is when unresolved tickets get flagged.
                &nbsp; Each Priority + Impact combination must be unique.
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: 'clamp(10px, 2vw, 12px) clamp(14px, 3vw, 20px)',
              borderTop: '0.5px solid #E5EAF0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 'clamp(6px, 1.5vw, 8px)',
              background: '#F8FAFC',
              flexShrink: 0,
              flexWrap: 'wrap',
            }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: 'clamp(5px, 1.5vw, 6px) clamp(10px, 2vw, 14px)',
                  fontSize: 'clamp(10px, 1.8vw, 12px)',
                  border: '1px solid #C8D0DC',
                  borderRadius: 4,
                  background: '#fff',
                  cursor: 'pointer',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: 'clamp(5px, 1.5vw, 6px) clamp(12px, 2.5vw, 16px)',
                  fontSize: 'clamp(10px, 1.8vw, 12px)',
                  background: saving ? '#888' : 'var(--gov-green)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                {saving ? 'Saving...' : editRule ? '✓ Save Changes' : '✓ Save Rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== DELETE CONFIRM MODAL ===== */}
      {deleteTarget && (
        <div
          onClick={() => setDeleteTarget(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,20,0.55)',
            zIndex: 200, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              width: 'clamp(90vw, 95vw, 380px)',
              maxWidth: '95vw',
              borderRadius: 10,
              overflow: 'hidden',
              border: '0.5px solid #C0C8D4',
            }}
          >
            <div style={{
              background: '#8B1A1A',
              padding: 'clamp(10px, 2vw, 14px) clamp(14px, 3vw, 20px)',
            }}>
              <p style={{
                color: '#fff',
                fontSize: 'clamp(12px, 2vw, 15px)',
                fontWeight: 600,
                margin: 0,
              }}>
                Confirm Delete SLA Rule
              </p>
            </div>
            <div style={{
              padding: 'clamp(12px, 3vw, 20px)',
            }}>
              <p style={{
                fontSize: 'clamp(10px, 1.8vw, 12px)',
                color: '#2A2A2A',
                marginBottom: 12,
                lineHeight: 1.6,
              }}>
                Are you sure you want to delete the SLA rule for{' '}
                <strong>{deleteTarget.priority}</strong> /{' '}
                <strong>{deleteTarget.impact_level}</strong>?
              </p>
              <div style={{
                background: '#FDE8E8',
                borderRadius: 4,
                padding: 'clamp(6px, 1.5vw, 8px) clamp(10px, 2vw, 12px)',
                fontSize: 'clamp(8px, 1.5vw, 10px)',
                color: '#8B1A1A',
                lineHeight: 1.5,
              }}>
                ⚠ This cannot be undone. Tickets using this
                priority/impact combination will no longer have SLA tracking.
              </div>
            </div>
            <div style={{
              padding: 'clamp(10px, 2vw, 12px) clamp(14px, 3vw, 20px)',
              borderTop: '0.5px solid #E5EAF0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 'clamp(6px, 1.5vw, 8px)',
              background: '#F8FAFC',
              flexWrap: 'wrap',
            }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{
                  padding: 'clamp(5px, 1.5vw, 6px) clamp(10px, 2vw, 14px)',
                  fontSize: 'clamp(10px, 1.8vw, 12px)',
                  border: '1px solid #C8D0DC',
                  borderRadius: 4,
                  background: '#fff',
                  cursor: 'pointer',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: 'clamp(5px, 1.5vw, 6px) clamp(12px, 2.5vw, 16px)',
                  fontSize: 'clamp(10px, 1.8vw, 12px)',
                  background: deleting ? '#888' : '#8B1A1A',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast.msg && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20,
          background: toast.type === 'error' ? '#8B1A1A' : 'var(--gov-green)',
          color: '#fff', padding: '10px 16px',
          borderRadius: 4, fontSize: 'clamp(10px, 1.8vw, 12px)', fontWeight: 500, zIndex: 300,
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
