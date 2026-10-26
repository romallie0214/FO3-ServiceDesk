import { showErrorToast } from '../utils/notifications';
import { Pencil, Trash2, Plus, Save, Download, Eye, FileText, X } from 'lucide-react';
import '../styles/management-ui.css';

import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

type ServiceArea = { id: number; code: string; name: string; is_active: number };
type Template = { id: number; service_area_id: number; service_area_code: string; service_area_name: string; title: string; description: string; original_filename: string; created_at: string };

export default function ServiceTemplatesHub() {
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedArea, setSelectedArea] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/service-areas'), api.get('/service-templates')])
      .then(([areasResponse, templatesResponse]) => {
        setAreas(areasResponse.data.filter((area: ServiceArea) => Boolean(area.is_active)));
        setTemplates(templatesResponse.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const visibleTemplates = useMemo(() => templates.filter(template => {
    const matchesArea = !selectedArea || String(template.service_area_id) === selectedArea;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [template.title, template.description, template.original_filename, template.service_area_code]
      .filter(Boolean).some(value => String(value).toLowerCase().includes(query));
    return matchesArea && matchesSearch;
  }), [templates, selectedArea, search]);

  async function download(template: Template) {
    try {
      const response = await api.get(`/service-templates/${template.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url; link.download = template.original_filename;
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(url);
    } catch { showErrorToast('Unable to download this template. Please try again.'); }
  }

  return <div className="shared-management-page ServiceTemplatesHub-page">
    <div style={{ fontSize: 'var(--text-xs)', marginBottom: 14 }}>Home / <strong>Download Hub</strong></div>
    <div className="download-hub-heading" style={{ marginBottom: 20, color: 'var(--ui-text, #344456)' }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Service Download Hub</h1>
      <p style={{ margin: '7px 0 0', fontSize: 13, opacity: 0.75 }}>Find the forms and templates required by each FO3 Service Area before making a request.</p>
    </div>
    <div style={{ background: '#fff', border: '1px solid #D0D9E4', borderRadius: 8, padding: 12, display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
      <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search templates or file names…" style={{ flex: '1 1 300px', padding: '9px 10px', border: '1px solid #C8D0DC', borderRadius: 4 }} />
      <select value={selectedArea} onChange={event => setSelectedArea(event.target.value)} style={{ minWidth: 240, padding: '9px 10px', border: '1px solid #C8D0DC', borderRadius: 4, background: '#fff' }}>
        <option value="">All Service Areas</option>
        {areas.map(area => <option key={area.id} value={area.id}>{area.code} — {area.name}</option>)}
      </select>
    </div>
    {loading ? <div style={{ padding: 30, textAlign: 'center' }}>Loading templates…</div> :
      visibleTemplates.length === 0 ? <div style={{ background: '#fff', border: '1px solid #D0D9E4', borderRadius: 8, padding: 32, textAlign: 'center', color: '#667' }}><div className="template-empty-state"><FileText size={30} strokeWidth={1.4} aria-hidden="true" /><span>No templates are available for the selected Service Area.</span></div></div> :
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 14 }}>
        {visibleTemplates.map(template => <article className="shared-resource-card" key={template.id} style={{ background: '#fff', border: '1px solid #D0D9E4', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ color: 'var(--gov-navy)', fontWeight: 700, fontSize: 'var(--text-xs)' }}>{template.service_area_code} · {template.service_area_name}</div>
          <h3 style={{ margin: 0, fontSize: 'var(--text-md)' }}>{template.title}</h3>
          <p style={{ margin: 0, color: '#52657A', fontSize: 'var(--text-sm)', minHeight: 36 }}>{template.description || 'Required service form or template.'}</p>
          <div style={{ fontSize: 'var(--text-xs)', color: '#667', overflowWrap: 'anywhere' }}>{template.original_filename}</div>
          <button type="button" onClick={() => void download(template)} style={{ marginTop: 'auto', padding: '8px 10px', border: 0, borderRadius: 4, color: '#fff', background: 'var(--gov-navy)', cursor: 'pointer' }}><Download size={14} /> Download template</button>
        </article>)}
      </div>}
  </div>;
}
