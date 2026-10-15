import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';


interface Props {
  ticketId: number;
  ticketNumber: string;
  assignedTo: string | null;
  onClose: () => void;
  onSubmitted: () => void;
}

const inputStyle: React.CSSProperties = {
  padding: '6px 10px', border: '1px solid #C8D0DC',
  borderRadius: 4, fontSize: 'var(--text-sm)', width: '100%',
  background: '#fff', color: '#2A2A2A',
};

const readOnlyStyle: React.CSSProperties = {
  ...inputStyle,
  background: '#F5F8FC',
  color: '#6A7280',
};

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--text-xs)', fontWeight: 500, color: '#5A6475',
  textTransform: 'uppercase', letterSpacing: 0.4,
  display: 'block', marginBottom: 3,
};

function RatingSelector({ value, onChange }: {
  value: number; onChange: (v: number) => void;
}) {
  const labels = ['', 'Very Unsatisfied', 'Unsatisfied', 'Neither', 'Satisfied', 'Very Satisfied'];
  const colors  = ['', '#8B1A1A', '#CC7700', '#4A4A4A', '#1B6B3A', '#0D3B6E'];
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          title={labels[n]}
          onClick={() => onChange(n)}
          style={{
            width: 36, height: 36, borderRadius: '50%',
            border: `2px solid ${value === n ? colors[n] : '#C8D0DC'}`,
            background: value === n ? colors[n] : '#fff',
            color: value === n ? '#fff' : '#4A4A4A',
            fontWeight: 600, fontSize: 'var(--text-base)', cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export default function CSMModal({
  ticketId, ticketNumber, assignedTo, onClose, onSubmitted,
}: Props) {
  const { user } = useAuth();
  const [step, setStep]             = useState(1);
  const [submitting, setSubmitting]   = useState(false);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [submitted, setSubmitted]     = useState(false);
  const [assignees, setAssignees] = useState<{
  user_id:     number;
  empno:       string;
  full_name:   string;
  role:        'primary' | 'co-assignee';
  assigned_at: string;
}[]>([]);
  

  const [form, setForm] = useState({
    // Respondent Info
    empno:          '',
    client_name:    '',
    age:            '',
    sex:            '',
    contact:        '',
    // Office Info
    office_location: '',
    unit_name:       '',
    division_name:   '',
    // Service
    sector:          'Government',
    client_type:     'Internal (DSWD Employee)',
    service_mode:    'Ticket System',
    attending_officer: assignedTo ?? '',
    // Ratings
    officer_rating:      0,
    rating_promptness:   0,
    rating_reliability:  0,
    rating_access:       0,
    rating_courtesy:     0,
    rating_cost:         0,
    rating_integrity:    0,
    rating_assurance:    0,
    rating_outcome:      0,
    // CC
    cc_awareness:   '',
    cc_visibility:  '',
    cc_helpfulness: '',
    // Feedback
    commendation: '',
    suggestion:   '',
  });



  // Auto-populate from ERM and ticket info on load
  useEffect(() => {
    async function loadInfo() {
      setLoadingInfo(true);
      try {
        // ── Fetch ticket info AND assignees in parallel ──
        const [ticketRes, assigneesRes] = await Promise.allSettled([
          api.get(`/tickets/${ticketId}/requestor-info`),
          api.get(`/tickets/${ticketId}/assignees`),
        ]);

        // ── Process ticket/requestor info ──
        if (ticketRes.status === 'fulfilled') {
          const ticketInfo = ticketRes.value.data;

          let updates: Partial<typeof form> = {
            empno:             ticketInfo.requestor_empno            || user?.empno          || '',
            client_name:       ticketInfo.requestor_name             || user?.full_name       || '',
            office_location:   ticketInfo.requestor_office_location  || user?.office_location || '',
            unit_name:         ticketInfo.requestor_unit             || user?.unit            || '',
            division_name:     ticketInfo.requestor_division         || user?.division        || '',
            attending_officer: assignedTo ?? ticketInfo.assigned_to_name ?? '',
          };

          // Enrich from ERM
          const empno = ticketInfo.requestor_empno || user?.empno;
          if (empno) {
            try {
              const ermRes = await api.get(`/users/erm/${empno}`);
              const erm    = ermRes.data;
              updates = {
                ...updates,
                empno:       erm.empno     || updates.empno,
                client_name: erm.full_name || updates.client_name,
                age:         erm.age !== undefined && erm.age !== null ? String(erm.age) : '',
                sex:         erm.sex !== undefined && erm.sex !== null ? String(erm.sex) : '',
                contact:     [erm.mobile, erm.email].filter(Boolean).join(' / '),
              };
            } catch {
              console.warn('ERM lookup failed — using ticket info only');
            }
          }

          setForm(prev => ({ ...prev, ...updates }));
        }

        // ── Process assignees ──
        if (assigneesRes.status === 'fulfilled') {
          const list = assigneesRes.value.data;
          setAssignees(list);

          // Build attending_officer from full team list
          if (list.length > 0) {
            const officerStr = list
              .map((a: any) =>
                a.role === 'primary' ? `${a.full_name} (Primary)` : a.full_name
              )
              .join(', ');
            setForm(prev => ({ ...prev, attending_officer: officerStr }));
          }
        } else {
          console.warn('Assignees fetch failed:', assigneesRes.reason?.message);
        }

      } catch (err) {
        console.error('Failed to load CSM info:', err);
      } finally {
        setLoadingInfo(false);
      }
    }
    loadInfo();
  }, [ticketId]);
  function set(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    if (form.officer_rating === 0) {
        alert('Please rate the attending officer.');
        return;
      }
      setSubmitting(true);
      try {
        // ✅ Convert sex 0/1 → 'Male'/'Female' before sending
        const sexLabel =
          form.sex === '0' || (form.sex as any) === 0 ? 'Male'   :
          form.sex === '1' || (form.sex as any) === 1 ? 'Female' :
          form.sex || null;

        await api.post('/csm', {
          ticket_id: ticketId,
          ...form,
          sex: sexLabel,
        });
        setSubmitted(true);
      } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to submit. Please try again.');
      } finally {
        setSubmitting(false);
      }
  }

  const dimensions = [
    { key: 'rating_promptness',  label: 'Promptness and Responsiveness',   sub: 'Maagap at sapat na pagtugon sa hinihinging tulong o serbisyo.' },
    { key: 'rating_reliability', label: 'Reliability and Quality',          sub: 'Maasahan at may kalidad ang serbisyong ibinigay ng opisina.' },
    { key: 'rating_access',      label: 'Access and Facilities',            sub: 'Ang tanggapan ay may sapat at maayos na pasilidad.' },
    { key: 'rating_courtesy',    label: 'Courtesy and Clarity',             sub: 'Ang tumugon na empleyado ay magalang at malinaw magpaliwanag.' },
    { key: 'rating_cost',        label: 'Cost-effectiveness',               sub: 'Naaayon ang halagang binayad katumbas ng serbisyong naibigay.', disabled: true },
    { key: 'rating_integrity',   label: 'Integrity',                        sub: 'Naibahagi ng buong katapatan ang serbisyong binigay.' },
    { key: 'rating_assurance',   label: 'Assurance',                        sub: 'May kasiguraduhan na ibinigay ang isang kalidad na serbisyo.' },
    { key: 'rating_outcome',     label: 'Outcome',                          sub: 'Nakatulong ang serbisyong ibinigay sa inyong pamumuhay.' },
  ];

  const stepLabels = ['Respondent Info', 'Officer Rating', 'Service Quality', "Citizen's Charter", 'Feedback'];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,20,0.6)',
        zIndex: 200, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', width: 680,
          maxWidth: '95vw', maxHeight: '92vh',
          overflowY: 'auto', borderRadius: 10,
          border: '0.5px solid #C0C8D4',
        }}
      >
        {/* HEADER */}
        <div style={{ background: 'var(--gov-navy)', padding: '14px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: '#fff', fontSize: 'var(--text-base)', fontWeight: 600 }}>
                CLIENT SATISFACTION MEASUREMENT FORM
              </p>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 'var(--text-xs)', marginTop: 2 }}>
                DSWD-QMS-GF-005 | REV 04 | 06 MAR 2023 · Ticket: {ticketNumber}
              </p>
            </div>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.15)', border: 'none',
              borderRadius: 4, width: 28, height: 28,
              color: '#fff', fontSize: 'var(--text-xl)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
          </div>

          {/* Step indicators */}
          <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
            {stepLabels.map((s, i) => (
              <div
                key={s}
                onClick={() => i + 1 < step && setStep(i + 1)}
                style={{
                  flex: 1, padding: '4px 6px', borderRadius: 4,
                  fontSize: 'var(--text-xs)', textAlign: 'center',
                  fontWeight: step === i + 1 ? 600 : 400,
                  cursor: i + 1 < step ? 'pointer' : 'default',
                  background: step === i + 1
                    ? '#F5A623'
                    : step > i + 1
                    ? 'rgba(255,255,255,0.3)'
                    : 'rgba(255,255,255,0.1)',
                  color: '#fff',
                }}
              >
                {i + 1}. {s}
              </div>
            ))}
          </div>
        </div>

        {/* BODY */}
        <div style={{ padding: 20 }}>

          {/* Loading indicator */}
          {loadingInfo && step === 1 && (
            <div style={{
              background: '#E8F1FA', borderRadius: 4,
              padding: '8px 12px', fontSize: 'var(--text-xs)',
              color: 'var(--gov-navy)', marginBottom: 12,
            }}>
              ⏳ Loading your information from HR system...
            </div>
          )}

          {/* ═══ STEP 1 — RESPONDENT INFO ═══ */}
          {step === 1 && (
            <div>
              <div style={{
                background: 'var(--gov-navy)', padding: '8px 14px',
                fontSize: 'var(--text-xs)', fontWeight: 500, color: '#fff',
                marginBottom: 14, borderRadius: 4,
              }}>
                Part 1 — Respondent Information
              </div>

              {/* ROW 1 — EmpNo + Full Name */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Employee Number (EmpNo)</label>
                  <input
                    style={readOnlyStyle}        // ← readOnly style
                    value={form.empno}
                    readOnly                     // ← not editable
                  />
                </div>
                <div>
                  <label style={labelStyle}>Complete Name (Kumpletong Pangalan)</label>
                  <input
                    style={readOnlyStyle}
                    value={form.client_name}
                    readOnly
                  />
                </div>
              </div>

              {/* ROW 2 — Age + Sex (auto-filled from ERM) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Age (Edad)</label>
                  <input
                    style={readOnlyStyle}
                    value={form.age}
                    readOnly
                  />
                </div>
                <div>
                  <label style={labelStyle}>Sex (Kasarian)</label>
                  <input
                    style={readOnlyStyle}
                    value={
                      form.sex === '0' ? 'Male' :
                      form.sex === '1' ? 'Female' :
                      form.sex || ''
                    }
                    readOnly
                  />
                </div>
              </div>

              {/* ROW 3 — Mobile / Email (auto-filled from ERM) */}
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Mobile No. / Email Address (Auto-filled from HR)</label>
                <input
                  style={readOnlyStyle}
                  value={form.contact}
                  readOnly
                />
              </div>

              {/* OFFICE INFO SECTION */}
              <div style={{
                fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--gov-navy)',
                textTransform: 'uppercase', letterSpacing: 0.4,
                marginBottom: 8, marginTop: 4,
              }}>
                Office Information (From Ticket)
              </div>

              {/* Office / Area */}
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Office / Area Assignment</label>
                <input
                  style={readOnlyStyle}
                  value={form.office_location}
                  readOnly
                />
              </div>

              {/* Unit + Division */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Unit</label>
                  <input
                    style={readOnlyStyle}
                    value={form.unit_name}
                    readOnly
                  />
                </div>
                <div>
                  <label style={labelStyle}>Division</label>
                  <input
                    style={readOnlyStyle}
                    value={form.division_name}
                    readOnly
                  />
                </div>
              </div>

              {/* Sector + Client Type — fixed, read-only */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Sector</label>
                  <input readOnly style={readOnlyStyle} value={form.sector} />
                </div>
                <div>
                  <label style={labelStyle}>Type of Client (Uri ng Kliyente)</label>
                  <input readOnly style={readOnlyStyle} value={form.client_type} />
                </div>
              </div>

              {/* Mode of Service Request — fixed, read-only */}
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Mode of Service Request</label>
                <input readOnly style={readOnlyStyle} value={form.service_mode} />
              </div>
            </div>
          )}
       
          {/* ═══ STEP 2 — OFFICER / TEAM RATING ═══ */}
          `{/* ═══ STEP 2 — OFFICER / TEAM RATING ═══ */}
          {step === 2 && (
            <div>
              {/* Section header */}
              <div style={{
                background: 'var(--gov-navy)', padding: '8px 14px',
                fontSize: 'var(--text-xs)', fontWeight: 500, color: '#fff',
                marginBottom: 14, borderRadius: 4,
              }}>
                Part 2 — Officer / Team Rating
              </div>

              {/* Info strip */}
              <div style={{
                background: '#E8F1FA', borderLeft: '3px solid var(--gov-navy)',
                borderRadius: '0 4px 4px 0', padding: '9px 12px',
                marginBottom: 16, fontSize: 'var(--text-xs)', color: 'var(--gov-navy)', lineHeight: 1.6,
              }}>
                This ticket was handled by a{' '}
                <strong>
                  {assignees.length > 1
                    ? `team of ${assignees.length} ICTMS technicians`
                    : 'ICTMS technician'}
                </strong>.{' '}
                Please rate the overall quality of service delivered by the team as a whole.
                Your feedback helps us improve.
              </div>

              {/* Attending team list */}
              <label style={labelStyle}>Attending Team</label>
              <div style={{
                border: '1px solid #C8D0DC', borderRadius: 6,
                overflow: 'hidden', marginBottom: 16,
              }}>
                {assignees.length === 0 ? (
                  <div style={{ padding: '10px 14px' }}>
                    <input
                      style={readOnlyStyle}
                      value={form.attending_officer || assignedTo || '—'}
                      readOnly
                    />
                  </div>
                ) : assignees.map((a, i) => (
                  <div key={a.user_id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 14px',
                    borderBottom: i < assignees.length - 1
                      ? '0.5px solid #EEF1F5' : 'none',
                    background: '#fff',
                  }}>
                    {/* Avatar */}
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 'var(--text-xs)', fontWeight: 600,
                      background: a.role === 'primary' ? '#E8F1FA' : '#E8F5EE',
                      color:      a.role === 'primary' ? '#0D3B6E' : '#1B6B3A',
                    }}>
                      {a.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>

                    {/* Name + role */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: '#1A2A3A' }}>
                          {a.full_name}
                        </span>
                        <span style={{
                          fontSize: 'var(--text-xs)', fontWeight: 500, padding: '1px 6px', borderRadius: 3,
                          background: a.role === 'primary' ? '#E8F1FA' : '#E8F5EE',
                          color:      a.role === 'primary' ? '#0D3B6E' : '#1B6B3A',
                        }}>
                          {a.role === 'primary' ? 'Primary' : 'Co-assignee'}
                        </span>
                      </div>
                      <span style={{ fontSize: 'var(--text-xs)', color: '#888' }}>
                        {a.role === 'primary' ? 'Assigned' : 'Added'}{' '}
                        {new Date(a.assigned_at).toLocaleDateString('en-PH', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </span>
                    </div>

                    {/* Right label */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 'var(--text-xs)', color: '#888' }}>
                        {a.role === 'primary' ? 'Responsible' : 'Assisted'}
                      </div>
                      <div style={{
                        fontSize: 'var(--text-xs)', fontWeight: 500,
                        color: a.role === 'primary' ? '#0D3B6E' : '#1B6B3A',
                      }}>
                        {a.role === 'primary' ? 'Account owner' : 'Support role'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Overall Team Rating */}
              <label style={labelStyle}>
                Overall Team Rating <span style={{ color: '#8B1A1A' }}>*</span>
              </label>
              <p style={{ fontSize: 'var(--text-xs)', color: '#888', marginBottom: 12 }}>
                How satisfied are you with the overall service provided by this team?
              </p>

              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 8, marginBottom: 12,
              }}>
                {[
                  { n: 1, emoji: '😞', label: 'Very unsatisfied' },
                  { n: 2, emoji: '😕', label: 'Unsatisfied'      },
                  { n: 3, emoji: '😐', label: 'Neither'          },
                  { n: 4, emoji: '😊', label: 'Satisfied'        },
                  { n: 5, emoji: '😄', label: 'Very satisfied'   },
                ].map(r => {
                  const isActive = form.officer_rating === r.n;
                  return (
                    <div
                      key={r.n}
                      onClick={() => set('officer_rating', r.n)}
                      style={{ textAlign: 'center', cursor: 'pointer' }}
                    >
                      <div style={{
                        borderRadius: 8, padding: '10px 4px 8px',
                        border: `${isActive ? '2px' : '1px'} solid ${isActive ? '#CC7700' : '#C8D0DC'}`,
                        background: isActive ? '#FEF3DC' : '#fff',
                        transition: 'all .15s',
                      }}>
                        <div style={{ fontSize: 22, marginBottom: 4 }}>{r.emoji}</div>
                        <div style={{
                          fontSize: 'var(--text-md)', fontWeight: 500,
                          color: isActive ? '#CC7700' : '#4A4A4A',
                        }}>
                          {r.n}
                        </div>
                      </div>
                      <p style={{
                        fontSize: 'var(--text-xs)', marginTop: 5, lineHeight: 1.3,
                        color: isActive ? '#CC7700' : '#888',
                        fontWeight: isActive ? 500 : 400,
                      }}>
                        {r.label}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Selected callout */}
              {form.officer_rating > 0 && (() => {
                const colors: Record<number, { bg: string; border: string; color: string }> = {
                  1: { bg: '#FDE8E8', border: '#8B1A1A', color: '#8B1A1A' },
                  2: { bg: '#FDE8E8', border: '#8B1A1A', color: '#8B1A1A' },
                  3: { bg: '#F0F0F0', border: '#888',    color: '#444'    },
                  4: { bg: '#FEF3DC', border: '#CC7700', color: '#CC7700' },
                  5: { bg: '#E8F5EE', border: '#1B6B3A', color: '#1B6B3A' },
                };
                const emojis = ['', '😞', '😕', '😐', '😊', '😄'];
                const labels = ['', '1 — Very unsatisfied', '2 — Unsatisfied',
                                '3 — Neither', '4 — Satisfied', '5 — Very satisfied'];
                const c = colors[form.officer_rating];
                return (
                  <div style={{
                    background: c.bg, border: `0.5px solid ${c.border}`,
                    borderRadius: 6, padding: '10px 14px', marginBottom: 16,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span style={{ fontSize: 22 }}>{emojis[form.officer_rating]}</span>
                    <div>
                      <p style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: c.color }}>
                        {labels[form.officer_rating]}
                      </p>
                      <p style={{ fontSize: 'var(--text-xs)', color: c.color }}>
                        Your rating for the ICTMS team on this ticket
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Optional individual comment */}
              <label style={labelStyle}>
                Comment on a specific technician{' '}
                <span style={{
                  fontWeight: 400, textTransform: 'none',
                  letterSpacing: 0, fontSize: 'var(--text-xs)',
                }}>
                  — optional
                </span>
              </label>
              <p style={{ fontSize: 'var(--text-xs)', color: '#888', marginBottom: 8 }}>
                If a particular team member stood out — positively or otherwise —
                feel free to mention them here.
              </p>
              <textarea
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
                placeholder="e.g. John Paul was very responsive and walked me through the fix clearly. Ana was also helpful in setting up the printer drivers..."
                value={form.commendation}
                onChange={e => set('commendation', e.target.value)}
              />
            </div>
          )}
          {/* ═══ STEP 3 — SERVICE QUALITY ═══ */}
          {step === 3 && (
            <div>
              <div style={{
                background: 'var(--gov-navy)', padding: '8px 14px',
                fontSize: 'var(--text-xs)', fontWeight: 500, color: '#fff',
                marginBottom: 14, borderRadius: 4,
              }}>
                Part 3 — 8 Service Quality Dimensions
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: '#4A4A4A', marginBottom: 14, lineHeight: 1.5 }}>
                Rate your satisfaction (5 = Very Satisfied, 4 = Satisfied, 3 = Neither, 2 = Unsatisfied, 1 = Very Unsatisfied)
              </p>
              {dimensions.map(d => (
                <div key={d.key} style={{
                  opacity: d.disabled ? 0.5 : 1,
                  pointerEvents: d.disabled ? 'none' : 'auto',
                }}>
                  <p style={{fontSize: 'var(--text-sm)', fontWeight: 500, color: '#1A2A3A', marginBottom: 2}}>
                    {d.label}
                    {d.disabled && (
                      <span style={{
                        marginLeft: 8, fontSize: 'var(--text-xs)',
                        background: '#F0F0F0', color: '#888',
                        padding: '2px 6px', borderRadius: 3,
                        fontWeight: 400, textTransform: 'uppercase',
                        letterSpacing: 0.3,
                      }}>
                        N/A
                      </span>
                    )}
                  </p>
                  {!d.disabled ? (
                    <RatingSelector
                      value={(form as any)[d.key]}
                      onChange={v => set(d.key, v)}
                    />
                  ) : (
                    <div style={{
                      padding: '8px 10px', background: '#F5F5F5',
                      borderRadius: 4, textAlign: 'center',
                      fontSize: 'var(--text-xs)', color: '#888',
                    }}>
                      Not applicable
                    </div>
                  )}
                </div>
              ))}
                          </div>
          )}

          {/* ═══ STEP 4 — CITIZEN'S CHARTER ═══ */}
          {step === 4 && (
            <div>
              <div style={{
                background: 'var(--gov-navy)', padding: '8px 14px',
                fontSize: 'var(--text-xs)', fontWeight: 500, color: '#fff',
                marginBottom: 14, borderRadius: 4,
              }}>
                Part 4 — Citizen's Charter Questions
              </div>
              {[
                {
                  field: 'cc_awareness',
                  question: "I. Alam mo ba ang tungkol sa Citizen's Charter?",
                  options: [
                    "Yes, I am aware before my transaction (Oo, alam ko bago ang aking transaksyon)",
                    "Yes, but I only knew when I saw the CC of this office",
                    "No, not aware of the CC (Hindi ko alam ang Citizen's Charter)",
                  ],
                },
                {
                  field: 'cc_visibility',
                  question: "II. Nakita mo ba ang Citizen's Charter ng kanilang Opisina?",
                  options: [
                    "Yes, the CC is accessible (Oo, Madaling makita)",
                    "Yes, but the CC is hard to find (Oo, pero mahirap itong hanapin)",
                    "I haven't seen the CC (Hindi ko nakita ang Citizen's Charter)",
                  ],
                },
                {
                  field: 'cc_helpfulness',
                  question: "III. Nakatulong ba ang paggamit mo ng Citizen's Charter?",
                  options: [
                    "Yes, it is very helpful (Oo, nakatulong ang paggamit ng Citizen's Charter)",
                    "No, I wasn't able to use the CC",
                  ],
                },
              ].map(q => (
                <div key={q.field} style={{ marginBottom: 18 }}>
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: '#1A2A3A', marginBottom: 8, lineHeight: 1.5 }}>
                    {q.question}
                  </p>
                  {q.options.map(opt => (
                    <label key={opt} style={{
                      display: 'flex', alignItems: 'flex-start',
                      gap: 8, marginBottom: 6, cursor: 'pointer',
                    }}>
                      <input
                        type="radio"
                        name={q.field}
                        value={opt}
                        checked={(form as any)[q.field] === opt}
                        onChange={() => set(q.field, opt)}
                        style={{ marginTop: 2, flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 'var(--text-xs)', color: '#3A3A3A', lineHeight: 1.5 }}>{opt}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* ═══ STEP 5 — FEEDBACK ═══ */}
          {step === 5 && (
            <div>
              <div style={{
                background: 'var(--gov-navy)', padding: '8px 14px',
                fontSize: 'var(--text-xs)', fontWeight: 500, color: '#fff',
                marginBottom: 14, borderRadius: 4,
              }}>
                Part 5 — Commendation & Suggestions (Optional)
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>
                  Papuri o Mungkahi sa Empleyado (Commendation for the staff)
                </label>
                <textarea
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  value={form.commendation}
                  onChange={e => set('commendation', e.target.value)}
                  placeholder="Write your commendation or suggestion for the staff..."
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>
                  Mungkahi o Reklamo sa Serbisyo (Suggestion or Complaint)
                </label>
                <textarea
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  value={form.suggestion}
                  onChange={e => set('suggestion', e.target.value)}
                  placeholder="Write your suggestion or complaint about the service..."
                />
              </div>

              {/* Privacy Consent */}
              <div style={{
                background: '#F5F8FC', borderRadius: 6,
                padding: 12, fontSize: 'var(--text-xs)',
                color: '#5A6475', lineHeight: 1.6,
                marginBottom: 16,
                border: '0.5px solid #D0D9E4',
              }}>
                <strong style={{ color: '#1A2A3A' }}>Data Privacy Consent:</strong><br />
                Sa pamamagitan ng pagsusumite nitong Client Satisfaction Measurement Form,
                pumapayag ka sa pangongolekta, pagbuo, paggamit, pagproseso, pag-iimbak,
                at pagpapanatili ng iyong personal na data ng DSWD para sa layuning sukatin
                ang kasiyahan ng kliyente sa mga serbisyo ng DSWD.
              </div>
            </div>
          )}

        </div>

        {/* FOOTER */}
        {!submitted && (
        <div style={{
          padding: '12px 20px', borderTop: '0.5px solid #E5EAF0',
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', background: '#F8FAFC',
          position: 'sticky', bottom: 0,
        }}>
          <span style={{ fontSize: 'var(--text-xs)', color: '#888' }}>
            Step {step} of 5
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 1 && (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{
                  padding: '6px 14px', fontSize: 'var(--text-sm)',
                  border: '1px solid #C8D0DC', borderRadius: 4,
                  background: '#fff', cursor: 'pointer',
                }}
              >
                ← Back
              </button>
            )}
            {step < 5 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                style={{
                  padding: '6px 16px', fontSize: 'var(--text-sm)',
                  background: 'var(--gov-navy)', color: '#fff',
                  border: 'none', borderRadius: 4,
                  cursor: 'pointer', fontWeight: 500,
                }}
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  padding: '6px 16px', fontSize: 'var(--text-sm)',
                  background: submitting ? '#888' : 'var(--gov-green)',
                  color: '#fff', border: 'none', borderRadius: 4,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                }}
              >
                {submitting ? 'Submitting...' : '✓ Submit CSM & Close Ticket'}
              </button>
            )}
          </div>
        </div>
        )}

        {/* SUCCESS SCREEN */}
        {submitted && (
          <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,20,0.5)',
            zIndex: 9999, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              background: '#fff', borderRadius: 8,
              border: '0.5px solid #D0D9E4', width: 320,
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}>
              {/* Green header */}
              <div style={{
                background: 'var(--gov-green)',
                padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 'var(--text-lg)' }}>✅</span>
                <span style={{ color: '#fff', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                  CSMF Submitted!
                </span>
              </div>

              {/* Body */}
              <div style={{ padding: '14px 16px' }}>
                {/* Ticket reference */}
                <div style={{
                  background: '#F5F8FC', borderRadius: 6,
                  border: '0.5px solid #D0D9E4',
                  padding: '10px 12px', marginBottom: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{
                      fontSize: 'var(--text-xs)', color: '#6A7280', fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3,
                    }}>
                      Ticket Reference
                    </div>
                    <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--gov-navy)' }}>
                      {ticketNumber}
                    </div>
                  </div>
                  <span style={{ fontSize: 'var(--text-xl)' }}>🎫</span>
                </div>

                {/* Message */}
                <div style={{ fontSize: 'var(--text-sm)', color: '#1A2A3A', lineHeight: 1.6, marginBottom: 12 }}>
                  Thank you, <strong>{form.client_name || 'respondent'}</strong>!
                  Your feedback has been submitted and your ticket has been closed.
                </div>

                {/* Info note */}
                <div style={{
                  background: '#E8F1FA', borderLeft: '3px solid var(--gov-navy)',
                  borderRadius: '0 4px 4px 0', padding: '8px 10px',
                  fontSize: 'var(--text-xs)', color: 'var(--gov-navy)', lineHeight: 1.6,
                  marginBottom: 14,
                }}>
                  📋 Your CSMF has been recorded. This helps us improve our IT support services.
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '10px 16px', borderTop: '0.5px solid #EEF0F4',
                background: '#F8FAFC',
              }}>
                <button
                  onClick={onSubmitted}
                  style={{
                    width: '100%', padding: '6px',
                    background: 'var(--gov-navy)', color: '#fff',
                    border: 'none', borderRadius: 4,
                    fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}