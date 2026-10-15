import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';


interface Category {
  id: number;
  service_area_id: number | null;
  service_area_name: string | null;
  service_area_code?: string | null;
  name: string;
  description: string;
  sub_category_count: number;
  sla_rule_id: number | null;
  default_priority: string;
  sla_priority: string | null;
  sla_impact: string | null;
  response_time_hours: number | null;
  resolution_time_hours: number | null;
}

interface ServiceArea { id: number; code: string; name: string; is_active: number; }

interface SubCategory {
  id: number;
  category_id: number;
  name: string;
  description: string;
  item_count: number;
  sla_rule_id: number | null;
  default_priority: string;
  sla_priority: string | null;
  sla_impact: string | null;
  response_time_hours: number | null;
  resolution_time_hours: number | null;
}

interface SubItem {
  id: number;
  sub_category_id: number;
  name: string;
  description: string;
  sla_rule_id: number | null;
  default_priority: string;
  sla_priority: string | null;
  sla_impact: string | null;
  response_time_hours: number | null;
  resolution_time_hours: number | null;
}

interface SLARule {
  id: number;
  priority: string;
  impact_level: string;
  response_time_hours: number;
  resolution_time_hours: number;
  escalation_time_hours: number;
}

type ModalType = 'category' | 'subcategory' | 'subitem' | null;
type ModalMode = 'create' | 'edit';

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

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

function formatTime(hours: number | null): string {
  if (!hours) return '—';
  if (hours < 1)  return `${Math.round(hours * 60)} mins`;
  if (hours < 24) return `${hours} hr${hours !== 1 ? 's' : ''}`;
  const days = hours / 24;
  return `${days} day${days !== 1 ? 's' : ''}`;
}

function SLABadges({ item }: { item: any }) {
  if (!item.sla_rule_id) return (
    <span style={{
      fontSize: 'clamp(8px, 1.5vw, 10px)',
      color: '#aaa',
    }}>
      No SLA
    </span>
  );
  return (
    <div style={{
      display: 'flex',
      gap: 3,
      flexWrap: 'wrap',
      marginTop: 3,
    }}>
      <span style={{
        fontSize: 'clamp(7px, 1.2vw, 9px)',
        padding: '1px 5px',
        borderRadius: 3,
        background: '#FDE8E8',
        color: '#8B1A1A',
        fontWeight: 500,
      }}>
        {item.sla_priority}
      </span>
      <span style={{
        fontSize: 'clamp(7px, 1.2vw, 9px)',
        padding: '1px 5px',
        borderRadius: 3,
        background: '#E8F1FA',
        color: '#0D3B6E',
        fontWeight: 500,
      }}>
        {item.sla_impact}
      </span>
      <span style={{
        fontSize: 'clamp(7px, 1.2vw, 9px)',
        padding: '1px 5px',
        borderRadius: 3,
        background: '#E8F5EE',
        color: '#1B6B3A',
        fontWeight: 500,
      }}>
        {formatTime(item.response_time_hours)} / {formatTime(item.resolution_time_hours)}
      </span>
    </div>
  );
}

function SLASelect({ value, onChange, slaRules }: {
  value: string | number;
  onChange: (val: string) => void;
  slaRules: SLARule[];
}) {
  const selected = slaRules.find(r => r.id === Number(value));
  return (
    <div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={inputStyle}
      >
        <option value="">— No SLA Rule —</option>
        {slaRules.map(r => (
          <option key={r.id} value={r.id}>
            {r.priority} / {r.impact_level} —
            {formatTime(r.response_time_hours)} response |
            {formatTime(r.resolution_time_hours)} resolution
          </option>
        ))}
      </select>
      {selected && (
        <div style={{
          marginTop: 6, background: '#E8F1FA',
          borderRadius: 4, padding: '6px 10px',
          fontSize: 'clamp(8px, 1.5vw, 10px)', color: '#0D3B6E', lineHeight: 1.7,
        }}>
          Response: <strong>{formatTime(selected.response_time_hours)}</strong> →
          Escalate: <strong>{formatTime(selected.escalation_time_hours)}</strong> →
          Resolve by: <strong>{formatTime(selected.resolution_time_hours)}</strong>
        </div>
      )}
    </div>
  );
}

export default function CategoryManagement() {
  const { user } = useAuth();
  const managedAreaIds = user?.role === 'super_admin' ? null : (user?.area_admin_service_ids || []);
  const [categories, setCategories]       = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [subItems, setSubItems]           = useState<SubItem[]>([]);
  const [slaRules, setSlaRules]           = useState<SLARule[]>([]);
  const [serviceAreas, setServiceAreas]   = useState<ServiceArea[]>([]);
  const [serviceAreaFilter, setServiceAreaFilter] = useState('all');
  const [loading, setLoading]             = useState(true);

  const [selectedCat, setSelectedCat]   = useState<Category | null>(null);
  const [selectedSub, setSelectedSub]   = useState<SubCategory | null>(null);

  const [modalType, setModalType] = useState<ModalType>(null);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editTarget, setEditTarget] = useState<any>(null);
  const [form, setForm] = useState({
    name: '', description: '',
    sla_rule_id: '', default_priority: 'Medium', service_area_id: '',
  });
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ type: ModalType; item: any } | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [toast, setToast] = useState({ msg: '', type: '' });

  useEffect(() => {
    Promise.all([
      fetchCategories(),
      api.get('/service-areas').then(res => setServiceAreas(res.data.filter((area: ServiceArea) => !managedAreaIds || managedAreaIds.includes(area.id)))),
      api.get('/sla').then(res => setSlaRules(
        res.data.filter((r: SLARule & { is_active: number }) => r.is_active)
      )),
    ]);
  }, []);

  useEffect(() => {
    if (managedAreaIds?.length) setServiceAreaFilter(String(managedAreaIds[0]));
  }, [user?.id]);

  useEffect(() => {
    if (selectedCat) fetchSubCategories(selectedCat.id);
    else { setSubCategories([]); setSelectedSub(null); setSubItems([]); }
  }, [selectedCat]);

  useEffect(() => {
    if (selectedSub) fetchSubItems(selectedSub.id);
    else setSubItems([]);
  }, [selectedSub]);

  useEffect(() => {
    setSelectedCat(null);
    setSelectedSub(null);
  }, [serviceAreaFilter]);

  async function fetchCategories() {
    const res = await api.get('/categories');
    setCategories(res.data);
    setLoading(false);
  }

  const scopedCategories = managedAreaIds ? categories.filter(category => category.service_area_id !== null && managedAreaIds.includes(category.service_area_id)) : categories;
  const visibleCategories = serviceAreaFilter === 'all'
    ? scopedCategories
    : scopedCategories.filter(category => String(category.service_area_id) === serviceAreaFilter);

  async function fetchSubCategories(catId: number) {
    const res = await api.get(`/categories/${catId}/subs`);
    setSubCategories(res.data);
  }

  async function fetchSubItems(subId: number) {
    const res = await api.get(`/categories/subs/${subId}/items`);
    setSubItems(res.data);
  }

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: '' }), 3000);
  }

  function openCreate(type: ModalType) {
    setModalType(type);
    setModalMode('create');
    setEditTarget(null);
    setForm({ name: '', description: '', sla_rule_id: '', default_priority: 'Medium', service_area_id: type === 'category' && serviceAreaFilter !== 'all' ? serviceAreaFilter : '' });
  }

  function openEdit(type: ModalType, item: any) {
    setModalType(type);
    setModalMode('edit');
    setEditTarget(item);
    setForm({
      name: item.name,
      description: item.description ?? '',
      sla_rule_id: item.sla_rule_id ?? '',
      default_priority: item.default_priority ?? 'Medium',
      service_area_id: item.service_area_id ?? '',
    });
  }

  async function handleSave() {
    if (!form.name.trim()) { alert('Name is required.'); return; }
    if (modalType === 'category' && !form.service_area_id) { alert('Select the responsible service area.'); return; }
    setSaving(true);
    const payload = {
      name: form.name,
      description: form.description,
      sla_rule_id: form.sla_rule_id || null,
      default_priority: form.default_priority,
      ...(modalType === 'category' ? { service_area_id: form.service_area_id || null } : {}),
    };
    try {
      if (modalMode === 'create') {
        if (modalType === 'category') {
          await api.post('/categories', payload);
          await fetchCategories();
        } else if (modalType === 'subcategory' && selectedCat) {
          await api.post(`/categories/${selectedCat.id}/subs`, payload);
          await fetchSubCategories(selectedCat.id);
          await fetchCategories();
        } else if (modalType === 'subitem' && selectedSub) {
          await api.post(`/categories/subs/${selectedSub.id}/items`, payload);
          await fetchSubItems(selectedSub.id);
        }
        showToast(`"${form.name}" created successfully.`);
      } else {
        if (modalType === 'category') {
          await api.put(`/categories/${editTarget.id}`, payload);
          await fetchCategories();
          if (selectedCat?.id === editTarget.id) {
            setSelectedCat(prev => prev ? { ...prev, ...payload } : null);
          }
        } else if (modalType === 'subcategory') {
          await api.put(`/categories/subs/${editTarget.id}`, payload);
          if (selectedCat) await fetchSubCategories(selectedCat.id);
          if (selectedSub?.id === editTarget.id) {
            setSelectedSub(prev => prev ? { ...prev, ...payload } : null);
          }
        } else if (modalType === 'subitem') {
          await api.put(`/categories/items/${editTarget.id}`, payload);
          if (selectedSub) await fetchSubItems(selectedSub.id);
        }
        showToast(`"${form.name}" updated successfully.`);
      }
      setModalType(null);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { type, item } = deleteTarget;
      if (type === 'category') {
        await api.delete(`/categories/${item.id}`);
        if (selectedCat?.id === item.id) setSelectedCat(null);
        await fetchCategories();
      } else if (type === 'subcategory') {
        await api.delete(`/categories/subs/${item.id}`);
        if (selectedSub?.id === item.id) setSelectedSub(null);
        if (selectedCat) await fetchSubCategories(selectedCat.id);
        await fetchCategories();
      } else if (type === 'subitem') {
        await api.delete(`/categories/items/${item.id}`);
        if (selectedSub) await fetchSubItems(selectedSub.id);
      }
      showToast(`"${item.name}" deleted.`);
      setDeleteTarget(null);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete.');
    } finally {
      setDeleting(false);
    }
  }

  const modalTitles: Record<string, string> = {
    category:    modalMode === 'create' ? 'New Category'     : 'Edit Category',
    subcategory: modalMode === 'create' ? 'New Sub-Category' : 'Edit Sub-Category',
    subitem:     modalMode === 'create' ? 'New Sub-Item'     : 'Edit Sub-Item',
  };

  const deleteTypeLabel: Record<string, string> = {
    category:    'category and ALL its sub-categories and sub-items',
    subcategory: 'sub-category and ALL its sub-items',
    subitem:     'sub-item',
  };

  function ColumnHeader({
    title, count, onAdd, color,
  }: { title: string; count?: number; onAdd?: () => void; color: string; }) {
    return (
      <div style={{
        background: color, padding: '10px 14px',
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 'clamp(8px, 1.5vw, 10px)', fontWeight: 500, color: '#fff' }}>
          {title}{count !== undefined && ` (${count})`}
        </span>
        {onAdd && (
          <button
            onClick={onAdd}
            style={{
              background: 'rgba(255,255,255,0.2)', border: 'none',
              borderRadius: 4, padding: '3px 10px',
              color: '#fff', fontSize: 'clamp(8px, 1.5vw, 10px)', cursor: 'pointer',
            }}
          >
            + Add
          </button>
        )}
      </div>
    );
  }

  function EmptyState({ message, onAdd }: { message: string; onAdd?: () => void }) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#888', fontSize: 'clamp(10px, 1.8vw, 12px)' }}>
        {message}
        {onAdd && (
          <div style={{ marginTop: 8 }}>
            <button
              onClick={onAdd}
              style={{
                padding: '5px 12px', fontSize: 'clamp(8px, 1.5vw, 10px)',
                background: 'var(--gov-navy)', color: '#fff',
                border: 'none', borderRadius: 4, cursor: 'pointer',
              }}
            >
              + Add Now
            </button>
          </div>
        )}
      </div>
    );
  }

  if (loading) return (
    <div style={{ color: 'var(--gov-navy)', padding: 40, textAlign: 'center' }}>
      Loading categories...
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
          / Category Management
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
        SLA rules can be mapped at <strong>Category</strong>,{' '}
        <strong>Sub-Category</strong>, or <strong>Sub-Item</strong> level.
        The most specific level always takes priority
        (Sub-Item → Sub-Category → Category).
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', background: '#fff', border: '0.5px solid #D0D9E4', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
        <div><strong style={{ color: 'var(--gov-navy)' }}>Category Service View</strong><div style={{ fontSize: 'var(--text-xs)', color: '#62748A', marginTop: 2 }}>{managedAreaIds ? 'Manage the selected assigned service area.' : 'FO3 Super Admin can view all services or focus on one service area.'}</div></div>
        <select value={serviceAreaFilter} onChange={e => setServiceAreaFilter(e.target.value)} style={{ ...inputStyle, width: 260 }}>
          {!managedAreaIds && <option value="all">All service areas</option>}
          {serviceAreas.filter(area => area.is_active).map(area => <option key={area.id} value={area.id}>{area.code} — {area.name}</option>)}
        </select>
      </div>

      {/* FALLBACK CHAIN LEGEND */}
      <div style={{
        background: '#fff',
        border: '0.5px solid #D0D9E4',
        borderRadius: 8,
        padding: 'clamp(8px, 2vw, 12px)',
        marginBottom: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 'clamp(6px, 1.5vw, 10px)',
        flexWrap: 'wrap',
        fontSize: 'clamp(8px, 1.5vw, 10px)',
      }}>
        <span style={{ color: '#6A7280', fontWeight: 500 }}>SLA Priority Chain:</span>
        <span style={{
          background: '#E8F5EE',
          color: '#1B6B3A',
          padding: '2px 8px',
          borderRadius: 4,
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}>
          Sub-Item SLA
        </span>
        <span style={{ color: '#888', whiteSpace: 'nowrap' }}>→ if none →</span>
        <span style={{
          background: '#FEF3DC',
          color: '#CC7700',
          padding: '2px 8px',
          borderRadius: 4,
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}>
          Sub-Category SLA
        </span>
        <span style={{ color: '#888', whiteSpace: 'nowrap' }}>→ if none →</span>
        <span style={{
          background: '#E8F1FA',
          color: '#0D3B6E',
          padding: '2px 8px',
          borderRadius: 4,
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}>
          Category SLA
        </span>
        <span style={{ color: '#888', whiteSpace: 'nowrap' }}>→ if none →</span>
        <span style={{
          background: '#F0F0F0',
          color: '#666',
          padding: '2px 8px',
          borderRadius: 4,
          whiteSpace: 'nowrap',
        }}>
          No SLA
        </span>
      </div>

      {/* 3-COLUMN PANEL */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 'clamp(10px, 2vw, 12px)',
        alignItems: 'start',
      }}>

        {/* ── COLUMN 1: CATEGORIES ── */}
        <div style={{
          background: '#fff', border: '0.5px solid #D0D9E4',
          borderRadius: 8, overflow: 'hidden',
        }}>
          <ColumnHeader
            title="Categories"
            count={visibleCategories.length}
            color="var(--gov-navy)"
            onAdd={() => openCreate('category')}
          />
          {visibleCategories.length === 0 ? (
            <EmptyState
              message="No categories yet."
              onAdd={() => openCreate('category')}
            />
          ) : visibleCategories.map((cat, index) => (
            <div
              key={cat.id}
            >
              {serviceAreaFilter === 'all' && (index === 0 || visibleCategories[index - 1].service_area_id !== cat.service_area_id) && <div style={{ padding: '7px 12px', background: '#EDF4FB', borderBottom: '1px solid #D5E1EE', color: '#0D3B6E', fontSize: 'var(--text-xs)', fontWeight: 700 }}>
                {cat.service_area_code || 'UNASSIGNED'} — {cat.service_area_name || 'Unassigned Service'}
              </div>}
              <div onClick={() => setSelectedCat(selectedCat?.id === cat.id ? null : cat)} style={{
                padding: 'clamp(8px, 2vw, 10px) clamp(10px, 2vw, 14px)', cursor: 'pointer', borderBottom: '0.5px solid #EEF1F5', background: selectedCat?.id === cat.id ? '#E8F1FA' : '#fff', borderLeft: selectedCat?.id === cat.id ? '3px solid var(--gov-navy)' : '3px solid transparent',
              }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '8px',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: 'clamp(11px, 2vw, 13px)',
                    fontWeight: 500,
                    color: '#1A2A3A',
                    marginBottom: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {cat.name}
                  </p>
                  {cat.description && (
                    <p style={{
                      fontSize: 'clamp(8px, 1.5vw, 10px)',
                      color: '#6A7280',
                      marginBottom: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {cat.description}
                    </p>
                  )}
                  <p style={{
                    fontSize: 'clamp(8px, 1.5vw, 10px)',
                    color: '#888',
                  }}>
                    {cat.sub_category_count} sub-categor{cat.sub_category_count !== 1 ? 'ies' : 'y'}
                  </p>
                  <SLABadges item={cat} />
                </div>
                <div style={{
                  display: 'flex',
                  gap: 4,
                  flexShrink: 0,
                }}>
                  <button
                    onClick={e => { e.stopPropagation(); openEdit('category', cat); }}
                    style={{
                      padding: 'clamp(2px, 0.8vw, 3px) clamp(6px, 1.2vw, 8px)',
                      fontSize: 'clamp(7px, 1.2vw, 9px)',
                      background: 'var(--gov-navy)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 3,
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteTarget({ type: 'category', item: cat }); }}
                    style={{
                      padding: '3px 8px', fontSize: 'clamp(8px, 1.5vw, 10px)',
                      background: '#FDE8E8', color: '#8B1A1A',
                      border: '1px solid #F5C0C0',
                      borderRadius: 3, cursor: 'pointer',
                    }}
                  >Del</button>
                </div>
              </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── COLUMN 2: SUB-CATEGORIES ── */}
        <div style={{
          background: '#fff', border: '0.5px solid #D0D9E4',
          borderRadius: 8, overflow: 'hidden',
        }}>
          <ColumnHeader
            title={selectedCat ? `Sub-Categories — ${selectedCat.name}` : 'Sub-Categories'}
            count={selectedCat ? subCategories.length : undefined}
            color={selectedCat ? '#1A5490' : '#8A96A3'}
            onAdd={selectedCat ? () => openCreate('subcategory') : undefined}
          />
          {!selectedCat ? (
            <EmptyState message="← Select a category first" />
          ) : subCategories.length === 0 ? (
            <EmptyState
              message="No sub-categories yet."
              onAdd={() => openCreate('subcategory')}
            />
          ) : subCategories.map(sub => (
            <div
              key={sub.id}
              onClick={() => setSelectedSub(
                selectedSub?.id === sub.id ? null : sub
              )}
              style={{
                padding: '10px 14px', cursor: 'pointer',
                borderBottom: '0.5px solid #EEF1F5',
                background: selectedSub?.id === sub.id ? '#FEF3DC' : '#fff',
                borderLeft: selectedSub?.id === sub.id
                  ? '3px solid #CC7700'
                  : '3px solid transparent',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 'clamp(10px, 1.8vw, 12px)', fontWeight: 500, color: '#1A2A3A', marginBottom: 2 }}>
                    {sub.name}
                  </p>
                  {sub.description && (
                    <p style={{ fontSize: 'clamp(8px, 1.5vw, 10px)', color: '#6A7280', marginBottom: 2 }}>
                      {sub.description}
                    </p>
                  )}
                  <p style={{ fontSize: 'clamp(8px, 1.5vw, 10px)', color: '#888' }}>
                    {sub.item_count} sub-item{sub.item_count !== 1 ? 's' : ''}
                  </p>
                  <SLABadges item={sub} />
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                  <button
                    onClick={e => { e.stopPropagation(); openEdit('subcategory', sub); }}
                    style={{
                      padding: '3px 8px', fontSize: 'clamp(8px, 1.5vw, 10px)',
                      background: 'var(--gov-navy)', color: '#fff',
                      border: 'none', borderRadius: 3, cursor: 'pointer',
                    }}
                  >Edit</button>
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteTarget({ type: 'subcategory', item: sub }); }}
                    style={{
                      padding: '3px 8px', fontSize: 'clamp(8px, 1.5vw, 10px)',
                      background: '#FDE8E8', color: '#8B1A1A',
                      border: '1px solid #F5C0C0',
                      borderRadius: 3, cursor: 'pointer',
                    }}
                  >Del</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── COLUMN 3: SUB-ITEMS ── */}
        <div style={{
          background: '#fff', border: '0.5px solid #D0D9E4',
          borderRadius: 8, overflow: 'hidden',
        }}>
          <ColumnHeader
            title={selectedSub ? `Sub-Items — ${selectedSub.name}` : 'Sub-Items'}
            count={selectedSub ? subItems.length : undefined}
            color={selectedSub ? '#1B6B3A' : '#8A96A3'}
            onAdd={selectedSub ? () => openCreate('subitem') : undefined}
          />
          {!selectedSub ? (
            <EmptyState message="← Select a sub-category first" />
          ) : subItems.length === 0 ? (
            <EmptyState
              message="No sub-items yet."
              onAdd={() => openCreate('subitem')}
            />
          ) : subItems.map(item => (
            <div
              key={item.id}
              style={{
                padding: '10px 14px',
                borderBottom: '0.5px solid #EEF1F5',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F5F8FC')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'var(--gov-green)', flexShrink: 0,
                    }} />
                    <p style={{ fontSize: 'clamp(10px, 1.8vw, 12px)', fontWeight: 500, color: '#1A2A3A' }}>
                      {item.name}
                    </p>
                  </div>
                  {item.description && (
                    <p style={{ fontSize: 'clamp(8px, 1.5vw, 10px)', color: '#6A7280', marginLeft: 12, marginBottom: 2 }}>
                      {item.description}
                    </p>
                  )}
                  <div style={{ marginLeft: 12 }}>
                    <SLABadges item={item} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                  <button
                    onClick={() => openEdit('subitem', item)}
                    style={{
                      padding: '3px 8px', fontSize: 'clamp(8px, 1.5vw, 10px)',
                      background: 'var(--gov-navy)', color: '#fff',
                      border: 'none', borderRadius: 3, cursor: 'pointer',
                    }}
                  >Edit</button>
                  <button
                    onClick={() => setDeleteTarget({ type: 'subitem', item })}
                    style={{
                      padding: '3px 8px', fontSize: 'clamp(8px, 1.5vw, 10px)',
                      background: '#FDE8E8', color: '#8B1A1A',
                      border: '1px solid #F5C0C0',
                      borderRadius: 3, cursor: 'pointer',
                    }}
                  >Del</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== ADD / EDIT MODAL ===== */}
      {modalType && (
        <div
          onClick={() => setModalType(null)}
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
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{
              background: 'var(--gov-navy)',
              padding: 'clamp(10px, 2vw, 14px) clamp(14px, 3vw, 20px)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '10px',
              flexShrink: 0,
            }}>
              <div>
                <p style={{
                  color: '#fff',
                  fontSize: 'clamp(12px, 2vw, 15px)',
                  fontWeight: 600,
                  margin: 0,
                }}>
                  {modalTitles[modalType!]}
                </p>
                {/* Breadcrumb path */}
                {modalType === 'subcategory' && selectedCat && (
                  <p style={{
                    color: 'rgba(255,255,255,0.65)',
                    fontSize: 'clamp(9px, 1.5vw, 11px)',
                    marginTop: 2,
                    margin: 0,
                  }}>
                    Under: {selectedCat.name}
                  </p>
                )}
                {modalType === 'subitem' && selectedSub && (
                  <p style={{
                    color: 'rgba(255,255,255,0.65)',
                    fontSize: 'clamp(9px, 1.5vw, 11px)',
                    marginTop: 2,
                    margin: 0,
                  }}>
                    Under: {selectedCat?.name} → {selectedSub.name}
                  </p>
                )}
              </div>
              <button onClick={() => setModalType(null)} style={{
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

            {/* Body */}
            <div style={{
              padding: 'clamp(12px, 3vw, 20px)',
              overflowY: 'auto',
              maxHeight: 'calc(90vh - 130px)',
              flex: 1,
            }}>

              {/* Name */}
              <div style={{ marginBottom: 'clamp(10px, 2vw, 14px)' }}>
                <label style={labelStyle}>
                  Name <span style={{ color: '#8B1A1A' }}>*</span>
                </label>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder={
                    modalType === 'category'    ? 'e.g. Hardware' :
                    modalType === 'subcategory' ? 'e.g. Printer Issues' :
                    'e.g. Paper Jam'
                  }
                  style={inputStyle}
                  autoFocus
                />
              </div>

              {/* Description */}
              <div style={{ marginBottom: 'clamp(10px, 2vw, 14px)' }}>
                <label style={labelStyle}>Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Brief description (optional)..."
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              {modalType === 'category' && (
                <div style={{ marginBottom: 'clamp(10px, 2vw, 14px)' }}>
                  <label style={labelStyle}>Responsible Service Area <span style={{ color: '#8B1A1A' }}>*</span></label>
                  <select value={form.service_area_id} onChange={e => setForm(p => ({ ...p, service_area_id: e.target.value }))} style={inputStyle}>
                    <option value="">Select a service area</option>
                    {serviceAreas.filter(area => area.is_active).map(area => <option key={area.id} value={area.id}>{area.code} — {area.name}</option>)}
                  </select>
                  <div style={{ marginTop: 5, color: '#62748A', fontSize: 'var(--text-xs)' }}>Sub-categories and sub-items automatically belong to this service area.</div>
                </div>
              )}

              {/* Default Priority */}
              <div style={{ marginBottom: 'clamp(10px, 2vw, 14px)' }}>
                <label style={labelStyle}>Default Priority</label>
                <select
                  value={form.default_priority}
                  onChange={e => setForm(p => ({ ...p, default_priority: e.target.value }))}
                  style={inputStyle}
                >
                  {PRIORITIES.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <p style={{ fontSize: 'clamp(8px, 1.5vw, 10px)', color: '#888', marginTop: 3 }}>
                  Auto-fills the priority field when this{' '}
                  {modalType === 'category' ? 'category' :
                   modalType === 'subcategory' ? 'sub-category' : 'sub-item'}{' '}
                  is selected in Submit Ticket.
                </p>
              </div>

              {/* SLA Rule */}
              <div style={{ marginBottom: 6 }}>
                <label style={labelStyle}>
                  Linked SLA Rule
                  {modalType === 'subitem' && (
                    <span style={{
                      marginLeft: 6, background: '#E8F5EE',
                      color: '#1B6B3A', padding: '1px 6px',
                      borderRadius: 3, fontSize: 'clamp(8px, 1.5vw, 10px)',
                    }}>
                      Most specific — overrides parent
                    </span>
                  )}
                  {modalType === 'subcategory' && (
                    <span style={{
                      marginLeft: 6, background: '#FEF3DC',
                      color: '#CC7700', padding: '1px 6px',
                      borderRadius: 3, fontSize: 'clamp(8px, 1.5vw, 10px)',
                    }}>
                      Overrides category SLA
                    </span>
                  )}
                  {modalType === 'category' && (
                    <span style={{
                      marginLeft: 6, background: '#E8F1FA',
                      color: '#0D3B6E', padding: '1px 6px',
                      borderRadius: 3, fontSize: 'clamp(8px, 1.5vw, 10px)',
                    }}>
                      Fallback SLA
                    </span>
                  )}
                </label>
                <SLASelect
                  value={form.sla_rule_id}
                  onChange={val => setForm(p => ({ ...p, sla_rule_id: val }))}
                  slaRules={slaRules}
                />
              </div>
            </div>

            {/* Footer */}
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
                onClick={() => setModalType(null)}
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
                {saving ? 'Saving...' : modalMode === 'create' ? '✓ Save' : '✓ Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== DELETE CONFIRM ===== */}
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
              <p style={{ color: '#fff', fontSize: 'clamp(12px, 2vw, 15px)', fontWeight: 600 }}>
                Confirm Delete
              </p>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 'clamp(10px, 1.8vw, 12px)', color: '#2A2A2A', marginBottom: 12, lineHeight: 1.6 }}>
                Are you sure you want to delete{' '}
                <strong>"{deleteTarget.item.name}"</strong>?
              </p>
              <div style={{
                background: '#FDE8E8', borderRadius: 4,
                padding: '8px 12px', fontSize: 'clamp(8px, 1.5vw, 10px)', color: '#8B1A1A',
              }}>
                ⚠ This will permanently delete this{' '}
                {deleteTypeLabel[deleteTarget.type!]}. Cannot be undone.
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
                  padding: '6px 14px', fontSize: 'clamp(10px, 1.8vw, 12px)',
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
                  padding: '6px 16px', fontSize: 'clamp(10px, 1.8vw, 12px)',
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
          borderRadius: 4, fontSize: 'clamp(10px, 1.8vw, 12px)', fontWeight: 500, zIndex: 300,
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
