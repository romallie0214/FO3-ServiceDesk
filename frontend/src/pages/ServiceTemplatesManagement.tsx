import Pagination from '../components/Pagination';
import AppTable from '../components/AppTable';
import SummaryCards from '../components/dashboard/SummaryCards';
import { Pencil, Trash2, Plus, Save, Download, Eye, FileText, X, Search, SlidersHorizontal, ChevronDown, Files, Layers, ListFilter } from 'lucide-react';
import '../styles/management-ui.css';

import { Fragment, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

type Area = { id: number; code: string; name: string; is_active: number };
type Template = { id: number; service_area_id: number; service_area_code: string; service_area_name?: string; category: string; title: string; description: string; original_filename: string; mime_type: string; created_at: string; updated_at?: string };
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 10px', border: '1px solid #C8D0DC', borderRadius: 4, background: '#fff' };
const button: React.CSSProperties = { padding: '6px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 'var(--text-xs)' };

export default function ServiceTemplatesManagement() {
  const { user } = useAuth();
  const filtersRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => { if (event.target instanceof Node && filtersRef.current && !filtersRef.current.contains(event.target)) filtersRef.current.open = false; };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);
  const isSuperAdmin = user?.role === 'super_admin';
  const allowed = user?.area_admin_service_ids || [];
  const [areas, setAreas] = useState<Area[]>([]);
  const [items, setItems] = useState<Template[]>([]);
  const [search, setSearch] = useState(''); const [areaFilter, setAreaFilter] = useState('all'); const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1); const [size, setSize] = useState(10); const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null); const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ service_area_id: '', category: 'General', title: '', description: '' });
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null); const [toast, setToast] = useState('');
  const [preview, setPreview] = useState<{ title: string; url: string } | null>(null);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  async function load() {
    try {
      const [a, t] = await Promise.all([api.get('/service-areas'), api.get('/service-templates')]);
      const visibleAreas = a.data.filter((x: Area) => x.is_active && (isSuperAdmin || allowed.includes(x.id)));
      setAreas(visibleAreas); setItems(t.data.filter((x: Template) => isSuperAdmin || allowed.includes(x.service_area_id)));
      if (!isSuperAdmin && visibleAreas.length === 1) setAreaFilter(String(visibleAreas[0].id));
    } catch { say('Unable to load service templates.'); }
  }
  useEffect(() => { void load(); }, [user?.id]); useEffect(() => setPage(1), [search, areaFilter, categoryFilter]);
  const filtered = items.filter(x => (areaFilter === 'all' || String(x.service_area_id) === areaFilter) && (!categoryFilter || x.category === categoryFilter) && (!search || [x.title, x.description, x.original_filename, x.category].filter(Boolean).some(v => v.toLowerCase().includes(search.toLowerCase()))));
  const pages = Math.max(1, Math.ceil(filtered.length / size)), current = Math.min(page, pages), rows = filtered.slice((current - 1) * size, current * size);
  const categories = [...new Set(items.map(item => item.category || 'General'))].sort();
  function open(item?: Template) { setEditing(item || null); setFile(null); setError(''); setForm(item ? { service_area_id: String(item.service_area_id), category: item.category || 'General', title: item.title, description: item.description || '' } : { service_area_id: areaFilter === 'all' ? '' : areaFilter, category: 'General', title: '', description: '' }); setShowModal(true); }
  async function save() {
    if (!form.service_area_id || !form.title.trim() || (!editing && !file)) { setError('Service area, title, and a file are required.'); return; }
    const fd = new FormData(); fd.append('service_area_id', form.service_area_id); fd.append('category', form.category); fd.append('title', form.title); fd.append('description', form.description); if (file) fd.append('file', file);
    setSaving(true); try { editing ? await api.patch('/service-templates/' + editing.id, fd) : await api.post('/service-templates', fd); setShowModal(false); say(editing ? 'Template updated.' : 'Template published.'); await load(); } catch (e: any) { setError(e.response?.data?.error || 'Unable to save template.'); } finally { setSaving(false); }
  }
  async function remove() { if (!deleteTarget) return; try { await api.delete('/service-templates/' + deleteTarget.id); setDeleteTarget(null); say('Template deleted.'); await load(); } catch { say('Unable to delete template.'); } }
  async function previewFile(template: Template) {
    try {
      const response = await api.get('/service-templates/' + template.id + '/download', { responseType: 'blob' });
      setPreview({ title: template.title, url: URL.createObjectURL(response.data) });
    } catch { say('Unable to preview this template.'); }
  }
  function closePreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }
  return <div className="shared-management-page ServiceTemplatesManagement-page">
    <div style={{ fontSize: 'var(--text-xs)', marginBottom: 14 }}>Home / <strong>Service Templates</strong></div>
    <div style={{ background: '#E8F1FA', borderLeft: '3px solid var(--gov-navy)', borderRadius: 4, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}><span>Manage downloadable forms and templates visible in the Service Download Hub.</span><button onClick={() => open()} style={{ ...button, border: 0, background: 'var(--gov-green)', color: '#fff' }}><Plus size={14} /> New Template</button></div>
    <SummaryCards cards={[
      { label: 'Total Templates', value: items.length, color: '#0D3B6E', background: '#E8F1FA', icon: Files },
      { label: 'Service Areas', value: new Set(items.map(item => item.service_area_id)).size, color: '#1B6B3A', background: '#E8F5EE', icon: Layers },
      { label: 'Showing', value: filtered.length, color: '#CC7700', background: '#FEF3DC', icon: ListFilter },
    ]} />
    <div className="sla-filter-toolbar kb-management-toolbar">
      <label className="kb-management-search"><Search size={14} /><input aria-label="Search templates" placeholder="Search templates..." value={search} onChange={event => setSearch(event.target.value)} /></label>
      <details ref={filtersRef} className="sla-filter-dropdown" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}>
        <summary><SlidersHorizontal size={14} />Template Filters{(categoryFilter || areaFilter !== 'all') && <span>{Number(!!categoryFilter) + Number(areaFilter !== 'all')}</span>}<ChevronDown size={14} /></summary>
        <div className="sla-filter-menu">
          <label>Category<select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="">All categories</option>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
          <label>Service area<select value={areaFilter} onChange={event => setAreaFilter(event.target.value)}>{isSuperAdmin && <option value="all">All service areas</option>}{areas.map(area => <option key={area.id} value={area.id}>{area.code} ? {area.name}</option>)}</select></label>
          <div className="sla-filter-actions"><button onClick={() => { setCategoryFilter(''); setAreaFilter(isSuperAdmin ? 'all' : String(areas[0]?.id || 'all')); }}>Clear filters</button><button onClick={() => { if (filtersRef.current) filtersRef.current.open = false; }}>Done</button></div>
        </div>
      </details>
      <span className="kb-management-count">{filtered.length} of {items.length} templates</span>
    </div>
    <div style={{ background: '#fff', border: '1px solid #D0D9E4', borderRadius: 8, overflow: 'hidden' }}><div style={{ overflowX: 'auto' }}><AppTable className="shared-management-table" style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}><thead><tr>{['Service Area', 'Category', 'Title', 'Description', 'PDF', 'Last Updated', 'Actions'].map(h => <th key={h} style={{ textAlign: 'left', padding: 10, background: 'var(--gov-navy)', color: '#fff', fontSize: 'var(--text-xs)' }}>{h}</th>)}</tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center' }}><div className="template-empty-state"><FileText size={30} strokeWidth={1.4} aria-hidden="true" /><span>No templates match the selected filters.</span></div></td></tr> : Object.entries(rows.reduce<Record<string, Template[]>>((groups, item) => { const key = item.service_area_code + ' — ' + (item.service_area_name || 'Service Area'); (groups[key] ||= []).push(item); return groups; }, {})).map(([area, group]) => <Fragment key={area}><tr><td colSpan={7} style={{ padding: '9px 10px', background: '#E8F1FA', color: 'var(--gov-navy)', fontWeight: 700 }}>{area}</td></tr>{group.map(x => <tr key={x.id} style={{ borderBottom: '1px solid #EEF1F5' }}><td style={{ padding: 10, fontWeight: 600 }}>{x.service_area_code}</td><td style={{ padding: 10 }}><span style={{ padding: '3px 8px', borderRadius: 4, background: '#E8F1FA', color: 'var(--gov-navy)', fontSize: 'var(--text-xs)' }}>{x.category || 'General'}</span></td><td style={{ padding: 10 }}><strong>{x.title}</strong></td><td style={{ padding: 10, color: '#52657A' }}>{x.description || '—'}</td><td style={{ padding: 10 }}>{x.mime_type === 'application/pdf' ? <button onClick={() => void previewFile(x)} style={{ ...button, background: '#E8F5EE', color: '#1B6B3A', border: '1px solid #9AC9AA' }}><Eye size={14} /> Preview</button> : <span style={{ fontSize: 'var(--text-xs)', color: '#667' }}>Download only</span>}</td><td style={{ padding: 10, fontSize: 'var(--text-xs)' }}>{new Date(x.updated_at || x.created_at).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td><td style={{ padding: 10 }}><button onClick={() => open(x)} style={{ ...button, background: 'var(--gov-navy)', color: '#fff', border: 0, marginRight: 5 }}><Pencil size={14} /> Edit</button><button onClick={() => setDeleteTarget(x)} style={{ ...button, background: '#fff', color: '#8B1A1A', border: '1px solid #E4B4B4' }}><Trash2 size={14} /> Delete</button></td></tr>)}</Fragment>)}</tbody></AppTable></div>
{filtered.length > 0 && <Pagination attached page={current} total={filtered.length} pageSize={size} onPageChange={setPage} onPageSizeChange={setSize} />}
</div>

    {showModal && <div onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,20,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}><div className="shared-management-dialog" onClick={e => e.stopPropagation()} style={{ background: '#fff', width: 'min(550px,95vw)', borderRadius: 9, overflow: 'hidden' }}><div style={{ background: 'var(--gov-navy)', color: '#fff', padding: 15, display: 'flex', justifyContent: 'space-between' }}><strong>{editing ? 'Edit Template' : 'New Template'}</strong><button onClick={() => setShowModal(false)} style={{ background: 'none', border: 0, color: '#fff', fontSize: 20 }}>×</button></div><div style={{ padding: 18 }}>{error && <div style={{ padding: 9, color: '#8B1A1A', background: '#FDE8E8', marginBottom: 10 }}>{error}</div>}<label>Service Area *</label><select value={form.service_area_id} onChange={e => setForm({ ...form, service_area_id: e.target.value })} style={{ ...input, margin: '5px 0 12px' }}><option value="">Select service area</option>{areas.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</select><label>Title *</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={{ ...input, margin: '5px 0 12px' }} /><label>Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ ...input, minHeight: 80, margin: '5px 0 12px' }} /><label>{editing ? 'Replace file (optional)' : 'Template file *'} <small>(PDF, Word, Excel)</small></label><input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={e => setFile(e.target.files?.[0] || null)} style={{ margin: '7px 0 16px' }} />{editing && !file && <small>Current: {editing.original_filename}</small>}<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}><button onClick={() => setShowModal(false)} style={{ ...button, background: '#fff', border: '1px solid #C8D0DC' }}>Cancel</button><button disabled={saving} onClick={() => void save()} style={{ ...button, background: 'var(--gov-green)', color: '#fff', border: 0 }}>{saving ? 'Saving…' : 'Save Template'}</button></div></div></div></div>}
    {deleteTarget && <div onClick={() => setDeleteTarget(null)} style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(0,0,20,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="shared-management-dialog" onClick={e => e.stopPropagation()} style={{ background: '#fff', width: 390, borderRadius: 8, overflow: 'hidden' }}><div style={{ padding: 14, color: '#fff', background: '#8B1A1A' }}>Confirm Delete</div><div style={{ padding: 18 }}>Delete <strong>{deleteTarget.title}</strong> and its file?</div><div style={{ padding: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button onClick={() => setDeleteTarget(null)} style={{ ...button, background: '#fff', border: '1px solid #C8D0DC' }}>Cancel</button><button onClick={() => void remove()} style={{ ...button, color: '#fff', background: '#8B1A1A', border: 0 }}><Trash2 size={14} /> Delete</button></div></div></div>}
    {preview && <div onClick={closePreview} style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(0,0,20,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}><div className="shared-management-dialog" onClick={event => event.stopPropagation()} style={{ width: 'min(1100px,95vw)', height: 'min(820px,92vh)', background: '#fff', borderRadius: 9, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}><div style={{ background: 'var(--gov-navy)', color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong>Preview: {preview.title}</strong><button onClick={closePreview} style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: 0, borderRadius: 4, fontSize: 20, cursor: 'pointer' }}>×</button></div><iframe src={preview.url} title={preview.title} style={{ flex: 1, border: 0 }} /></div></div>}
    {toast && <div style={{ position: 'fixed', right: 20, bottom: 20, background: 'var(--gov-green)', color: '#fff', padding: '10px 14px', borderRadius: 4 }}>{toast}</div>}
  </div>;
}
