import Pagination from '../components/Pagination';
import { showErrorToast } from '../utils/notifications';
import AppTable from '../components/AppTable';
import SummaryCards from '../components/dashboard/SummaryCards';
import { Pencil, Trash2, Plus, Save, Download, Eye, FileText, X, Search, SlidersHorizontal, ChevronDown, Files, FileCheck, FileQuestion } from 'lucide-react';
import '../styles/management-ui.css';

import { Fragment, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';


// ─── Types ────────────────────────────────────────────────────────────────────
interface Article {
  id: number;
  service_area_id: number;
  service_area_code?: string;
  service_area_name?: string;
  category: string;
  title: string;
  description: string;
  pdf_filename: string | null;
  created_at: string;
  updated_at: string;
}
interface ServiceArea { id: number; code: string; name: string; is_active: number; }

// ─── Constants ────────────────────────────────────────────────────────────────
const PRESET_CATEGORIES = [
  'Hardware', 'Network', 'Email', 'Access & Accounts', 'Software', 'Onboarding',
];

const categoryColors: Record<string, { bg: string; color: string }> = {
  'Hardware':          { bg: '#E8F1FA', color: '#0D3B6E' },
  'Network':           { bg: '#FEF3DC', color: '#CC7700' },
  'Email':             { bg: '#E8F5EE', color: '#1B6B3A' },
  'Access & Accounts': { bg: '#FDE8E8', color: '#8B1A1A' },
  'Software':          { bg: '#F3F0FF', color: '#5B21B6' },
  'Onboarding':        { bg: '#F0F0F0', color: '#4A4A4A' },
};

function getCatStyle(cat: string) {
  return categoryColors[cat] ?? { bg: '#EEF0F4', color: '#444' };
}

function formatDate(str: string) {
  return new Date(str).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Shared styles (matching StatusManagement exactly) ────────────────────────
const inputStyle: React.CSSProperties = {
  padding: 'clamp(6px, 1.2vw, 10px) clamp(8px, 1.5vw, 12px)', border: '1px solid #C8D0DC',
  borderRadius: 4, fontSize: 'clamp(10px, 1.8vw, 13px)', width: '100%',
  background: '#fff', color: '#2A2A2A', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 'clamp(9px, 1.6vw, 12px)', fontWeight: 500, color: '#5A6475',
  textTransform: 'uppercase', letterSpacing: 0.4,
  display: 'block', marginBottom: 'clamp(3px, 0.6vw, 5px)',
};

// ─── PDF Viewer Modal ─────────────────────────────────────────────────────────
function PDFViewerModal({ article, onClose }: { article: Article; onClose: () => void }) {
  const [pdfUrl, setPdfUrl] = useState('');
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    let objectUrl = '';
    api.get(`/knowledge-base/${article.id}/pdf`, { responseType: 'blob' })
      .then(response => {
        objectUrl = URL.createObjectURL(response.data);
        setPdfUrl(objectUrl);
      })
      .catch(() => setPreviewError('Unable to load this PDF preview.'));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [article.id]);
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,20,0.55)',
        zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(12px, 3vw, 20px)',
      }}
    >
      <div
        className="shared-management-dialog" onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', width: 'clamp(280px, 95vw, 90vw)', height: 'clamp(300px, 92vh, 92vh)',
          borderRadius: 10, border: '0.5px solid #C0C8D4',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{
          background: 'var(--gov-navy)', padding: 'clamp(12px, 2vw, 16px) clamp(14px, 3vw, 20px)', flexShrink: 0,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'clamp(8px, 2vw, 12px)',
        }}>
          <p style={{ color: '#fff', fontSize: 'clamp(12px, 2vw, 16px)', fontWeight: 600, margin: 0 }}>
            📄 {article.title}
          </p>
          <div style={{ display: 'flex', gap: 'clamp(6px, 1.5vw, 10px)', alignItems: 'center' }}>
            <a href={pdfUrl} target="_blank" rel="noreferrer" style={{
              fontSize: 'clamp(9px, 1.6vw, 12px)', color: 'rgba(255,255,255,0.85)', textDecoration: 'none',
              padding: 'clamp(3px, 0.6vw, 5px) clamp(8px, 1.5vw, 12px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4,
              whiteSpace: 'nowrap',
            }}>
              Open in new tab ↗
            </a>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 4,
              width: 'clamp(24px, 5vw, 32px)', height: 'clamp(24px, 5vw, 32px)', cursor: 'pointer', color: '#fff', fontSize: 'clamp(16px, 3vw, 20px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>×</button>
          </div>
        </div>
        {previewError
          ? <div style={{ padding: 24, color: '#8B1A1A' }}>{previewError}</div>
          : pdfUrl
            ? <iframe src={pdfUrl} style={{ flex: 1, border: 'none', width: '100%' }} title={article.title} />
            : <div style={{ padding: 24, textAlign: 'center' }}>Loading PDF preview…</div>}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function KnowledgeBaseManagement() {
  const { user } = useAuth();
  const managedAreaIds = user?.role === 'super_admin' ? null : (user?.area_admin_service_ids || []);
  const [articles, setArticles]             = useState<Article[]>([]);
  const [loading, setLoading]               = useState(true);
  const [showModal, setShowModal]           = useState(false);
  const [editArticle, setEditArticle]       = useState<Article | null>(null);
  const [deleteTarget, setDeleteTarget]     = useState<Article | null>(null);
  const [previewArticle, setPreviewArticle] = useState<Article | null>(null);
  const [deleting, setDeleting]             = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [toast, setToast]                   = useState({ msg: '', type: '' });

  // Filters
  const [search, setSearch]       = useState('');
  const articleFiltersRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => { if (event.target instanceof Node && articleFiltersRef.current && !articleFiltersRef.current.contains(event.target)) articleFiltersRef.current.open = false; };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);
  const [filterCat, setFilterCat] = useState('');
  const [filterPdf, setFilterPdf] = useState<'all' | 'with' | 'without'>('all');
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [filterServiceArea, setFilterServiceArea] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Form fields
  const [formCategory, setFormCategory]         = useState('');
  const [formServiceArea, setFormServiceArea]   = useState('');
  const [formTitle, setFormTitle]               = useState('');
  const [formDescription, setFormDescription]   = useState('');
  const [formPdf, setFormPdf]                   = useState<File | null>(null);
  const [formError, setFormError]               = useState('');
  const [customCat, setCustomCat]               = useState(false);
  const [removePdf, setRemovePdf]               = useState(false);
  const [dragOver, setDragOver]                 = useState(false);
  const fileRef                                  = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchArticles(); api.get('/service-areas').then(res => setServiceAreas(res.data.filter((area: ServiceArea) => !managedAreaIds || managedAreaIds.includes(area.id)))).catch(() => setServiceAreas([])); }, []);

  useEffect(() => { if (managedAreaIds?.length) setFilterServiceArea(String(managedAreaIds[0])); }, [user?.id]);

  async function fetchArticles() {
    try {
      const res = await api.get('/knowledge-base');
      setArticles(managedAreaIds ? res.data.filter((article: Article) => managedAreaIds.includes(Number(article.service_area_id))) : res.data);
    } catch {
      showToast('Failed to load articles.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: '' }), 3000);
  }

  function openCreate() {
    setEditArticle(null);
    setFormCategory(''); setFormTitle('');
    setFormServiceArea(filterServiceArea === 'all' ? '' : filterServiceArea);
    setFormDescription(''); setFormPdf(null);
    setFormError(''); setCustomCat(false); setRemovePdf(false);
    setShowModal(true);
  }

  function openEdit(a: Article) {
    setEditArticle(a);
    setFormCategory(a.category);
    setFormServiceArea(String(a.service_area_id || ''));
    setFormTitle(a.title);
    setFormDescription(a.description ?? '');
    setFormPdf(null);
    setFormError('');
    setCustomCat(!PRESET_CATEGORIES.includes(a.category));
    setRemovePdf(false);
    setShowModal(true);
  }

  function handleFile(file: File | null) {
    if (!file) return;
    if (file.type !== 'application/pdf') { setFormError('Only PDF files are allowed.'); return; }
    if (file.size > 20 * 1024 * 1024)   { setFormError('File must be under 20 MB.'); return; }
    setFormError('');
    setFormPdf(file);
    setRemovePdf(false);
  }

  async function handleSave() {
    if (!formServiceArea) { setFormError('Select a service area.'); return; }
    if (!formCategory.trim()) { setFormError('Please select or enter a category.'); return; }
    if (!formTitle.trim())    { setFormError('Title is required.'); return; }
    setSaving(true); setFormError('');
    try {
      const fd = new FormData();
      fd.append('service_area_id', formServiceArea);
      fd.append('category',    formCategory.trim());
      fd.append('title',       formTitle.trim());
      fd.append('description', formDescription.trim());
      if (formPdf) fd.append('pdf', formPdf);

      if (editArticle) {
        if (removePdf && !formPdf) {
          await api.delete(`/knowledge-base/${editArticle.id}/pdf`);
        }
        await api.patch(`/knowledge-base/${editArticle.id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        showToast(`"${formTitle}" updated successfully.`);
      } else {
        await api.post('/knowledge-base', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        showToast(`"${formTitle}" created successfully.`);
      }
      setShowModal(false);
      fetchArticles();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/knowledge-base/${deleteTarget.id}`);
      showToast(`"${deleteTarget.title}" deleted.`);
      setDeleteTarget(null);
      fetchArticles();
    } catch (err: any) {
      showErrorToast(err.response?.data?.error || 'Failed to delete.');
    } finally {
      setDeleting(false);
    }
  }

  const categories = [...new Set(articles.map(a => a.category))].sort();
  const withPdf    = articles.filter(a => a.pdf_filename).length;
  const withoutPdf = articles.length - withPdf;

  const filtered = articles.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      a.title.toLowerCase().includes(q) ||
      (a.description ?? '').toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q);
    const matchCat = !filterCat || a.category === filterCat;
    const matchService = filterServiceArea === 'all' || String(a.service_area_id) === filterServiceArea;
    const matchPdf =
      filterPdf === 'with'    ? !!a.pdf_filename :
      filterPdf === 'without' ? !a.pdf_filename  : true;
    return matchSearch && matchCat && matchPdf && matchService;
  });

  useEffect(() => {
    setPage(1);
  }, [search, filterCat, filterPdf, filterServiceArea, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedArticles = filtered.slice(pageStart, pageStart + pageSize);

  if (loading) return (
    <div style={{ color: 'var(--gov-navy)', padding: 'clamp(24px, 4vw, 40px)', textAlign: 'center' }}>
      Loading articles...
    </div>
  );

  return (
    <div className="shared-management-page KnowledgeBaseManagement-page">
      {/* BREADCRUMB */}
      <div style={{ fontSize: 'clamp(10px, 1.8vw, 13px)', color: '#4A4A4A', marginBottom: 'clamp(10px, 2vw, 14px)' }}>
        Home <span style={{ color: 'var(--gov-navy)', fontWeight: 500 }}>
          / Knowledge Base Management
        </span>
      </div>

      {/* INFO STRIP */}
      <div style={{
        background: '#E8F1FA', borderLeft: '3px solid var(--gov-navy)',
        borderRadius: '0 4px 4px 0', padding: 'clamp(8px, 2vw, 12px) clamp(10px, 3vw, 16px)',
        fontSize: 'clamp(10px, 1.8vw, 13px)', color: 'var(--gov-navy)', marginBottom: 'clamp(10px, 2vw, 14px)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 'clamp(8px, 2vw, 12px)',
      }}>
        <span>
          Manage knowledge base articles visible on the staff portal.
          Upload a <strong>PDF</strong> to each article so staff can open and read it directly.
        </span>
        <button
          onClick={openCreate}
          style={{
            padding: 'clamp(5px, 1.2vw, 8px) clamp(10px, 2vw, 16px)', fontSize: 'clamp(10px, 1.8vw, 13px)',
            background: 'var(--gov-green)', color: '#fff',
            border: 'none', borderRadius: 4,
            cursor: 'pointer', fontWeight: 500,
            whiteSpace: 'nowrap', flexShrink: 0,
          }}
        ><Plus size={14} /> New Article</button>
      </div>

      <SummaryCards cards={[
        { label: 'Total Articles', value: articles.length, color: '#0D3B6E', background: '#E8F1FA', icon: Files },
        { label: 'With PDF', value: withPdf, color: '#1B6B3A', background: '#E8F5EE', icon: FileCheck },
        { label: 'No PDF Yet', value: withoutPdf, color: '#CC7700', background: '#FEF3DC', icon: FileQuestion },
      ]} />
      <div className="sla-filter-toolbar kb-management-toolbar">
        <label className="kb-management-search"><Search size={14} /><input aria-label="Search articles" placeholder="Search articles..." value={search} onChange={event => setSearch(event.target.value)} /></label>
        <details ref={articleFiltersRef} className="sla-filter-dropdown" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}>
          <summary><SlidersHorizontal size={14} />Article Filters{(filterCat || filterPdf !== 'all' || filterServiceArea !== 'all') && <span>{Number(!!filterCat) + Number(filterPdf !== 'all') + Number(filterServiceArea !== 'all')}</span>}<ChevronDown size={14} /></summary>
          <div className="sla-filter-menu">
            <label>Category<select value={filterCat} onChange={event => setFilterCat(event.target.value)}><option value="">All categories</option>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
            <label>Service area<select value={filterServiceArea} onChange={event => setFilterServiceArea(event.target.value)}>{!managedAreaIds && <option value="all">All service areas</option>}{serviceAreas.filter(area => area.is_active).map(area => <option key={area.id} value={area.id}>{area.code} ? {area.name}</option>)}</select></label>
            <label>PDF status<select value={filterPdf} onChange={event => setFilterPdf(event.target.value as 'all' | 'with' | 'without')}><option value="all">All articles</option><option value="with">Has PDF</option><option value="without">No PDF</option></select></label>
            <div className="sla-filter-actions"><button onClick={() => { setFilterCat(''); setFilterPdf('all'); setFilterServiceArea(managedAreaIds?.[0] ? String(managedAreaIds[0]) : 'all'); }}>Clear filters</button><button onClick={() => { if (articleFiltersRef.current) articleFiltersRef.current.open = false; }}>Done</button></div>
          </div>
        </details>
        <span className="kb-management-count">{filtered.length} of {articles.length} articles</span>
      </div>

      {/* ARTICLES TABLE */}
      <div style={{
        background: '#fff', border: '0.5px solid #D0D9E4',
        borderRadius: 8, overflow: 'hidden',
      }}>
        <div style={{
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}>
          <AppTable className="shared-management-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead>
              <tr>
                {['Service Area', 'Category', 'Title', 'Description', 'PDF', 'Last Updated', 'Actions'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: 'clamp(7px, 1.5vw, 12px) clamp(10px, 2vw, 16px)',
                    fontSize: 'clamp(9px, 1.6vw, 12px)', fontWeight: 500,
                    color: '#fff', background: 'var(--gov-navy)',
                    whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 'clamp(30px, 8vw, 48px)', textAlign: 'center', color: '#888', fontSize: 'clamp(11px, 1.9vw, 14px)' }}>
                    {articles.length === 0
                      ? 'No articles yet. Click "+ New Article" to get started.'
                      : 'No articles match your search or filters.'}
                  </td>
                </tr>
              ) : paginatedArticles.map((a, index) => {
                const cs = getCatStyle(a.category);
                return (
                  <Fragment key={a.id}>
                  {filterServiceArea === 'all' && (index === 0 || filtered[index - 1].service_area_id !== a.service_area_id) && <tr><td colSpan={7} style={{ padding: '8px 12px', background: '#E8F1FA', color: '#0D3B6E', fontWeight: 700, fontSize: 'var(--text-xs)' }}>{a.service_area_code || 'UNASSIGNED'} — {a.service_area_name || 'Unassigned Service Area'}</td></tr>}
                  <tr
                    onMouseEnter={e => (e.currentTarget.style.background = '#F5F8FC')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    <td style={{ padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', fontSize: 'var(--text-xs)', color: '#0D3B6E', fontWeight: 600 }}>{a.service_area_code || '—'}</td>
                    {/* Category */}
                    <td style={{ padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', whiteSpace: 'nowrap' }}>
                      <span style={{
                        display: 'inline-block',
                        background: cs.bg, color: cs.color,
                        fontSize: 'clamp(8px, 1.5vw, 11px)', fontWeight: 500,
                        padding: 'clamp(2px, 0.5vw, 4px) clamp(6px, 1.2vw, 10px)', borderRadius: 4,
                        textTransform: 'uppercase', letterSpacing: 0.4,
                        border: `1px solid ${cs.color}33`,
                      }}>
                        {a.category}
                      </span>
                    </td>

                    {/* Title */}
                    <td style={{ padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', minWidth: 'clamp(140px, 20vw, 220px)' }}>
                      <div style={{ fontSize: 'clamp(10px, 1.8vw, 13px)', fontWeight: 500, color: '#1A2A3A' }}>
                        {a.title}
                      </div>
                      <div style={{ fontSize: 'clamp(8px, 1.5vw, 11px)', color: '#aaa', marginTop: 'clamp(1px, 0.5vw, 3px)' }}>ID #{a.id}</div>
                    </td>

                    {/* Description */}
                    <td style={{ padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', fontSize: 'clamp(9px, 1.6vw, 12px)', color: '#5A6475', maxWidth: 'clamp(180px, 25vw, 320px)' }}>
                      <div style={{
                        overflow: 'hidden', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      }}>
                        {a.description || <em style={{ color: '#bbb' }}>No description</em>}
                      </div>
                    </td>

                    {/* PDF */}
                    <td style={{ padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', whiteSpace: 'nowrap' }}>
                      {a.pdf_filename ? (
                        <button
                          onClick={() => setPreviewArticle(a)}
                          style={{
                            padding: 'clamp(3px, 0.6vw, 5px) clamp(8px, 1.5vw, 12px)', fontSize: 'clamp(8px, 1.5vw, 11px)',
                            background: '#E8F5EE', color: '#1B6B3A',
                            border: '1px solid #B5DDC8',
                            borderRadius: 4, cursor: 'pointer',
                          }}
                        >
                          📄 Preview
                        </button>
                      ) : (
                        <span style={{
                          fontSize: 'clamp(8px, 1.5vw, 11px)', padding: 'clamp(2px, 0.5vw, 3px) clamp(6px, 1.2vw, 8px)', borderRadius: 3,
                          background: '#FEF3DC', color: '#CC7700',
                          border: '1px solid #F5D88A', fontWeight: 500,
                        }}>
                          ⚠ None
                        </span>
                      )}
                    </td>

                    {/* Last Updated */}
                    <td style={{ padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)', fontSize: 'clamp(8px, 1.5vw, 11px)', color: '#6A7280', whiteSpace: 'nowrap' }}>
                      {formatDate(a.updated_at)}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 16px)' }}>
                      <div style={{ display: 'flex', gap: 'clamp(4px, 1vw, 8px)', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => openEdit(a)}
                          style={{
                            padding: 'clamp(3px, 0.6vw, 5px) clamp(10px, 1.8vw, 14px)', fontSize: 'clamp(8px, 1.5vw, 11px)',
                            background: 'var(--gov-navy)', color: '#fff',
                            border: 'none', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        ><Pencil size={14} /> Edit</button>
                        <button
                          onClick={() => setDeleteTarget(a)}
                          style={{
                            padding: 'clamp(3px, 0.6vw, 5px) clamp(10px, 1.8vw, 14px)', fontSize: 'clamp(8px, 1.5vw, 11px)',
                            background: '#FDE8E8', color: '#8B1A1A',
                            border: '1px solid #F5C0C0',
                            borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        ><Trash2 size={14} /> Delete</button>
                      </div>
                    </td>
                  </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </AppTable>
        </div>
{filtered.length > 0 && (
        <Pagination attached page={currentPage} total={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      )}

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
            padding: 'clamp(12px, 3vw, 20px)',
          }}
        >
          <div
            className="shared-management-dialog" onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', width: 'min(560px, calc(100vw - 32px))',
              borderRadius: 10,
              border: '0.5px solid #C0C8D4', overflow: 'hidden',
              maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div style={{
              background: 'var(--gov-navy)', padding: 'clamp(12px, 2vw, 16px) clamp(14px, 3vw, 20px)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexShrink: 0, gap: 'clamp(8px, 2vw, 12px)', flexWrap: 'wrap',
            }}>
              <p style={{ color: '#fff', fontSize: 'clamp(12px, 2vw, 16px)', fontWeight: 600, margin: 0 }}>
                {editArticle ? `Edit Article — ${editArticle.title}` : 'New Article'}
              </p>
              <button onClick={() => setShowModal(false)} style={{
                background: 'rgba(255,255,255,0.15)', border: 'none',
                borderRadius: 4, width: 'clamp(24px, 5vw, 32px)', height: 'clamp(24px, 5vw, 32px)',
                color: '#fff', fontSize: 'clamp(16px, 3vw, 20px)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>×</button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 'clamp(14px, 3vw, 22px)', overflowY: 'auto' }}>

              {/* Error banner */}
              {formError && (
                <div style={{
                  background: '#FDE8E8', border: '0.5px solid #F5C0C0',
                  borderRadius: 4, padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 14px)',
                  fontSize: 'clamp(10px, 1.8vw, 13px)', color: '#8B1A1A', marginBottom: 'clamp(10px, 2vw, 14px)',
                }}>
                  ⚠ {formError}
                </div>
              )}

              {/* Category */}
            <div style={{ marginBottom: 'clamp(10px, 2vw, 14px)' }}>
              <label style={labelStyle}>Service Area <span style={{ color: '#8B1A1A' }}>*</span></label>
              <select value={formServiceArea} onChange={e => setFormServiceArea(e.target.value)} style={inputStyle}>
                <option value="">Select a service area</option>
                {serviceAreas.filter(area => area.is_active).map(area => <option key={area.id} value={area.id}>{area.code} — {area.name}</option>)}
              </select>
            </div>
              <div style={{ marginBottom: 'clamp(10px, 2vw, 14px)' }}>
                <label style={labelStyle}>
                  Category <span style={{ color: '#8B1A1A' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: 'clamp(4px, 1vw, 8px)', flexWrap: 'wrap', marginBottom: 'clamp(4px, 1vw, 8px)' }}>
                  {PRESET_CATEGORIES.map(c => {
                    const cs = getCatStyle(c);
                    const active = formCategory === c && !customCat;
                    return (
                      <button
                        key={c}
                        onClick={() => { setCustomCat(false); setFormCategory(c); setFormError(''); }}
                        style={{
                          padding: 'clamp(3px, 0.6vw, 5px) clamp(8px, 1.5vw, 12px)', fontSize: 'clamp(8px, 1.5vw, 11px)', borderRadius: 4,
                          cursor: 'pointer', fontWeight: 500,
                          border: `1px solid ${active ? cs.color : '#C8D0DC'}`,
                          background: active ? cs.bg : '#fff',
                          color: active ? cs.color : '#555',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => { setCustomCat(true); setFormCategory(''); }}
                    style={{
                      padding: 'clamp(3px, 0.6vw, 5px) clamp(8px, 1.5vw, 12px)', fontSize: 'clamp(8px, 1.5vw, 11px)', borderRadius: 4, cursor: 'pointer',
                      border: `1px solid ${customCat ? 'var(--gov-navy)' : '#C8D0DC'}`,
                      background: customCat ? '#E8F1FA' : '#fff',
                      color: customCat ? 'var(--gov-navy)' : '#555',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    + Custom
                  </button>
                </div>
                {customCat && (
                  <input
                    autoFocus
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    placeholder="Type a custom category..."
                    style={inputStyle}
                  />
                )}
              </div>

              {/* Title */}
              <div style={{ marginBottom: 'clamp(10px, 2vw, 14px)' }}>
                <label style={labelStyle}>
                  Title <span style={{ color: '#8B1A1A' }}>*</span>
                </label>
                <input
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g. Printer troubleshooting guide"
                  style={inputStyle}
                />
              </div>

              {/* Description */}
              <div style={{ marginBottom: 'clamp(10px, 2vw, 14px)' }}>
                <label style={labelStyle}>Description</label>
                <textarea
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Brief description of this article..."
                  style={{
                    ...inputStyle,
                    minHeight: 'clamp(60px, 10vw, 100px)',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* PDF Section */}
              <div style={{ marginBottom: 'clamp(10px, 2vw, 14px)' }}>
                <label style={labelStyle}>PDF Document</label>

                {editArticle?.pdf_filename && !removePdf && !formPdf && (
                  <div style={{
                    background: '#E8F5EE', borderRadius: 4, padding: 'clamp(8px, 1.5vw, 12px)',
                    fontSize: 'clamp(9px, 1.6vw, 12px)', color: '#1B6B3A', marginBottom: 'clamp(8px, 2vw, 12px)',
                  }}>
                    <strong>Current: {editArticle.pdf_filename}</strong>
                    <button
                      onClick={() => setRemovePdf(true)}
                      style={{
                        marginLeft: 'clamp(6px, 1.5vw, 10px)',
                        fontSize: 'clamp(9px, 1.6vw, 12px)',
                        background: 'none', border: 'none', cursor: 'pointer', color: '#1B6B3A', textDecoration: 'underline',
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}

                {removePdf && (
                  <div style={{
                    background: '#FDE8E8', borderRadius: 4, padding: 'clamp(8px, 1.5vw, 12px)',
                    fontSize: 'clamp(9px, 1.6vw, 12px)', color: '#8B1A1A', marginBottom: 'clamp(8px, 2vw, 12px)',
                  }}>
                    <span>PDF will be removed on save.</span>
                    <button
                      onClick={() => setRemovePdf(false)}
                      style={{ fontSize: 'clamp(9px, 1.6vw, 12px)', background: 'none', border: 'none', cursor: 'pointer', color: '#8B1A1A', marginLeft: 'clamp(6px, 1.5vw, 10px)', textDecoration: 'underline' }}
                    >
                      Undo
                    </button>
                  </div>
                )}

                {/* Drop zone */}
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0] ?? null); }}
                  style={{
                    border: `1.5px dashed ${dragOver ? 'var(--gov-navy)' : formPdf ? '#1B6B3A' : '#C8D0DC'}`,
                    borderRadius: 4, padding: 'clamp(12px, 2vw, 16px) clamp(10px, 2vw, 14px)', textAlign: 'center',
                    cursor: 'pointer', transition: 'all 0.15s',
                    background: dragOver ? '#EEF4FC' : formPdf ? '#E8F5EE' : '#FAFBFC',
                  }}
                >
                  <div style={{ fontSize: 'clamp(18px, 4vw, 24px)', marginBottom: 'clamp(3px, 0.6vw, 6px)' }}>
                    {dragOver ? '⬇️' : formPdf ? '✅' : '📎'}
                  </div>
                  <div style={{ fontSize: 'clamp(9px, 1.6vw, 12px)', color: formPdf ? '#1B6B3A' : '#4A4A4A', wordBreak: 'break-word' }}>
                    {dragOver
                      ? 'Drop PDF here'
                      : formPdf
                        ? `${formPdf.name} (${(formPdf.size / 1024 / 1024).toFixed(2)} MB)`
                        : editArticle?.pdf_filename && !removePdf
                          ? 'Click to replace existing PDF'
                          : 'Click to browse or drag & drop a PDF'}
                  </div>
                  {formPdf && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setFormPdf(null);
                        if (fileRef.current) fileRef.current.value = '';
                      }}
                      style={{
                        marginTop: 'clamp(4px, 1vw, 8px)', fontSize: 'clamp(9px, 1.6vw, 12px)', color: '#8B1A1A',
                        background: 'none', border: 'none', cursor: 'pointer',
                      }}
                    >
                      ✕ Remove selection
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  style={{ display: 'none' }}
                  onChange={e => handleFile(e.target.files?.[0] ?? null)}
                />
                <p style={{ fontSize: 'clamp(8px, 1.5vw, 11px)', color: '#888', marginTop: 'clamp(3px, 0.6vw, 6px)', margin: 0 }}>
                  PDF only · max 20 MB. Staff can open this directly from the Knowledge Base page.
                </p>
              </div>

              {/* Info note */}
              <div style={{
                background: '#E8F1FA', borderRadius: 4,
                padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 14px)', fontSize: 'clamp(9px, 1.6vw, 12px)',
                color: 'var(--gov-navy)',
              }}>
                Articles are visible to all staff on the Knowledge Base page immediately after saving.
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: 'clamp(10px, 2vw, 14px) clamp(14px, 3vw, 20px)', borderTop: '0.5px solid #E5EAF0',
              display: 'flex', justifyContent: 'flex-end',
              gap: 'clamp(6px, 1.5vw, 10px)', background: '#F8FAFC', flexShrink: 0, flexWrap: 'wrap',
            }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: 'clamp(5px, 1vw, 8px) clamp(12px, 2vw, 16px)', fontSize: 'clamp(10px, 1.8vw, 13px)',
                  border: '1px solid #C8D0DC', borderRadius: 4,
                  background: '#fff', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: 'clamp(5px, 1vw, 8px) clamp(12px, 2vw, 16px)', fontSize: 'clamp(10px, 1.8vw, 13px)',
                  background: saving ? '#888' : 'var(--gov-green)',
                  color: '#fff', border: 'none', borderRadius: 4,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                }}
              >
                {saving ? 'Saving...' : editArticle ? '✓ Save Changes' : '✓ Save'}
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
            padding: 'clamp(12px, 3vw, 20px)',
          }}
        >
          <div
            className="shared-management-dialog" onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', width: 'min(420px, calc(100vw - 32px))',
              borderRadius: 10, overflow: 'hidden',
              border: '0.5px solid #C0C8D4',
            }}
          >
            <div style={{ background: '#8B1A1A', padding: 'clamp(12px, 2vw, 16px) clamp(14px, 3vw, 20px)' }}>
              <p style={{ color: '#fff', fontSize: 'clamp(12px, 2vw, 16px)', fontWeight: 600, margin: 0 }}>
                Confirm Delete Article
              </p>
            </div>
            <div style={{ padding: 'clamp(14px, 3vw, 20px)' }}>
              <p style={{ fontSize: 'clamp(11px, 1.9vw, 14px)', color: '#2A2A2A', marginBottom: 'clamp(8px, 2vw, 12px)', lineHeight: 1.6 }}>
                Are you sure you want to delete{' '}
                <strong>"{deleteTarget.title}"</strong>?
                This cannot be undone.
              </p>
              {deleteTarget.pdf_filename && (
                <div style={{
                  background: '#FDE8E8', borderRadius: 4,
                  padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 14px)', fontSize: 'clamp(9px, 1.6vw, 12px)', color: '#8B1A1A',
                }}>
                  ⚠ The associated PDF file will also be permanently deleted from the server.
                </div>
              )}
            </div>
            <div style={{
              padding: 'clamp(10px, 2vw, 14px) clamp(14px, 3vw, 20px)', borderTop: '0.5px solid #E5EAF0',
              display: 'flex', justifyContent: 'flex-end',
              gap: 'clamp(6px, 1.5vw, 10px)', background: '#F8FAFC', flexWrap: 'wrap',
            }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{
                  padding: 'clamp(5px, 1vw, 8px) clamp(12px, 2vw, 16px)', fontSize: 'clamp(10px, 1.8vw, 13px)',
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
                  padding: 'clamp(5px, 1vw, 8px) clamp(12px, 2vw, 16px)', fontSize: 'clamp(10px, 1.8vw, 13px)',
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

      {/* ===== PDF PREVIEW MODAL ===== */}
      {previewArticle && (
        <PDFViewerModal
          article={previewArticle}
          onClose={() => setPreviewArticle(null)}
        />
      )}

      {/* TOAST */}
      {toast.msg && (
        <div style={{
          position: 'fixed', bottom: 'clamp(12px, 3vw, 20px)', right: 'clamp(12px, 3vw, 20px)',
          background: toast.type === 'error' ? '#8B1A1A' : 'var(--gov-green)',
          color: '#fff', padding: 'clamp(8px, 1.5vw, 12px) clamp(12px, 2vw, 16px)',
          borderRadius: 4, fontSize: 'clamp(10px, 1.8vw, 13px)', fontWeight: 500, zIndex: 300,
          maxWidth: 'clamp(200px, 80vw, 400px)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
