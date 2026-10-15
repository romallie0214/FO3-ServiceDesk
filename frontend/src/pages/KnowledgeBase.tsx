import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';


interface Article {
  id: number;
  service_area_id: number;
  service_area_code?: string;
  service_area_name?: string;
  category: string;
  title: string;
  description: string;
  pdf_filename: string | null;
}
interface ServiceArea { id: number; code: string; name: string; is_active: number; }

const categoryColors: Record<string, { bg: string; color: string }> = {
  'Hardware':          { bg: '#E8F1FA', color: '#0D3B6E' },
  'Network':           { bg: '#FEF3DC', color: '#CC7700' },
  'Email':             { bg: '#E8F5EE', color: '#1B6B3A' },
  'Access & Accounts': { bg: '#FDE8E8', color: '#8B1A1A' },
  'Software':          { bg: '#F3F0FF', color: '#5B21B6' },
  'Onboarding':        { bg: '#F0F0F0', color: '#4A4A4A' },
};

// ─── PDF Viewer Modal ─────────────────────────────────────────────────────────
function PDFViewerModal({ article, onClose }: { article: Article; onClose: () => void }) {
  const pdfUrl = `/api/knowledge-base/${article.id}/pdf`;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,20,0.55)',
        zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          width: 'clamp(90vw, 95vw, 90vw)',
          height: 'clamp(80vh, 92vh, 92vh)',
          borderRadius: 10,
          border: '0.5px solid #C0C8D4',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          background: 'var(--gov-navy)',
          padding: 'clamp(10px, 2vw, 12px) clamp(12px, 3vw, 18px)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 'clamp(13px, 2vw, 15px)',
              fontWeight: 500,
              color: '#fff',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              📄 {article.title}
            </div>
            <div style={{
              fontSize: 'clamp(10px, 1.5vw, 12px)',
              color: 'rgba(255,255,255,0.55)',
              marginTop: 2,
            }}>
              {article.category}
            </div>
          </div>
          <div style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexShrink: 0,
          }}>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 'clamp(9px, 1.5vw, 11px)',
                color: 'rgba(255,255,255,0.85)',
                textDecoration: 'none',
                padding: 'clamp(3px, 1vw, 4px) clamp(8px, 1.5vw, 10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 4,
                whiteSpace: 'nowrap',
              }}
            >
              Open in new tab ↗
            </a>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: 4,
                width: 'clamp(24px, 6vw, 28px)',
                height: 'clamp(24px, 6vw, 28px)',
                cursor: 'pointer',
                color: '#fff',
                fontSize: 'clamp(16px, 3vw, 20px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>
        </div>
        {/* PDF iframe */}
        <iframe
          src={pdfUrl}
          style={{ flex: 1, border: 'none', width: '100%' }}
          title={article.title}
        />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function KnowledgeBase() {
  const { user } = useAuth();
  const isServiceAdmin = user?.role !== 'super_admin' && (user?.area_admin_service_ids?.length ?? 0) > 0;
  const [articles, setArticles]       = useState<Article[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedServiceArea, setSelectedServiceArea] = useState('');
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [viewingPdf, setViewingPdf]   = useState<Article | null>(null);

  useEffect(() => {
    const loadKnowledgeBase = async () => {
      let loadedArticles: Article[] = [];
      let availableAreas: ServiceArea[] = [];

      // Load these independently: a missing KB article must not hide the
      // available-service choices, and vice versa.
      try {
        const response = await api.get('/knowledge-base', {
          params: isServiceAdmin ? { all_services: 'true' } : {},
        });
        loadedArticles = response.data;
        setArticles(loadedArticles);
      } catch {
        setArticles([]);
      }

      if (isServiceAdmin) {
        try {
          const response = await api.get('/service-areas');
          availableAreas = response.data;
        } catch {
          // Service names attached to articles remain a useful fallback.
        }
      }

      const articleAreas: ServiceArea[] = loadedArticles
        .filter(article => article.service_area_id && article.service_area_name)
        .map(article => ({
          id: article.service_area_id,
          code: article.service_area_code || 'SERVICE',
          name: article.service_area_name || 'Service Area',
          is_active: 1,
        }));
      const allAreas = [...availableAreas, ...articleAreas];
      setServiceAreas(Array.from(new Map(allAreas.map(area => [area.id, area])).values()));
      setLoading(false);
    };

    loadKnowledgeBase();
  }, [isServiceAdmin]);

  const categories = [...new Set(articles.map(a => a.category))].sort();

  const filtered = articles.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      a.title.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q);
    const matchCat = !selectedCategory || a.category === selectedCategory;
    const matchService = !selectedServiceArea || String(a.service_area_id) === selectedServiceArea;
    return matchSearch && matchCat && matchService;
  });

  return (
    <div>
      {/* BREADCRUMB */}
      <div style={{
        fontSize: 'clamp(9px, 1.8vw, 11px)',
        color: '#4A4A4A',
        marginBottom: 14,
      }}>
        Home <span style={{ color: 'var(--gov-navy)', fontWeight: 500 }}>/ Knowledge Base</span>
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
        {isServiceAdmin
          ? 'Browse knowledge-base articles from all services, or use the service filter to focus on one area.'
          : 'Browse our self-service guides and FAQs before submitting a ticket. Most common issues can be resolved using these articles.'}
      </div>

      {/* FILTER BAR */}
      <div style={{
        background: '#fff',
        border: '0.5px solid #D0D9E4',
        borderRadius: 8,
        padding: 'clamp(8px, 2vw, 12px)',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 'clamp(6px, 1.5vw, 10px)',
        flexWrap: 'wrap',
      }}>
        <input
          type="text"
          placeholder="Search articles, guides, FAQs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: '1 1 auto',
            minWidth: 'clamp(150px, 50vw, 300px)',
            padding: 'clamp(5px, 1.5vw, 8px) clamp(6px, 1.5vw, 9px)',
            fontSize: 'clamp(10px, 1.8vw, 12px)',
            border: '1px solid #C8D0DC',
            borderRadius: 4,
          }}
        />
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          style={{
            padding: 'clamp(5px, 1.5vw, 8px) clamp(6px, 1.5vw, 9px)',
            fontSize: 'clamp(10px, 1.8vw, 12px)',
            border: '1px solid #C8D0DC',
            borderRadius: 4,
            flex: '0 1 auto',
            minWidth: '140px',
          }}
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {isServiceAdmin && (
          <select
            value={selectedServiceArea}
            onChange={e => setSelectedServiceArea(e.target.value)}
            style={{
              padding: 'clamp(5px, 1.2vw, 8px) clamp(6px, 1.5vw, 9px)',
              fontSize: 'clamp(10px, 1.8vw, 12px)', border: '1px solid #C8D0DC',
              borderRadius: 4, flex: '0 1 auto', minWidth: '180px',
            }}
          >
            <option value="">All Services</option>
            {serviceAreas
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(area => (
                <option key={area.id} value={String(area.id)}>
                  {area.name}{area.code ? ` (${area.code})` : ''}
                </option>
              ))}
          </select>
        )}
      </div>

      {/* RESULTS COUNT */}
      <div style={{
        fontSize: 'clamp(9px, 1.8vw, 11px)',
        color: '#4A4A4A',
        marginBottom: 12,
      }}>
        Showing <strong>{filtered.length}</strong> of{' '}
        <strong>{articles.length}</strong> articles
      </div>

      {/* ARTICLES GRID */}
      {loading ? (
        <div style={{
          background: '#fff',
          border: '0.5px solid #D0D9E4',
          borderRadius: 8,
          padding: 'clamp(24px, 5vw, 40px)',
          textAlign: 'center',
          color: '#888',
          fontSize: 'clamp(11px, 2vw, 13px)',
        }}>
          Loading articles...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          background: '#fff',
          border: '0.5px solid #D0D9E4',
          borderRadius: 8,
          padding: 'clamp(24px, 5vw, 40px)',
          textAlign: 'center',
          color: '#888',
          fontSize: 'clamp(11px, 2vw, 13px)',
        }}>
          {articles.length === 0 ? 'No articles available yet.' : 'No articles found for your search.'}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 'clamp(10px, 2vw, 12px)',
        }}>
          {filtered.map(article => {
            const catStyle = categoryColors[article.category] ?? { bg: '#F0F0F0', color: '#666' };
            return (
              <div
                key={article.id}
                style={{
                  background: '#fff',
                  border: '0.5px solid #D0D9E4',
                  borderRadius: 8,
                  padding: 'clamp(10px, 2.5vw, 14px)',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gov-navy)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#D0D9E4')}
              >
                {/* Category badge */}
                <div style={{
                  display: 'inline-block',
                  alignSelf: 'flex-start',
                  background: catStyle.bg,
                  color: catStyle.color,
                  fontSize: 'clamp(8px, 1.5vw, 10px)',
                  fontWeight: 500,
                  padding: 'clamp(2px, 0.8vw, 3px) clamp(6px, 1.2vw, 8px)',
                  borderRadius: 3,
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}>
                  {article.category}
                </div>

                {/* Title */}
                <h4 style={{
                  fontSize: 'clamp(11px, 2vw, 13px)',
                  fontWeight: 500,
                  color: '#1A2A3A',
                  marginBottom: 6,
                  lineHeight: 1.4,
                }}>
                  {article.title}
                </h4>

                {/* Description */}
                <p style={{
                  fontSize: 'clamp(9px, 1.5vw, 11px)',
                  color: '#5A6475',
                  lineHeight: 1.5,
                  marginBottom: 10,
                  flex: 1,
                }}>
                  {article.description || <em style={{ color: '#bbb' }}>No description available.</em>}
                </p>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  {article.pdf_filename ? (
                    <span
                      onClick={() => setViewingPdf(article)}
                      style={{
                        fontSize: 'clamp(9px, 1.5vw, 11px)',
                        color: 'var(--gov-navy)',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      Read more →
                    </span>
                  ) : (
                    <span style={{
                      fontSize: 'clamp(9px, 1.5vw, 11px)',
                      color: '#bbb',
                    }}>
                      No guide available
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PDF VIEWER */}
      {viewingPdf && (
        <PDFViewerModal
          article={viewingPdf}
          onClose={() => setViewingPdf(null)}
        />
      )}
    </div>
  );
}
