import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { exportCSMPDF } from '../utils/exportCSMPDF';



interface CSMResponse {
  id:                 number;
  ticket_id:          number;
  ticket_number:      string;
  subject:            string;
  category:           string;
  requestor_name:     string;
  requestor_division: string;
  client_name:        string;
  age:                number;
  sex:                string;
  sector:             string;
  client_type:        string;
  attending_officer:  string;
  service_mode:       string;
  officer_rating:     number;
  rating_promptness:  number;
  rating_reliability: number;
  rating_access:      number;
  rating_courtesy:    number;
  rating_cost:        number;
  rating_integrity:   number;
  rating_assurance:   number;
  rating_outcome:     number;
  cc_awareness:       string;
  cc_visibility:      string;
  cc_helpfulness:     string;
  commendation:       string;
  suggestion:         string;
  submitted_at:       string;
  is_team:            boolean;   // ✅ new
  co_assignee_count:  number;    // ✅ new
}

const DIMENSIONS = [
  { key: 'rating_promptness',  label: 'Promptness'  },
  { key: 'rating_reliability', label: 'Reliability' },
  { key: 'rating_access',      label: 'Access'      },
  { key: 'rating_courtesy',    label: 'Courtesy'    },
  { key: 'rating_cost',        label: 'Cost', disabled: true },
  { key: 'rating_integrity',   label: 'Integrity'   },
  { key: 'rating_assurance',   label: 'Assurance'   },
  { key: 'rating_outcome',     label: 'Outcome'     },
];

function StarRating({ value }: { value: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} style={{
          fontSize: 'var(--text-sm)',
          color: n <= value ? '#F5A623' : '#D0D9E4',
        }}>★</span>
      ))}
    </div>
  );
}
function avgExcludingDisabled(responses: CSMResponse[], key: keyof CSMResponse): string {
  if (responses.length === 0) return '0.00';
  const vals = responses.map(r => Number(r[key])).filter(v => v > 0);
  if (vals.length === 0) return '0.00';
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
}

function RatingPill({ value }: { value: number }) {
  const colors: Record<number, { bg: string; color: string }> = {
    1: { bg: '#FDE8E8', color: '#8B1A1A' },
    2: { bg: '#FEF3DC', color: '#CC7700' },
    3: { bg: '#F0F0F0', color: '#4A4A4A' },
    4: { bg: '#E8F5EE', color: '#1B6B3A' },
    5: { bg: '#E8F1FA', color: '#0D3B6E' },
  };
  const labels = ['', 'Very Unsatisfied', 'Unsatisfied', 'Neither', 'Satisfied', 'Very Satisfied'];
  const c = colors[value] ?? colors[3];
  return (
    <span style={{
      ...c, fontSize: 'var(--text-xs)', padding: '2px 8px',
      borderRadius: 3, fontWeight: 500,
    }}>
      {value}/5 — {labels[value]}
    </span>
  );
}

function avg(responses: CSMResponse[], key: keyof CSMResponse): string {
  if (responses.length === 0) return '0.00';
  const vals = responses.map(r => Number(r[key])).filter(v => v > 0);
  if (vals.length === 0) return '0.00';
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
}

function avgServiceQuality(responses: CSMResponse[]): string {
  if (responses.length === 0) return '0.00';

  // Only include non-disabled dimensions
  const activeDimensions = DIMENSIONS.filter(d => !d.disabled);

  const dimensionAverages = activeDimensions.map(d => {
    const vals = responses.map(r => Number(r[d.key as keyof CSMResponse])).filter(v => v > 0);
    if (vals.length === 0) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  });

  if (dimensionAverages.length === 0) return '0.00';
  return (dimensionAverages.reduce((a, b) => a + b, 0) / dimensionAverages.length).toFixed(2);
}

function parseAttendingTeam(str: string): { name: string; isPrimary: boolean }[] {
  if (!str) return [];
  return str.split(',').map(part => {
    const trimmed   = part.trim();
    const isPrimary = trimmed.includes('(Primary)');
    const name      = trimmed.replace(/\(Primary\)/g, '').trim();
    return { name, isPrimary };
  });
}

// Check if ICTMS staff is in a team attending_officer string
export function staffInAttending(attendingOfficer: string, fullName: string): boolean {
  if (!attendingOfficer || !fullName) return false;
  const team = parseAttendingTeam(attendingOfficer);
  return team.some(m =>
    m.name.toLowerCase() === fullName.toLowerCase()
  );
}

export default function CSMReports() {
  const { user } = useAuth();                        // ✅ add this
  const isServiceAdmin = user?.role !== 'super_admin' && (user?.area_admin_service_ids?.length ?? 0) > 0;
  const [responses, setResponses] = useState<CSMResponse[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<CSMResponse | null>(null);
  const [search, setSearch]       = useState('');
  const [divFilter, setDivFilter] = useState('');

  useEffect(() => {
    api.get('/csm').then(res => {
      let data: CSMResponse[] = res.data;

      // ✅ ICTMS staff: match by name in attending_officer
      //    Works for BOTH single staff AND team tickets
      if (user?.role === 'ictms_staff') {
        data = data.filter(r =>
          staffInAttending(r.attending_officer, user.full_name)
        );
      }

      setResponses(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  const divisions = [...new Set(responses.map(r => r.requestor_division).filter(Boolean))];

  const filtered = responses.filter(r => {
    const matchSearch = !search ||
      r.ticket_number?.toLowerCase().includes(search.toLowerCase()) ||
      r.attending_officer?.toLowerCase().includes(search.toLowerCase()) ||
      r.requestor_division?.toLowerCase().includes(search.toLowerCase());
    const matchDiv = !divFilter || r.requestor_division === divFilter;
    return matchSearch && matchDiv;
  });

  // Overall averages
  const overallOfficer = avg(filtered, 'officer_rating');
  const overallService = avgServiceQuality(filtered);

  if (loading) return (
    <div style={{ color: 'var(--gov-navy)', padding: 40, textAlign: 'center' }}>
      Loading CSM reports...
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
        Home{' '}
        <span style={{ color: 'var(--gov-navy)', fontWeight: 500 }}>
          {user?.role === 'ictms_staff'
            ? '/ My CSM Feedback'
            : isServiceAdmin ? '/ Service CSM Reports' : '/ CSM Reports'
          }
        </span>
      </div>
      {/* INFO STRIP + EXPORT BUTTON */}

      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 14,
        gap: 'clamp(8px, 2vw, 12px)',
        flexWrap: 'wrap',
      }}>
        <div style={{
          background: '#E8F1FA',
          borderLeft: '3px solid var(--gov-navy)',
          borderRadius: '0 4px 4px 0',
          padding: 'clamp(8px, 2vw, 12px)',
          fontSize: 'clamp(9px, 1.8vw, 12px)',
          color: 'var(--gov-navy)',
          flex: '1 1 auto',
          minWidth: '200px',
        }}>
            {user?.role === 'ictms_staff' ? (
              <>
                Client Satisfaction Measurement Reports — DSWD-QMS-GF-005 REV 04.
                Showing feedback for tickets where <strong>you are listed as an attending officer</strong>
                — both as primary and as co-assignee in team tickets.
                {responses.length === 0
                  ? ' No CSM responses submitted yet for your resolved tickets.'
                  : ` ${responses.length} response${responses.length > 1 ? 's' : ''} found.`
                }
              </>
            ) : (
              <>
                Client Satisfaction Measurement Reports — DSWD-QMS-GF-005 REV 04.
                Showing results from all closed tickets with submitted CSM forms.
              </>
            )}
        </div>

        {/* Export — only for super_admin and supervisor */}
        {user?.role !== 'ictms_staff' && (
          <button
            onClick={() => exportCSMPDF(filtered)}
            disabled={filtered.length === 0}
            style={{
              padding: 'clamp(6px, 1.5vw, 8px) clamp(12px, 2.5vw, 16px)',
              fontSize: 'clamp(10px, 1.8vw, 13px)',
              background: filtered.length === 0 ? '#C8D0DC' : 'var(--gov-navy)',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: filtered.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flex: '0 0 auto',
            }}
          >
            📄 Export PDF
          </button>
        )}
      </div>

      {/* SUMMARY CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 'clamp(8px, 2vw, 12px)',
        marginBottom: 18,
      }}>
        {[
          // ✅ REPLACE THIS FIRST CARD ONLY
          {
            label: user?.role === 'ictms_staff'
              ? 'My CSM Responses'
              : 'Total CSM Responses',
            value: filtered.length,
            sub: user?.role === 'ictms_staff'
              ? 'From your resolved tickets'
              : 'Submitted forms',
            color: 'var(--gov-navy)',
          },

          // ← LEAVE THESE 3 CARDS EXACTLY AS THEY ARE
          {
            label: 'Avg Officer Rating',
            value: overallOfficer,
            sub: 'Out of 5.00',
            color: 'var(--gov-amber)',
          },
          {
            label: 'Avg Service Quality',
            value: overallService,
            sub: '7 dimensions average (Cost-effectiveness N/A)',
            color: 'var(--gov-green)',
          },
          {
            label: 'Highly Satisfied',
            value: filtered.filter(r => r.officer_rating >= 4).length,
            sub: 'Rating 4 or 5',
            color: '#0D3B6E',
          },
        ].map(card => (
          <div key={card.label} style={{
            background: '#fff',
            border: '0.5px solid #D0D9E4',
            borderRadius: 8,
            padding: 'clamp(10px, 2.5vw, 14px)',
            borderTop: `3px solid ${card.color}`,
          }}>
            <div style={{
              fontSize: 'clamp(9px, 1.8vw, 11px)',
              color: '#4A4A4A',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 6,
              fontWeight: 500,
            }}>
              {card.label}
            </div>
            <div style={{
              fontSize: 'clamp(18px, 6vw, 28px)',
              fontWeight: 500,
              color: card.color,
            }}>
              {card.value}
            </div>
            <div style={{
              fontSize: 'clamp(8px, 1.5vw, 11px)',
              color: '#888',
              marginTop: 4,
            }}>
              {card.sub}
            </div>
          </div>
        ))}
      </div>

      {/* DIMENSION AVERAGES BAR */}
      <div style={{
        background: '#fff',
        border: '0.5px solid #D0D9E4',
        borderRadius: 8,
        padding: 'clamp(12px, 3vw, 16px)',
        marginBottom: 14,
      }}>
        <div style={{
          fontSize: 'clamp(9px, 1.8vw, 11px)',
          fontWeight: 500,
          color: 'var(--gov-navy)',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 14,
        }}>
          8 Service Quality Dimensions — Average Scores
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 'clamp(10px, 2vw, 14px)',
        }}>
        {DIMENSIONS.map(d => {
          if (d.disabled) {
            return (
              <div key={d.key} style={{ opacity: 0.5 }}>
                <p style={{
                  fontSize: 'clamp(8px, 1.5vw, 11px)',
                  color: '#888',
                  marginBottom: 4,
                }}>
                  {d.label}
                  <span style={{
                    marginLeft: 6,
                    fontSize: 'clamp(7px, 1.2vw, 10px)',
                    background: '#F0F0F0',
                    color: '#666',
                    padding: '2px 6px',
                    borderRadius: 3,
                    fontWeight: 500,
                  }}>
                    N/A
                  </span>
                </p>
                <div style={{
                  padding: '6px 8px',
                  background: '#F5F5F5',
                  borderRadius: 4,
                  textAlign: 'center',
                  fontSize: 'clamp(8px, 1.5vw, 11px)',
                  color: '#999',
                }}>
                  Not applicable
                </div>
              </div>
            );
          }

          const score = Number(avg(filtered, d.key as keyof CSMResponse));
          const pct = (score / 5) * 100;
          const color = score >= 4 ? 'var(--gov-green)'
            : score >= 3 ? 'var(--gov-amber)'
            : '#CC7700';
          
          return (
            <div key={d.key}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 4,
                gap: '8px',
              }}>
                <span style={{
                  fontSize: 'clamp(8px, 1.5vw, 11px)',
                  color: '#3A3A3A',
                }}>
                  {d.label}
                </span>
                <span style={{
                  fontSize: 'clamp(8px, 1.5vw, 11px)',
                  fontWeight: 500,
                  color,
                  whiteSpace: 'nowrap',
                }}>
                  {score.toFixed(2)}
                </span>
              </div>
              <div style={{
                height: 6,
                borderRadius: 3,
                background: '#E8ECF0',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  borderRadius: 3,
                  width: `${pct}%`,
                  background: color,
                  transition: 'width 0.4s',
                }} />
              </div>
            </div>
          );
        })}
        </div>
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
        <input
          type="text"
          placeholder="Search ticket #, officer, division..."
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
          value={divFilter}
          onChange={e => setDivFilter(e.target.value)}
          style={{
            padding: 'clamp(5px, 1.5vw, 8px) clamp(6px, 1.5vw, 9px)',
            fontSize: 'clamp(10px, 1.8vw, 12px)',
            border: '1px solid #C8D0DC',
            borderRadius: 4,
            flex: '0 1 auto',
            minWidth: '140px',
          }}
        >
          <option value="">All Divisions</option>
          {divisions.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <span style={{
          fontSize: 'clamp(9px, 1.8vw, 11px)',
          color: '#888',
          whiteSpace: 'nowrap',
          flex: '0 1 auto',
        }}>
          {filtered.length} record{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* CSM TABLE */}
      {responses.length === 0 ? (
        <div style={{
          background: '#fff', border: '0.5px solid #D0D9E4',
          borderRadius: 8, padding: 40,
          textAlign: 'center', color: '#888', fontSize: 'var(--text-sm)',
        }}>
          No CSM responses yet. They appear here once staff submit the
          CSM form after a ticket is resolved.
        </div>
      ) : (
        <div style={{
          background: '#fff', border: '0.5px solid #D0D9E4',
          borderRadius: 8, overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {[
                    'Ticket #', 'Subject', 'Division',
                    'Attending Officer', 'Officer Rating',
                    'Avg Service Score', 'Date Submitted', 'Action',
                  ].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '8px 10px',
                      fontSize: 'var(--text-xs)', fontWeight: 500,
                      color: '#fff', background: 'var(--gov-navy)',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const activeDims = DIMENSIONS.filter(d => !d.disabled);
                  const dimAvg = (
                    activeDims.reduce((sum, d) =>
                      sum + Number(r[d.key as keyof CSMResponse] ?? 0), 0
                    ) / activeDims.length
                  ).toFixed(2);
                  return (
                    <tr key={r.id}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F5F8FC')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                    >
                      <td style={{ padding: '8px 10px', fontWeight: 500, color: 'var(--gov-navy)', fontSize: 'var(--text-sm)' }}>
                        {r.ticket_number}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 'var(--text-sm)', maxWidth: 180 }}>
                        <span style={{
                          display: 'block', overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {r.subject}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 'var(--text-xs)', color: '#5A6475' }}>
                        {r.requestor_division || '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 'var(--text-xs)' }}>
                        {r.is_team ? (
                          // ✅ Team ticket
                          <div>
                            <span style={{
                              fontSize: 'var(--text-xs)', fontWeight: 500, padding: '1px 7px',
                              borderRadius: 3, background: '#E8F1FA', color: '#0D3B6E',
                              display: 'inline-block', marginBottom: 5,
                            }}>
                              👥 Team ({parseAttendingTeam(r.attending_officer).length})
                            </span>
                            {parseAttendingTeam(r.attending_officer).map((m, i) => (
                              <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                fontSize: 'var(--text-xs)', color: m.isPrimary ? '#0D3B6E' : '#5A6475',
                                marginTop: 2,
                              }}>
                                {m.isPrimary && (
                                  <span style={{
                                    fontSize: 8, background: '#E8F1FA', color: '#0D3B6E',
                                    padding: '0 4px', borderRadius: 2, fontWeight: 600,
                                    flexShrink: 0,
                                  }}>
                                    P
                                  </span>
                                )}
                                {m.name}
                              </div>
                            ))}
                          </div>
                        ) : (
                          // ✅ Single staff ticket — strip (Primary) if present
                          <div>
                            <span style={{
                              fontSize: 'var(--text-xs)', fontWeight: 500, padding: '1px 7px',
                              borderRadius: 3, background: '#E8F5EE', color: '#1B6B3A',
                              display: 'inline-block', marginBottom: 5,
                            }}>
                              👤 Individual
                            </span>
                            <div style={{ fontSize: 'var(--text-xs)', color: '#5A6475' }}>
                              {(r.attending_officer || '—').replace(/\(Primary\)/g, '').trim()}
                            </div>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <StarRating value={r.officer_rating} />
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          fontSize: 'var(--text-sm)', fontWeight: 500,
                          color: Number(dimAvg) >= 4 ? 'var(--gov-green)'
                            : Number(dimAvg) >= 3 ? 'var(--gov-amber)'
                            : 'var(--gov-red)',
                        }}>
                          {dimAvg} / 5
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 'var(--text-xs)', color: '#888' }}>
                        {new Date(r.submitted_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <button
                          onClick={() => setSelected(r)}
                          style={{
                            padding: '4px 10px', fontSize: 'var(--text-xs)',
                            background: 'var(--gov-navy)', color: '#fff',
                            border: 'none', borderRadius: 4, cursor: 'pointer',
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
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
              background: '#fff', width: 640,
              maxWidth: '95vw', maxHeight: '90vh',
              overflowY: 'auto', borderRadius: 10,
              border: '0.5px solid #C0C8D4',
            }}
          >
            {/* Modal Header */}
            <div style={{
              background: 'var(--gov-navy)', padding: '14px 20px',
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}>
              <div>
                <p style={{ color: '#fff', fontSize: 'var(--text-base)', fontWeight: 600 }}>
                  CSM Response — {selected.ticket_number}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 'var(--text-xs)', marginTop: 2 }}>
                  {selected.subject} · Submitted {new Date(selected.submitted_at).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => setSelected(null)} style={{
                background: 'rgba(255,255,255,0.15)', border: 'none',
                borderRadius: 4, width: 28, height: 28, color: '#fff',
                fontSize: 'var(--text-xl)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>
            </div>

            <div style={{ padding: 20 }}>

              {/* Respondent Info */}
              <div style={{
                fontSize: 'var(--text-xs)', fontWeight: 500, color: '#6A7280',
                textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8,
              }}>
                Respondent Information
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                gap: 8, marginBottom: 16,
              }}>
                {[
                  { label: 'Name', value: selected.client_name || 'Anonymous' },
                  { label: 'Age / Sex', value: `${selected.age || '—'} / ${selected.sex || '—'}` },
                  { label: 'Division', value: selected.requestor_division || '—' },
                  { label: 'Sector', value: selected.sector || '—' },
                  { label: 'Client Type', value: selected.client_type || '—' },
                  { label: 'Mode of Service', value: selected.service_mode || '—' },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    background: '#F5F8FC', borderRadius: 4, padding: '8px 10px',
                  }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: '#6A7280', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: '#1A1A1A', fontWeight: 500 }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Officer Rating */}
              <div style={{
                fontSize: 'var(--text-xs)', fontWeight: 500, color: '#6A7280',
                textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8,
              }}>
                Attending Officer Rating
              </div>
              <div style={{
                background: '#F5F8FC', borderRadius: 6, padding: 12, marginBottom: 16,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: '#1A2A3A', marginBottom: 4 }}>
                    {selected.attending_officer || 'N/A'}
                  </p>
                  <StarRating value={selected.officer_rating} />
                </div>
                <RatingPill value={selected.officer_rating} />
              </div>

              {/* 8 Dimensions */}
              <div style={{
                fontSize: 'var(--text-xs)', fontWeight: 500, color: '#6A7280',
                textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8,
              }}>
                7 Service Quality Dimensions
              </div>
              <div style={{ marginBottom: 16 }}>
                {DIMENSIONS.map(d => {
                  const val = Number(selected[d.key as keyof CSMResponse] ?? 0);
                  const pct = (val / 5) * 100;
                  const col = val >= 4 ? 'var(--gov-green)'
                    : val >= 3 ? 'var(--gov-amber)'
                    : 'var(--gov-red)';
                  return (
                    <div key={d.key} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '6px 0', borderBottom: '0.5px solid #EEF1F5',
                    }}>
                      <span style={{ fontSize: 'var(--text-xs)', flex: 1, color: '#2A2A2A' }}>{d.label}</span>
                      <div style={{
                        width: 120, height: 5, borderRadius: 3,
                        background: '#E8ECF0', overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', borderRadius: 3,
                          width: `${pct}%`, background: col,
                        }} />
                      </div>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: col, minWidth: 24 }}>
                        {val}/5
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Citizen's Charter */}
              <div style={{
                fontSize: 'var(--text-xs)', fontWeight: 500, color: '#6A7280',
                textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8,
              }}>
                Citizen's Charter
              </div>
              <div style={{ marginBottom: 16 }}>
                {[
                  { label: 'Awareness', value: selected.cc_awareness },
                  { label: 'Visibility', value: selected.cc_visibility },
                  { label: 'Helpfulness', value: selected.cc_helpfulness },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    padding: '6px 0', borderBottom: '0.5px solid #EEF1F5',
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                  }}>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: '#4A4A4A', minWidth: 90 }}>
                      {label}:
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: '#3A3A3A', flex: 1 }}>
                      {value || 'Not answered'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Feedback */}
              {(selected.commendation || selected.suggestion) && (
                <>
                  <div style={{
                    fontSize: 'var(--text-xs)', fontWeight: 500, color: '#6A7280',
                    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8,
                  }}>
                    Commendation & Suggestions
                  </div>
                  {selected.commendation && (
                    <div style={{
                      background: '#E8F5EE', borderRadius: 4,
                      padding: '8px 12px', marginBottom: 8,
                      fontSize: 'var(--text-xs)', color: '#1B6B3A', lineHeight: 1.6,
                    }}>
                      <strong>Commendation:</strong> {selected.commendation}
                    </div>
                  )}
                  {selected.suggestion && (
                    <div style={{
                      background: '#FEF3DC', borderRadius: 4,
                      padding: '8px 12px', marginBottom: 8,
                      fontSize: 'var(--text-xs)', color: '#CC7700', lineHeight: 1.6,
                    }}>
                      <strong>Suggestion:</strong> {selected.suggestion}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 20px', borderTop: '0.5px solid #E5EAF0',
              display: 'flex', justifyContent: 'flex-end',
              background: '#F8FAFC',
            }}>
              <button onClick={() => setSelected(null)} style={{
                padding: '6px 16px', fontSize: 'var(--text-sm)',
                border: '1px solid #C8D0DC', borderRadius: 4,
                background: '#fff', cursor: 'pointer',
              }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
