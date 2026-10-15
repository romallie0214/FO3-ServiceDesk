import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';


interface Category {
  id:               number;
  name:             string;
  service_area_id:  number | null;
  sla_rule_id:      number | null;
  default_priority: string | null;
  sla_priority:     string | null;
}

interface ServiceArea {
  id: number;
  code: string;
  name: string;
  is_active: number | boolean;
}

interface SubCategory {
  id: number;
  name: string;
  sla_rule_id: number | null;
  default_priority: string;
  sla_priority: string | null;
  sla_impact: string | null;
  response_time_hours: number | null;
  resolution_time_hours: number | null;
  escalation_time_hours: number | null;
}

interface SubItem {
  id: number;
  name: string;
  sla_rule_id: number | null;
  default_priority: string;
  sla_priority: string | null;
  sla_impact: string | null;
  response_time_hours: number | null;
  resolution_time_hours: number | null;
  escalation_time_hours: number | null;
}

const inputStyle: React.CSSProperties = {
  padding: 'clamp(6px, 1.2vw, 10px) clamp(8px, 1.5vw, 12px)', border: '1px solid #C8D0DC',
  borderRadius: 4, fontSize: 'clamp(10px, 1.8vw, 13px)', color: '#2A2A2A',
  background: '#fff', width: '100%', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 'clamp(9px, 1.6vw, 12px)', fontWeight: 500, color: '#5A6475',
  textTransform: 'uppercase', letterSpacing: 0.4,
  marginBottom: 'clamp(3px, 0.6vw, 5px)', display: 'block',
};

function resolveSLA(
  subItem: SubItem | null,
  subCat: SubCategory | null,
  cat: any
): any {
  // Most specific first
  if (subItem?.sla_rule_id) return { ...subItem, level: 'Sub-Item' };
  if (subCat?.sla_rule_id)  return { ...subCat,  level: 'Sub-Category' };
  if (cat?.sla_rule_id)     return { ...cat,     level: 'Category' };
  return null;
}

function formatTime(hours: number | null): string {
  if (!hours) return '—';
  if (hours < 1)  return `${Math.round(hours * 60)} mins`;
  if (hours < 24) return `${hours} hr${hours !== 1 ? 's' : ''}`;
  return `${hours / 24} day${hours / 24 !== 1 ? 's' : ''}`;
}

export default function SubmitTicket() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [subItems, setSubItems] = useState<SubItem[]>([]);
  const [selectedSLA, setSelectedSLA] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [submittedTicket, setSubmittedTicket] = useState<{ ticket_number: string; subject: string } | null>(null);
  const [resolvedTicket, setResolvedTicket] = useState<{ id: number; ticket_number: string; subject: string } | null>(null);
  const [checkingResolved, setCheckingResolved] = useState(true);
  const [officeLocation, setOfficeLocation] = useState(user?.office_location || '');
  const [attachments, setAttachments] = useState<File[]>([]);

  const [form, setForm] = useState({
    subject: '',
    description: '',
    priority: 'Medium',
    service_area_id: '',
    category_id: '',
    sub_category_id: '',
    sub_item_id: '',
    division: '',
  });

  useEffect(() => {
    api.get('/categories').then(res => setCategories(res.data));
    api.get('/service-areas').then(res => setServiceAreas(res.data)).catch(() => setServiceAreas([]));

    // ✅ Use dedicated endpoint — checks only THIS user's resolved tickets
    //    AND excludes tickets that already have CSM submitted
    if (user?.empno) {
      api.get('/tickets/my-pending-csm', { params: { empno: user.empno } })
        .then(res => {
          setResolvedTicket(res.data.pending ? res.data.ticket : null);
        })
        .catch(() => setResolvedTicket(null))
        .finally(() => setCheckingResolved(false));
    } else {
      setCheckingResolved(false);
    }
  }, [user?.empno]);

  useEffect(() => {
    setOfficeLocation(user?.office_location || '');
    if (!user?.empno || user.office_location) return;

    api.get('/users/erm/' + encodeURIComponent(user.empno))
      .then(res => setOfficeLocation(res.data?.area_assignment_name || ''))
      .catch(() => setOfficeLocation(''));
  }, [user?.empno, user?.office_location]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function addAttachments(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    const oversized = selected.find(file => file.size > 25 * 1024 * 1024);
    if (oversized) {
      alert(`${oversized.name} exceeds the 25 MB file limit.`);
      event.target.value = '';
      return;
    }
    setAttachments(current => {
      const available = 5 - current.length;
      if (selected.length > available) alert(`You can attach up to 5 files. Only ${available} additional file(s) were added.`);
      const existing = new Set(current.map(file => `${file.name}-${file.size}-${file.lastModified}`));
      return [...current, ...selected.filter(file => !existing.has(`${file.name}-${file.size}-${file.lastModified}`)).slice(0, available)];
    });
    event.target.value = '';
  }

  function handleServiceAreaChange(serviceAreaId: string) {
    setForm(prev => ({
      ...prev,
      service_area_id: serviceAreaId,
      category_id: '',
      sub_category_id: '',
      sub_item_id: '',
      priority: 'Medium',
    }));
    setSubCategories([]);
    setSubItems([]);
    setSelectedSLA(null);
  }

  async function handleCategoryChange(catId: string) {
    setForm(p => ({
      ...p, category_id: catId,
      sub_category_id: '', sub_item_id: '',
    }));
    setSubCategories([]);
    setSubItems([]);
    setSelectedSLA(null);

    if (!catId) return;

    const cat = categories.find(c => c.id === Number(catId));

    // Fetch sub-categories
    const res = await api.get(`/categories/${catId}/subs`);
    setSubCategories(res.data);

    // Set SLA from category level as default
    const sla = resolveSLA(null, null, cat);
    if (sla) {
      setSelectedSLA(sla);
      setForm(p => ({ ...p, category_id: catId, priority: cat?.default_priority || 'Medium' }));
    }
  }

  async function handleSubCategoryChange(subCatId: string) {
    setForm(p => ({ ...p, sub_category_id: subCatId, sub_item_id: '' }));
    setSubItems([]);

    if (!subCatId) {
      // Revert to category SLA
      const cat = categories.find(c => c.id === Number(form.category_id));
      const sla = resolveSLA(null, null, cat);
      setSelectedSLA(sla);
      return;
    }

    const subCat = subCategories.find(s => s.id === Number(subCatId));

    // Fetch sub-items
    const res = await api.get(`/categories/subs/${subCatId}/items`);
    setSubItems(res.data);

    // Resolve SLA — sub-category overrides category
    const cat = categories.find(c => c.id === Number(form.category_id));
    const sla = resolveSLA(null, subCat || null, cat);
    setSelectedSLA(sla);
    if (sla?.default_priority) {
      setForm(p => ({ ...p, sub_category_id: subCatId, priority: sla.default_priority }));
    }
  }

  function handleSubItemChange(subItemId: string) {
    setForm(prev => ({ ...prev, sub_item_id: subItemId }));

    if (!subItemId) {
      // Revert to sub-category SLA
      const subCat = subCategories.find(s => s.id === Number(form.sub_category_id));
      const cat    = categories.find(c => c.id === Number(form.category_id));
      const sla    = resolveSLA(null, subCat || null, cat);
      setSelectedSLA(sla);
      if (sla?.default_priority) setForm(p => ({ ...p, sub_item_id: '', priority: sla.default_priority }));
      return;
    }

    const subItem = subItems.find(i => i.id === Number(subItemId));
    const subCat  = subCategories.find(s => s.id === Number(form.sub_category_id));
    const cat     = categories.find(c => c.id === Number(form.category_id));
    const sla     = resolveSLA(subItem || null, subCat || null, cat);
    setSelectedSLA(sla);

    // ✅ Auto-update priority from sub-item SLA
    if (sla?.default_priority) {
      setForm(p => ({ ...p, sub_item_id: subItemId, priority: sla.default_priority }));
    }
  }

  function SectionHead({ icon, title }: { icon: string; title: string }) {
    return (
      <div style={{
        background: 'var(--gov-navy)', padding: 'clamp(8px, 1.5vw, 12px) clamp(12px, 2.5vw, 18px)',
        fontSize: 'clamp(11px, 1.9vw, 14px)', fontWeight: 500, color: '#fff',
        display: 'flex', alignItems: 'center', gap: 'clamp(6px, 1.5vw, 10px)',
      }}>
        {icon} {title}
      </div>
    );
  }

async function handleSubmit() {
  if (!form.service_area_id) {
    alert('Please select the service area that should handle this request.');
    return;
  }
  if (!form.subject.trim()) {
    alert('Please fill in the Subject field.');
    return;
  }
  if (!form.category_id) {
    alert('Please select a Category.');
    return;
  }
  if (!user?.empno) {
    alert('You must be logged in to submit a ticket.');
    return;
  }

  // Debug — check what's being sent
  console.log('Submitting form:', {
    subject: form.subject,
    service_area_id: form.service_area_id,
    category_id: form.category_id,
    sub_category_id: form.sub_category_id,
    sub_item_id: form.sub_item_id,
    priority: form.priority,
  });

  setSubmitting(true);
  try {
    const payload = new FormData();
    payload.append('subject', form.subject);
    payload.append('description', form.description);
    payload.append('priority', form.priority);
    payload.append('service_area_id', form.service_area_id);
    payload.append('category_id', form.category_id);
    if (form.sub_category_id) payload.append('sub_category_id', form.sub_category_id);
    if (form.sub_item_id) payload.append('sub_item_id', form.sub_item_id);
    payload.append('office_location', officeLocation || '');
    attachments.forEach(file => payload.append('attachments', file));
    const res = await api.post('/tickets', payload);

    setSubmittedTicket({ ticket_number: res.data.ticket_number, subject: form.subject });
    setForm({ subject: '', description: '', priority: 'Medium', service_area_id: '', category_id: '', sub_category_id: '', sub_item_id: '', division: '' });
    setSubCategories([]);
    setSubItems([]);
    setSelectedSLA(null);
    setAttachments([]);
  } catch (err: any) {
    console.error('Submit error:', err.response?.data);
    alert(err.response?.data?.error || 'Failed to submit ticket.');
  } finally {
    setSubmitting(false);
  }
}

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(14px, 3vw, 24px)' }}>

      {/* BREADCRUMB */}
      <div style={{ fontSize: 'clamp(10px, 1.8vw, 13px)', color: '#4A4A4A', marginBottom: 'clamp(10px, 2vw, 14px)' }}>
        Home <span style={{ color: 'var(--gov-navy)', fontWeight: 500 }}>
          / Submit a Ticket
        </span>
      </div>

      {/* INFO STRIP */}
      <div style={{
        background: '#E8F1FA', borderLeft: '3px solid var(--gov-navy)',
        borderRadius: '0 4px 4px 0', padding: 'clamp(8px, 2vw, 12px) clamp(10px, 3vw, 16px)',
        fontSize: 'clamp(10px, 1.8vw, 13px)', color: 'var(--gov-navy)', marginBottom: 'clamp(10px, 2vw, 14px)',
      }}>
        Choose the service area that should handle your request, then select the relevant category.
        You will receive a reference number upon submission.
      </div>

      {/* SECTION 1 — REQUESTOR INFO */}
      <div style={{
        background: '#fff', border: '0.5px solid #D0D9E4',
        borderRadius: 8, overflow: 'hidden', marginBottom: 'clamp(10px, 2vw, 14px)',
      }}>
        <SectionHead icon="👤" title="Requestor Information" />
        <div style={{ padding: 'clamp(12px, 2.5vw, 18px)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'clamp(10px, 2vw, 14px)' }}>

            {/* Employee Number — auto-filled from logged in user */}
            <div>
              <label style={labelStyle}>Employee Number</label>
              <input
                value={user?.empno ?? ''}
                readOnly
                style={{ ...inputStyle, background: '#F5F8FC', color: '#6A7280' }}
              />
            </div>


            {/* Full name — auto-filled from logged in user */}
            <div>
              <label style={labelStyle}>Full Name</label>
              <input
                value={user?.full_name ?? ''}
                readOnly
                style={{ ...inputStyle, background: '#F5F8FC', color: '#6A7280' }}
              />
            </div>

            {/* Unit — auto-filled */}
            <div>
              <label style={labelStyle}>Unit</label>
              <input
                value={user?.unit ?? ''}
                readOnly
                style={{ ...inputStyle, background: '#F5F8FC', color: '#6A7280' }}
              />
            </div>

            {/* Division — auto-filled */}
            <div>
              <label style={labelStyle}>Division</label>
              <input
                value={user?.division ?? ''}
                readOnly
                style={{ ...inputStyle, background: '#F5F8FC', color: '#6A7280' }}
              />
            </div>

            {/* Office Location — auto-filled from ERM */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Office Location</label>
              <input
                value={officeLocation}
                readOnly
                style={{ ...inputStyle, background: '#F5F8FC', color: '#6A7280' }}
              />
            </div>

          </div>
        </div>
      </div>

      {/* ── RESOLVED TICKET BLOCK ── */}
      {checkingResolved ? (
        <div style={{
          background: '#fff', border: '0.5px solid #D0D9E4',
          borderRadius: 8, padding: 'clamp(30px, 8vw, 48px)',
          textAlign: 'center', color: '#888', fontSize: 'clamp(11px, 1.9vw, 14px)',
        }}>
          Checking ticket status...
        </div>
      ) : resolvedTicket ? (
        <div style={{
          background: '#fff', border: '0.5px solid #D0D9E4',
          borderRadius: 8, overflow: 'hidden', marginBottom: 'clamp(10px, 2vw, 14px)',
        }}>
          {/* Red header */}
          <div style={{
            background: '#8B1A1A', padding: 'clamp(10px, 2vw, 14px) clamp(14px, 3vw, 20px)',
            display: 'flex', alignItems: 'center', gap: 'clamp(8px, 2vw, 12px)', flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 'clamp(18px, 4vw, 24px)' }}>⚠</span>
            <span style={{ color: '#fff', fontSize: 'clamp(12px, 2vw, 16px)', fontWeight: 600 }}>
              Action Required Before Submitting a New Ticket
            </span>
          </div>

          <div style={{ padding: 'clamp(14px, 3vw, 20px)' }}>
            <p style={{ fontSize: 'clamp(11px, 1.9vw, 14px)', color: '#2A2A2A', lineHeight: 1.7, marginBottom: 'clamp(10px, 2vw, 14px)', margin: 0 }}>
              You have a <strong>Resolved</strong> ticket that requires your feedback before you can submit a new request.
              Please complete the <strong>Client Satisfaction Measurement Form (CSMF)</strong> for the ticket below to close it.
            </p>

            {/* Ticket card */}
            <div style={{
              background: '#F5F8FC', border: '0.5px solid #D0D9E4',
              borderRadius: 6, padding: 'clamp(10px, 2vw, 14px)', marginBottom: 'clamp(12px, 2.5vw, 18px)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'clamp(8px, 2vw, 12px)',
            }}>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <div style={{ fontSize: 'clamp(8px, 1.5vw, 11px)', fontWeight: 600, color: 'var(--gov-navy)', marginBottom: 'clamp(2px, 0.5vw, 4px)' }}>
                  {resolvedTicket.ticket_number}
                </div>
                <div style={{ fontSize: 'clamp(10px, 1.8vw, 13px)', color: '#1A2A3A', fontWeight: 500, marginBottom: 'clamp(3px, 0.6vw, 6px)' }}>
                  {resolvedTicket.subject}
                </div>
                <div>
                  <span style={{
                    fontSize: 'clamp(8px, 1.5vw, 11px)', background: '#E8F5EE', color: '#1B6B3A',
                    padding: 'clamp(2px, 0.5vw, 3px) clamp(6px, 1.2vw, 10px)', borderRadius: 3, fontWeight: 500,
                  }}>
                    Resolved — Awaiting CSMF
                  </span>
                </div>
              </div>
              <button
                onClick={() => navigate('/tickets')}
                style={{
                  padding: 'clamp(6px, 1.2vw, 10px) clamp(12px, 2vw, 18px)', fontSize: 'clamp(10px, 1.8vw, 13px)',
                  background: 'var(--gov-navy)', color: '#fff',
                  border: 'none', borderRadius: 4,
                  cursor: 'pointer', fontWeight: 500,
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                Go to My Tickets →
              </button>
            </div>

            <div style={{
              background: '#E8F1FA', borderLeft: '3px solid var(--gov-navy)',
              borderRadius: '0 4px 4px 0', padding: 'clamp(8px, 2vw, 12px) clamp(10px, 3vw, 16px)',
              fontSize: 'clamp(10px, 1.8vw, 13px)', color: 'var(--gov-navy)',
            }}>
              Once you submit the CSMF for <strong>{resolvedTicket.ticket_number}</strong>,
              the ticket will be marked as <strong>Closed</strong> and you can submit a new ticket.
            </div>
          </div>
        </div>
      ) : (
        <>
      {/* SECTION 2 — TICKET DETAILS */}
      <div style={{
        background: '#fff', border: '0.5px solid #D0D9E4',
        borderRadius: 8, overflow: 'hidden', marginBottom: 'clamp(10px, 2vw, 14px)',
      }}>
        <SectionHead icon="🎫" title="Ticket Details" />
        <div style={{ padding: 'clamp(12px, 2.5vw, 18px)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'clamp(10px, 2vw, 14px)' }}>

            {/* Step 1: an explicit visual choice makes ticket routing clear. */}
            <div style={{
              gridColumn: '1 / -1', border: form.service_area_id ? '1px solid #9BCFB8' : '2px solid var(--gov-navy)',
              borderRadius: 8, overflow: 'hidden', background: '#fff',
              boxShadow: form.service_area_id ? 'none' : '0 2px 10px rgba(13,59,110,0.12)',
            }}>
              <div style={{ background: form.service_area_id ? '#E8F5EE' : '#E8F1FA', padding: '12px 14px', borderBottom: '1px solid #D5E1EE' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ background: 'var(--gov-navy)', color: '#fff', borderRadius: 999, padding: '3px 9px', fontWeight: 700, fontSize: 'clamp(9px, 1.5vw, 11px)' }}>STEP 1</span>
                  <strong style={{ color: 'var(--gov-navy)', fontSize: 'clamp(13px, 2.2vw, 17px)' }}>Which service do you need?</strong>
                </div>
                <div style={{ marginTop: 5, color: '#52657A', fontSize: 'clamp(10px, 1.7vw, 12px)' }}>
                  Select the team responsible for your request. Its categories and service staff will be used for this ticket.
                </div>
              </div>
              <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                {serviceAreas.filter(area => Boolean(area.is_active)).map(area => {
                  const selected = String(area.id) === form.service_area_id;
                  return <button key={area.id} type="button" onClick={() => handleServiceAreaChange(String(area.id))} style={{
                    textAlign: 'left', padding: '14px 16px', borderRadius: 7,
                    border: selected ? '2px solid var(--gov-green)' : '1px solid #C8D7E6',
                    background: selected ? '#E8F5EE' : '#fff', cursor: 'pointer',
                    boxShadow: selected ? '0 1px 5px rgba(27,107,58,0.15)' : 'none',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 'clamp(12px, 2vw, 15px)', fontWeight: 700, color: selected ? '#176B3A' : 'var(--gov-navy)' }}>{area.code}</span>
                      {selected && <span style={{ color: '#176B3A', fontWeight: 700, fontSize: 'clamp(10px, 1.7vw, 12px)' }}>Selected</span>}
                    </div>
                    <div style={{ marginTop: 4, color: '#52657A', fontSize: 'clamp(10px, 1.7vw, 12px)', lineHeight: 1.4 }}>{area.name}</div>
                  </button>;
                })}
                {serviceAreas.length === 0 && <div style={{ color: '#8B1A1A', fontSize: 'var(--text-sm)' }}>No active service areas are available. Please contact the FO3 Service Desk administrator.</div>}
              </div>
            </div>

            {/* Native select retained for form accessibility; selection is made with the cards above. */}
            <div style={{ display: 'none', gridColumn: '1 / -1' }}>
              <label style={labelStyle}>
                Service Area <span style={{ color: '#8B1A1A' }}>*</span>
              </label>
              <select
                value={form.service_area_id}
                onChange={e => handleServiceAreaChange(e.target.value)}
                style={inputStyle}
              >
                <option value="">— Select the service you need —</option>
                {serviceAreas.filter(area => Boolean(area.is_active)).map(area => (
                  <option key={area.id} value={area.id}>{area.code} — {area.name}</option>
                ))}
              </select>
              <div style={{ marginTop: 5, color: '#667085', fontSize: 'clamp(9px, 1.5vw, 11px)' }}>
                Your ticket will be routed to the selected service area's team.
              </div>
            </div>

            {/* Subject - full width */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>
                Subject <span style={{ color: '#8B1A1A' }}>*</span>
              </label>
              <input
                name="subject"
                value={form.subject}
                onChange={handleChange}
                placeholder="Brief description of the issue"
                style={inputStyle}
              />
            </div>

          
            {/* Category */}
            <div>
              <label style={labelStyle}>
                Category <span style={{ color: '#8B1A1A' }}>*</span>
              </label>
              <select
                name="category_id"
                value={form.category_id}
                onChange={e => handleCategoryChange(e.target.value)}
                disabled={!form.service_area_id}
                style={{ ...inputStyle, background: form.service_area_id ? '#fff' : '#F5F8FC', cursor: form.service_area_id ? 'pointer' : 'not-allowed' }}
              >
                <option value="">— Select Category —</option>
                {categories.filter(c => String(c.service_area_id) === form.service_area_id).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Sub-Category — shows after category selected */}
            {subCategories.length > 0 && (
              <div>
                <label style={labelStyle}>Sub-Category</label>
                <select
                  value={form.sub_category_id}
                  onChange={e => handleSubCategoryChange(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">— Select Sub-Category —</option>
                  {subCategories.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Sub-Item — shows after sub-category selected */}
            {subItems.length > 0 && (
              <div>
                <label style={labelStyle}>Sub-Item</label>
                <select
                  value={form.sub_item_id}
                  onChange={e => handleSubItemChange(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">— Select Sub-Item —</option>
                  {subItems.map(i => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* SLA Info strip */}
            {selectedSLA?.sla_rule_id && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{
                  background: '#E8F1FA',
                  borderLeft: '3px solid var(--gov-navy)',
                  borderRadius: '0 4px 4px 0',
                  padding: 'clamp(8px, 2vw, 12px) clamp(10px, 3vw, 16px)', fontSize: 'clamp(9px, 1.6vw, 12px)',
                  color: 'var(--gov-navy)',
                }}>
                  <div style={{ display: 'flex', gap: 'clamp(8px, 2vw, 14px)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500 }}>
                      SLA Applied ({selectedSLA.level}):
                    </span>
                    <span style={{
                      background: '#FDE8E8', color: '#8B1A1A',
                      padding: 'clamp(1px, 0.3vw, 2px) clamp(6px, 1.2vw, 8px)', borderRadius: 3,
                      fontSize: 'clamp(8px, 1.5vw, 11px)', fontWeight: 500,
                    }}>
                      {selectedSLA.sla_priority}
                    </span>
                    <span style={{
                      background: '#E8F1FA', color: '#0D3B6E',
                      padding: 'clamp(1px, 0.3vw, 2px) clamp(6px, 1.2vw, 8px)', borderRadius: 3,
                      fontSize: 'clamp(8px, 1.5vw, 11px)', fontWeight: 500,
                    }}>
                      {selectedSLA.sla_impact}
                    </span>
                    <span style={{ fontSize: 'clamp(8px, 1.5vw, 11px)' }}>
                      Response: <strong>{formatTime(selectedSLA.response_time_hours)}</strong>
                    </span>
                    <span style={{ fontSize: 'clamp(8px, 1.5vw, 11px)' }}>
                      Resolution: <strong>{formatTime(selectedSLA.resolution_time_hours)}</strong>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ✅ Priority — read-only, auto-filled from SLA */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Priority (Auto-filled from SLA)</label>
              <div style={{
                ...inputStyle,
                display: 'flex', alignItems: 'center',
                gap: 'clamp(8px, 2vw, 12px)', background: '#F5F8FC',
                cursor: 'default', flexWrap: 'wrap',
              }}>
                <span style={{
                  padding: 'clamp(2px, 0.5vw, 3px) clamp(8px, 1.5vw, 12px)', borderRadius: 3,
                  fontSize: 'clamp(9px, 1.6vw, 12px)', fontWeight: 600,
                  background:
                    form.priority === 'Critical' ? '#FDE8E8' :
                    form.priority === 'High'     ? '#FEF3DC' :
                    form.priority === 'Medium'   ? '#E8F1FA' : '#F0F0F0',
                  color:
                    form.priority === 'Critical' ? '#8B1A1A' :
                    form.priority === 'High'     ? '#CC7700' :
                    form.priority === 'Medium'   ? '#0D3B6E' : '#666',
                }}>
                  {form.priority}
                </span>
                <span style={{ fontSize: 'clamp(9px, 1.6vw, 12px)', color: '#888' }}>
                  {form.priority === 'Critical' ? 'System down / no workaround' :
                  form.priority === 'High'     ? 'Significant impact'         :
                  form.priority === 'Medium'   ? 'Moderate impact'            :
                                                  'Minor issue, workaround available'}
                </span>
                {!selectedSLA && (
                  <span style={{ fontSize: 'clamp(8px, 1.5vw, 11px)', color: '#aaa', marginLeft: 'auto' }}>
                    Default — select a category to apply SLA
                  </span>
                )}
              </div>
            </div>

            {/* Description - full width */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Provide detailed information: what happened, when it started, steps already taken, affected devices/users..."
                rows={5}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', minHeight: 'clamp(80px, 15vw, 120px)' }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Supporting Files (Optional)</label>
              <input
                type="file" multiple
                accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime,application/pdf,.doc,.docx,.txt"
                onChange={addAttachments}
                disabled={attachments.length >= 5}
                style={{ ...inputStyle, opacity: attachments.length >= 5 ? 0.6 : 1 }}
              />
              <div style={{ fontSize: 'var(--text-xs)', color: '#6A7280', marginTop: 5 }}>
                Documents, photos, or videos — up to 5 files, 25 MB each.
              </div>
              {attachments.length > 0 && <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                {attachments.map((file, index) => <div key={`${file.name}-${file.lastModified}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#F5F8FC', padding: '6px 10px', borderRadius: 4, fontSize: 'var(--text-xs)' }}>
                  <span>📎 {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                  <button type="button" onClick={() => setAttachments(current => current.filter((_, itemIndex) => itemIndex !== index))} style={{ border: 'none', background: 'none', color: '#B42318', fontWeight: 600, cursor: 'pointer' }}>Remove</button>
                </div>)}
              </div>}
            </div>

          </div>
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'clamp(6px, 1.5vw, 10px)', flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate('/tickets')}
          style={{
            padding: 'clamp(6px, 1.2vw, 8px) clamp(12px, 2vw, 16px)', fontSize: 'clamp(10px, 1.8vw, 13px)',
            border: '1px solid #C8D0DC', borderRadius: 4,
            background: '#fff', cursor: 'pointer', color: '#2A2A2A',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            padding: 'clamp(6px, 1.2vw, 8px) clamp(12px, 2vw, 16px)', fontSize: 'clamp(10px, 1.8vw, 13px)',
            background: submitting ? '#888' : 'var(--gov-green)',
            color: '#fff', border: 'none', borderRadius: 4,
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontWeight: 500,
          }}
        >
          {submitting ? 'Submitting...' : '✓ Submit Ticket'}
        </button>
      </div>

      </>
      )}

      {/* SUCCESS MODAL */}
      {submittedTicket && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,20,0.5)',
          zIndex: 300, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          padding: 'clamp(12px, 3vw, 20px)',
        }}>
          <div style={{
            background: '#fff', borderRadius: 8,
            border: '0.5px solid #D0D9E4', width: 'clamp(280px, 90vw, 380px)',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}>
            {/* Green header */}
            <div style={{
              background: 'var(--gov-green)',
              padding: 'clamp(10px, 2vw, 14px) clamp(12px, 2.5vw, 18px)',
              display: 'flex', alignItems: 'center', gap: 'clamp(6px, 1.5vw, 10px)',
            }}>
              <span style={{ fontSize: 'clamp(18px, 4vw, 24px)' }}>✅</span>
              <span style={{ color: '#fff', fontSize: 'clamp(12px, 2vw, 16px)', fontWeight: 600 }}>
                Ticket Submitted!
              </span>
            </div>

            {/* Body */}
            <div style={{ padding: 'clamp(12px, 2.5vw, 18px)' }}>
              {/* Ticket number */}
              <div style={{
                background: '#F5F8FC', borderRadius: 6,
                border: '0.5px solid #D0D9E4',
                padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 14px)', marginBottom: 'clamp(10px, 2vw, 14px)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'clamp(8px, 2vw, 12px)',
              }}>
                <div>
                  <div style={{
                    fontSize: 'clamp(8px, 1.5vw, 11px)', color: '#6A7280', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'clamp(2px, 0.5vw, 4px)',
                  }}>
                    Reference Number
                  </div>
                  <div style={{ fontSize: 'clamp(14px, 2.5vw, 18px)', fontWeight: 700, color: 'var(--gov-navy)' }}>
                    {submittedTicket.ticket_number}
                  </div>
                </div>
                <span style={{ fontSize: 'clamp(18px, 4vw, 24px)' }}>🎫</span>
              </div>

              {/* Subject */}
              <div style={{ marginBottom: 'clamp(10px, 2vw, 14px)' }}>
                <div style={{
                  fontSize: 'clamp(8px, 1.5vw, 11px)', color: '#6A7280', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'clamp(2px, 0.5vw, 4px)',
                }}>
                  Subject
                </div>
                <div style={{ fontSize: 'clamp(10px, 1.8vw, 13px)', color: '#1A2A3A', lineHeight: 1.5 }}>
                  {submittedTicket.subject}
                </div>
              </div>

              {/* Info */}
              <div style={{
                background: '#E8F1FA', borderLeft: '3px solid var(--gov-navy)',
                borderRadius: '0 4px 4px 0', padding: 'clamp(8px, 1.5vw, 12px) clamp(10px, 2vw, 14px)',
                fontSize: 'clamp(9px, 1.6vw, 12px)', color: 'var(--gov-navy)', lineHeight: 1.6,
              }}>
                📧 A confirmation email has been sent. The responsible service section will review your ticket shortly.
              </div>
            </div>

            {/* Footer buttons */}
            <div style={{
              padding: 'clamp(10px, 2vw, 14px) clamp(12px, 2.5vw, 18px)', display: 'flex', gap: 'clamp(6px, 1.5vw, 10px)',
              borderTop: '0.5px solid #EEF0F4', background: '#F8FAFC', flexWrap: 'wrap',
            }}>
              <button
                onClick={() => navigate('/tickets')}
                style={{
                  flex: 1, minWidth: '120px', padding: 'clamp(6px, 1.2vw, 8px)',
                  background: 'var(--gov-navy)', color: '#fff',
                  border: 'none', borderRadius: 4,
                  fontSize: 'clamp(10px, 1.8vw, 13px)', fontWeight: 600, cursor: 'pointer',
                }}
              >
                View My Tickets
              </button>
              <button
                onClick={() => setSubmittedTicket(null)}
                style={{
                  flex: 1, minWidth: '120px', padding: 'clamp(6px, 1.2vw, 8px)',
                  background: '#fff', color: '#1A2A3A',
                  border: '1px solid #C8D0DC', borderRadius: 4,
                  fontSize: 'clamp(10px, 1.8vw, 13px)', fontWeight: 500, cursor: 'pointer',
                }}
              >
                Submit Another
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
