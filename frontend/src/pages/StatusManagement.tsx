import { useEffect, useState } from 'react';
import { api } from '../services/api';


interface TicketStatus {
  id: number;
  name: string;
  type: 'in_progress' | 'completed';
  color: string;
  description: string;
  is_default: number;
  sort_order: number;
}

const EMPTY_FORM = {
  name: '',
  type: 'in_progress' as 'in_progress' | 'completed',
  color: '#1A5490',
  description: '',
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

export default function StatusManagement() {
  const [statuses, setStatuses] = useState<TicketStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editStatus, setEditStatus] = useState<TicketStatus | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TicketStatus | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState({ msg: '', type: '' });

  useEffect(() => { fetchStatuses(); }, []);

  async function fetchStatuses() {
    try {
      const res = await api.get('/statuses');
      setStatuses(res.data);
    } catch {
      showToast('Failed to load statuses.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: '' }), 3000);
  }

  function openCreate() {
    setEditStatus(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  }

  function openEdit(s: TicketStatus) {
    setEditStatus(s);
    setForm({
      name: s.name,
      type: s.type,
      color: s.color,
      description: s.description,
    });
    setShowModal(true);
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave() {
    if (!form.name.trim()) { alert('Name is required.'); return; }
    setSaving(true);
    try {
      if (editStatus) {
        await api.put(`/statuses/${editStatus.id}`, form);
        showToast(`"${form.name}" updated successfully.`);
      } else {
        await api.post('/statuses', form);
        showToast(`"${form.name}" created successfully.`);
      }
      setShowModal(false);
      fetchStatuses();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save status.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/statuses/${deleteTarget.id}`);
      showToast(`"${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      fetchStatuses();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete status.');
    } finally {
      setDeleting(false);
    }
  }

  const inProgress = statuses.filter(s => s.type === 'in_progress');
  const completed  = statuses.filter(s => s.type === 'completed');

  if (loading) return (
    <div style={{ color: 'var(--gov-navy)', padding: 40, textAlign: 'center' }}>
      Loading statuses...
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
          / Status Management
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
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 'clamp(8px, 2vw, 12px)',
        flexWrap: 'wrap',
        lineHeight: 1.5,
      }}>
        <span>
          Manage ticket statuses. <strong>Default statuses</strong> cannot
          be deleted but can be edited. Custom statuses can be fully managed.
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
          + New Status
        </button>
      </div>

      {/* SUMMARY CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 'clamp(8px, 2vw, 12px)',
        marginBottom: 18,
      }}>
        {[
          { label: 'Total Statuses',       value: statuses.length,    color: 'var(--gov-navy)'  },
          { label: 'In Progress Types',    value: inProgress.length,  color: 'var(--gov-amber)' },
          { label: 'Completed Types',      value: completed.length,   color: 'var(--gov-green)' },
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
              fontSize: 'clamp(20px, 6vw, 28px)',
              fontWeight: 500,
              color: c.color,
            }}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {/* STATUS TABLE */}
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
          minWidth: '600px',
        }}>
          <thead>
            <tr>
              {['Color', 'Name', 'Type', 'Description', 'Default', 'Actions'].map(h => (
                <th key={h} style={{
                  textAlign: 'left',
                  padding: 'clamp(6px, 1.5vw, 9px) clamp(10px, 2vw, 14px)',
                  fontSize: 'clamp(9px, 1.8vw, 11px)',
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
            {statuses.map(s => (
              <tr
                key={s.id}
                onMouseEnter={e => (e.currentTarget.style.background = '#F5F8FC')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              >
                {/* Color swatch */}
                <td style={{
                  padding: 'clamp(8px, 1.5vw, 10px) clamp(10px, 2vw, 14px)',
                }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: s.color,
                    border: '1px solid rgba(0,0,0,0.1)',
                  }} />
                </td>

                {/* Name with badge */}
                <td style={{
                  padding: 'clamp(8px, 1.5vw, 10px) clamp(10px, 2vw, 14px)',
                }}>
                  <span style={{
                    display: 'inline-block',
                    background: s.color + '22',
                    color: s.color,
                    fontSize: 'clamp(8px, 1.5vw, 10px)',
                    fontWeight: 500,
                    padding: '3px 10px',
                    borderRadius: 4,
                    border: `1px solid ${s.color}44`,
                  }}>
                    {s.name}
                  </span>
                </td>

                {/* Type */}
                <td style={{
                  padding: 'clamp(8px, 1.5vw, 10px) clamp(10px, 2vw, 14px)',
                }}>
                  <span style={{
                    fontSize: 'clamp(8px, 1.5vw, 10px)',
                    padding: '2px 8px',
                    borderRadius: 3,
                    fontWeight: 500,
                    background: s.type === 'completed' ? '#E8F5EE' : '#FEF3DC',
                    color: s.type === 'completed' ? '#1B6B3A' : '#CC7700',
                  }}>
                    {s.type === 'completed' ? 'Completed' : 'In Progress'}
                  </span>
                </td>

                {/* Description */}
                <td style={{
                  padding: 'clamp(8px, 1.5vw, 10px) clamp(10px, 2vw, 14px)',
                  fontSize: 'clamp(8px, 1.5vw, 10px)',
                  color: '#5A6475',
                  maxWidth: 300,
                }}>
                  {s.description || '—'}
                </td>

                {/* Default badge */}
                <td style={{
                  padding: 'clamp(8px, 1.5vw, 10px) clamp(10px, 2vw, 14px)',
                  textAlign: 'center',
                }}>
                  {s.is_default ? (
                    <span style={{
                      fontSize: 'clamp(8px, 1.5vw, 10px)',
                      padding: '2px 8px',
                      background: '#E8F1FA',
                      color: '#0D3B6E',
                      borderRadius: 3,
                      fontWeight: 500,
                    }}>
                      Default
                    </span>
                  ) : (
                    <span style={{
                      fontSize: 'clamp(8px, 1.5vw, 10px)',
                      color: '#999',
                    }}>
                      Custom
                    </span>
                  )}
                </td>

                {/* Actions */}
                <td style={{
                  padding: 'clamp(8px, 1.5vw, 10px) clamp(10px, 2vw, 14px)',
                }}>
                  <div style={{
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap',
                  }}>
                    <button
                      onClick={() => openEdit(s)}
                      style={{
                        padding: 'clamp(3px, 1vw, 4px) clamp(10px, 1.5vw, 12px)',
                        fontSize: 'clamp(8px, 1.5vw, 10px)',
                        background: 'var(--gov-navy)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontWeight: 500,
                      }}
                    >
                      Edit
                    </button>
                    {!s.is_default && (
                      <button
                        onClick={() => setDeleteTarget(s)}
                        style={{
                          padding: 'clamp(3px, 1vw, 4px) clamp(10px, 1.5vw, 12px)',
                          fontSize: 'clamp(8px, 1.5vw, 10px)',
                          background: '#FDE8E8',
                          color: '#8B1A1A',
                          border: '1px solid #F5C0C0',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontWeight: 500,
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
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
              width: 'clamp(90vw, 95vw, 480px)',
              maxWidth: '95vw',
              borderRadius: 10,
              border: '0.5px solid #C0C8D4',
              overflow: 'hidden',
              maxHeight: '92vh',
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
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {editStatus ? `Edit Status — ${editStatus.name}` : 'New Status'}
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

              {/* Name */}
              <div style={{ marginBottom: 'clamp(10px, 2vw, 14px)' }}>
                <label style={labelStyle}>
                  Name <span style={{ color: '#8B1A1A' }}>*</span>
                </label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Pending Review"
                  style={inputStyle}
                  disabled={!!editStatus?.is_default}
                />
                {editStatus?.is_default && (
                  <p style={{ fontSize: 'var(--text-xs)', color: '#888', marginTop: 4 }}>
                    Default status names cannot be changed.
                  </p>
                )}
              </div>

              {/* Type */}
              <div style={{ marginBottom: 'clamp(10px, 2vw, 14px)' }}>
                <label style={labelStyle}>Type</label>
                <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
                  {[
                    { value: 'in_progress', label: 'In Progress' },
                    { value: 'completed',   label: 'Completed'   },
                  ].map(opt => (
                    <label key={opt.value} style={{
                      display: 'flex', alignItems: 'center',
                      gap: 6, cursor: 'pointer', fontSize: 'var(--text-sm)',
                    }}>
                      <input
                        type="radio"
                        name="type"
                        value={opt.value}
                        checked={form.type === opt.value}
                        onChange={handleChange}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: '#888', marginTop: 4 }}>
                  <strong>In Progress</strong> — ticket is still active.{' '}
                  <strong>Completed</strong> — ticket is done.
                </p>
              </div>

              {/* Color */}
              <div style={{ marginBottom: 'clamp(10px, 2vw, 14px)' }}>
                <label style={labelStyle}>Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="color"
                    name="color"
                    value={form.color}
                    onChange={handleChange}
                    style={{
                      width: 44, height: 36, padding: 2,
                      border: '1px solid #C8D0DC', borderRadius: 4,
                      cursor: 'pointer', background: '#fff',
                    }}
                  />
                  <span style={{
                    fontSize: 'var(--text-sm)', color: '#3A3A3A',
                    padding: '4px 12px', borderRadius: 4,
                    background: form.color + '22',
                    border: `1px solid ${form.color}66`,
                    fontWeight: 500,
                  }}>
                    Preview: {form.name || 'Status Name'}
                  </span>
                  {/* Quick color presets */}
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['#1A5490','#CC7700','#1B6B3A','#8B1A1A','#4A4A4A','#5B21B6'].map(c => (
                      <div
                        key={c}
                        onClick={() => setForm(prev => ({ ...prev, color: c }))}
                        style={{
                          width: 20, height: 20, borderRadius: 4,
                          background: c, cursor: 'pointer',
                          border: form.color === c ? '2px solid #000' : '1px solid rgba(0,0,0,0.15)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: 'clamp(8px, 2vw, 6px)' }}>
                <label style={labelStyle}>Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Describe when this status is used..."
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              {/* Info note */}
              <div style={{
                background: '#E8F1FA',
                borderRadius: 4,
                padding: 'clamp(6px, 1.5vw, 8px) clamp(10px, 2vw, 12px)',
                fontSize: 'clamp(8px, 1.5vw, 10px)',
                color: 'var(--gov-navy)',
                marginTop: 10,
                lineHeight: 1.5,
              }}>
                Reports which use status names as criteria need to be
                reconfigured to reflect any updated status name.
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
                {saving ? 'Saving...' : editStatus ? '✓ Save Changes' : '✓ Save'}
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
              background: '#fff', width: 380,
              borderRadius: 10, overflow: 'hidden',
              border: '0.5px solid #C0C8D4',
            }}
          >
            <div style={{ background: '#8B1A1A', padding: '14px 20px' }}>
              <p style={{ color: '#fff', fontSize: 'var(--text-base)', fontWeight: 600 }}>
                Confirm Delete Status
              </p>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 'var(--text-sm)', color: '#2A2A2A', marginBottom: 12, lineHeight: 1.6 }}>
                Are you sure you want to delete the{' '}
                <strong style={{ color: deleteTarget.color }}>
                  {deleteTarget.name}
                </strong>{' '}
                status? This cannot be undone.
              </p>
              <div style={{
                background: '#FDE8E8', borderRadius: 4,
                padding: '8px 12px', fontSize: 'var(--text-xs)', color: '#8B1A1A',
              }}>
                ⚠ Tickets using this status will not be affected but
                the status will no longer be available for new tickets.
              </div>
            </div>
            <div style={{
              padding: '12px 20px', borderTop: '0.5px solid #E5EAF0',
              display: 'flex', justifyContent: 'flex-end',
              gap: 8, background: '#F8FAFC',
            }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{
                  padding: '6px 14px', fontSize: 'var(--text-sm)',
                  border: '1px solid #C8D0DC', borderRadius: 4,
                  background: '#fff', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '6px 16px', fontSize: 'var(--text-sm)',
                  background: deleting ? '#888' : '#8B1A1A',
                  color: '#fff', border: 'none', borderRadius: 4,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
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
          borderRadius: 4, fontSize: 'var(--text-sm)', fontWeight: 500, zIndex: 300,
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}