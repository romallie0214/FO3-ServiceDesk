import Pagination from '../components/Pagination';
import AppTable from '../components/AppTable';
import './ServiceAreaManagement.css';
import SummaryCards from '../components/dashboard/SummaryCards';
import { Layers, CircleCheck, Pencil, Plus, Save, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../services/api';

type Division = { division_code: string; division_name: string };
type Unit = { unit_code: string; unit_name: string };
type Area = { id: number; code: string; name: string; division_code: string | null; division: string | null; unit_code: string | null; unit: string | null; description: string | null; is_active: number; category_count: number };
type Form = { code: string; name: string; division_code: string; division: string; unit_code: string; unit: string; description: string };
const empty: Form = { code: '', name: '', division_code: '', division: '', unit_code: '', unit: '', description: '' };
const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 10px', border: '1px solid #C8D0DC', borderRadius: 5, background: '#fff', color: '#172B4D' };
const label: React.CSSProperties = { display: 'block', margin: '12px 0 5px', color: '#4A5D75', fontSize: 11, fontWeight: 700, letterSpacing: .35, textTransform: 'uppercase' };

export default function ServiceAreaManagement() {
  const [areas, setAreas] = useState<Area[]>([]); const [divisions, setDivisions] = useState<Division[]>([]); const [units, setUnits] = useState<Unit[]>([]); const [selected, setSelected] = useState<Area | null>(null); const [form, setForm] = useState<Form>(empty); const [saving, setSaving] = useState(false); const [notice, setNotice] = useState(''); const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); try { const [areasResponse, divisionsResponse] = await Promise.all([api.get('/service-areas'), api.get('/users/erm/divisions')]); setAreas(areasResponse.data); setDivisions(divisionsResponse.data); } catch (err: any) { setNotice(err.response?.data?.error || 'Unable to load service areas. Apply the database migration, then retry.'); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const newArea = () => { setSelected(null); setForm(empty); setUnits([]); };
  const edit = (area: Area) => { setSelected(area); const division = divisions.find(item => item.division_code === area.division_code || item.division_name === area.division); const divisionCode = division?.division_code || area.division_code || ''; setForm({ code: area.code, name: area.name, division_code: divisionCode, division: area.division || '', unit_code: area.unit_code || '', unit: area.unit || '', description: area.description || '' }); setUnits([]); if (divisionCode) void api.get(`/users/erm/units/${divisionCode}`).then(result => setUnits(result.data)); };
  const changeDivision = async (divisionCode: string) => { const division = divisions.find(item => item.division_code === divisionCode); setForm(current => ({ ...current, division_code: divisionCode, division: division?.division_name || '', unit_code: '', unit: '' })); setUnits(divisionCode ? (await api.get(`/users/erm/units/${divisionCode}`)).data : []); };
  const changeUnit = (unitCode: string) => { const unit = units.find(item => item.unit_code === unitCode); setForm(current => ({ ...current, unit_code: unitCode, unit: unit?.unit_name || '' })); };
  const save = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); try { if (selected) await api.put(`/service-areas/${selected.id}`, { ...form, is_active: selected.is_active }); else await api.post('/service-areas', form); setNotice(selected ? 'Service area updated.' : 'Service area created.'); newArea(); await load(); } catch (err: any) { setNotice(err.response?.data?.error || 'Unable to save service area.'); } finally { setSaving(false); } };
  const active = areas.filter(area => area.is_active).length;
  useEffect(() => { setPage(1); }, [areas, pageSize]);
  const totalPages = Math.max(1, Math.ceil(areas.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedAreas = areas.slice(pageStart, pageStart + pageSize);
  return <div className="service-area-page" style={{ width: '100%', maxWidth: 'none', boxSizing: 'border-box', color: '#172B4D' }}>
    <div style={{ fontSize: 12, color: '#62748A', marginBottom: 12 }}>Settings / <strong>Service Areas</strong></div>
    {notice && <div style={{ marginBottom: 14, padding: '10px 12px', border: '1px solid #BFD3E7', borderRadius: 6, background: '#EEF6FF', color: '#0D3B6E' }}>{notice}</div>}
    <SummaryCards cards={[
      { label: 'Service areas', value: areas.length, color: '#0D3B6E', background: '#E8F1FA', icon: Layers },
      { label: 'Active areas', value: active, color: '#1B6B3A', background: '#E8F5EE', icon: CircleCheck },
    ]} />
    <div className="service-area-layout" style={{ display: 'grid', gridTemplateColumns: '360px minmax(0,1fr)', gap: 18, alignItems: 'start' }}>
      <form className="service-area-form" onSubmit={save} style={{ padding: 18, background: '#fff', border: '1px solid #D5DFEA', borderRadius: 9 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><h2 style={{ margin: 0, fontSize: 16 }}>{selected ? 'Edit service area' : 'New service area'}</h2>{selected && <button type="button" onClick={newArea} style={{ border: 0, color: '#0D3B6E', background: 'none', cursor: 'pointer' }}><Plus size={13} /> New</button>}</div><label style={label}>Service code *</label><input required value={form.code} maxLength={30} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} style={field} placeholder="e.g. BGMS" /><label style={label}>Service-area name *</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={field} placeholder="e.g. Budget and Grants Management" /><label style={label}>Division</label><select value={form.division_code} onChange={e => void changeDivision(e.target.value)} style={field}><option value="">Select a division</option>{divisions.map(item => <option key={item.division_code} value={item.division_code}>{item.division_name}</option>)}</select><label style={label}>Section / Unit</label><select disabled={!form.division_code} value={form.unit_code} onChange={e => changeUnit(e.target.value)} style={{ ...field, opacity: form.division_code ? 1 : .6 }}><option value="">{form.division_code ? 'Select a section / unit' : 'Choose a division first'}</option>{units.map(item => <option key={item.unit_code} value={item.unit_code}>{item.unit_name}</option>)}</select><label style={label}>Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} style={{ ...field, resize: 'vertical' }} />{selected && <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, padding: 10, background: '#F4F7FB', borderRadius: 5, fontSize: 13 }}><input type="checkbox" checked={Boolean(selected.is_active)} onChange={e => setSelected({ ...selected, is_active: e.target.checked ? 1 : 0 })} /> Active service area</label>}<button disabled={saving} style={{ width: '100%', marginTop: 16, padding: 10, border: 0, borderRadius: 5, color: '#fff', background: '#0D3B6E', fontWeight: 700 }}>{saving ? <><LoaderCircle size={14} className="service-area-spinner" /> Saving...</> : <><Save size={14} />{selected ? 'Save changes' : 'Create service area'}</>}</button></form>
      <section className="service-area-panel" style={{ background: '#fff', border: '1px solid #D5DFEA', borderRadius: 9, overflow: 'hidden' }}><div style={{ padding: '12px 16px', background: '#F4F7FB', fontWeight: 700 }}>Configured service areas</div><><div className="service-area-table-scroll"><AppTable loading={loading} loadingColumns={6} empty={areas.length === 0} emptyMessage="No service areas yet. Create the first one using the form." className="service-area-table"><thead><tr><th>Code</th><th>Service Area</th><th>Division / Unit</th><th>Categories</th><th>Status</th><th>Actions</th></tr></thead><tbody>{paginatedAreas.map(area => <tr key={area.id} data-selected={selected?.id === area.id}>
        <td>{area.code}</td><td><div>{area.name}</div>{area.description && <small>{area.description}</small>}</td><td><div>{area.division || 'No division selected'}</div>{area.unit && <small>{area.unit}</small>}</td><td>{area.category_count}</td><td><span className="service-area-status" data-active={!!area.is_active}>{area.is_active ? 'Active' : 'Inactive'}</span></td><td><button type="button" onClick={() => edit(area)}><Pencil size={13} />Edit</button></td>
      </tr>)}</tbody></AppTable></div><Pagination attached page={currentPage} total={areas.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} /></></section>
    </div>
  </div>;
}
