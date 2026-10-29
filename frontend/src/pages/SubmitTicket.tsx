import ServiceAreaSelect from '../components/ServiceAreaSelect';
import CSMModal from '../components/CSMModal';
import { showErrorToast } from '../utils/notifications';
import SubmissionFeedback from '../components/SubmissionFeedback';
import notify from 'react-hot-toast';
import SubmissionAttachment from '../components/SubmissionAttachment';
import { Check, CircleCheck, IdCard, LockKeyhole, Paperclip, CircleHelp, UploadCloud, LoaderCircle } from 'lucide-react';
import './SubmitTicket.css';
import { useEffect, useRef, useState } from 'react';
import { driver, type Driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
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
  const tourRef = useRef<Driver | null>(null);
  const tourButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => () => { tourRef.current?.destroy(); }, []);
  function startSubmissionTour() {
    tourRef.current?.destroy();
    const steps: DriveStep[] = [
      { element: '.submit-requestor', popover: { title: 'Check your profile', description: 'Your name, employee number, division, and office come from your profile. Check them before submitting.' } },
      { element: '.submit-services', popover: { title: 'Choose a service area', description: 'Select the team that should handle your request. This enables the matching category options.' } },
      { element: '#ticket-subject', popover: { title: 'Write a clear subject', description: 'Briefly describe the issue, for example: Office laptop cannot connect to Wi-Fi.' } },
      { element: '#ticket-category', popover: { title: 'Select a category', description: 'After choosing a service area, pick the closest category. Sub-category and sub-item fields appear when available; use them to describe the request more precisely.' } },
      { element: '.submit-priority', popover: { title: 'Priority is automatic', description: 'The category, sub-category, or sub-item determines priority and SLA targets. You do not need to set these yourself.' } },
      ...(document.querySelector('#ticket-subcategory') ? [{ element: '#ticket-subcategory', popover: { title: 'Refine the category', description: 'Choose a sub-category when one matches your issue.' } }] : []),
      ...(document.querySelector('#ticket-subitem') ? [{ element: '#ticket-subitem', popover: { title: 'Choose a specific item', description: 'Select the relevant service item. This may update the priority and SLA.' } }] : []),
      { element: '#ticket-description', popover: { title: 'Explain the issue', description: 'Include what happened, when it started, who or what is affected, and any troubleshooting you have tried. Avoid passwords or sensitive information.' } },
      { element: '.submit-dropzone', popover: { title: 'Attach supporting files', description: 'Screenshots, documents, or videos can help the team investigate. Attach up to 5 files, with a maximum of 25 MB per file.' } },
      { element: '.submit-confirm', popover: { title: 'Review and submit', description: 'Review your information, then click Submit Ticket when ready. You will receive a reference number. Finishing this guide does not submit the form.' } },
    ];
    tourRef.current = driver({
      steps, showProgress: true, animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      allowClose: true, overlayOpacity: 0.45, stagePadding: 6, stageRadius: 6,
      nextBtnText: 'Next', prevBtnText: 'Back', doneBtnText: 'Got it',
      popoverClass: 'submit-ticket-tour', disableActiveInteraction: true,
      onDestroyed: () => { tourButtonRef.current?.focus({ preventScroll: true }); },
    });
    tourRef.current.drive();
  }

  const navigate = useNavigate();
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoryError, setCategoryError] = useState('');
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [subItems, setSubItems] = useState<SubItem[]>([]);
  const [selectedSLA, setSelectedSLA] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const submissionLock = useRef(false);
  const [toast, setToast] = useState('');
  const [submittedTicket, setSubmittedTicket] = useState<{ ticket_number: string; subject: string } | null>(null);
  const [resolvedTicket, setResolvedTicket] = useState<{ id: number; ticket_number: string; subject: string } | null>(null);
  const [checkingResolved, setCheckingResolved] = useState(true);
  const [pendingCheckError, setPendingCheckError] = useState(false);
  const [showPendingCSM, setShowPendingCSM] = useState(false);
  async function checkPendingFeedback() {
    setCheckingResolved(true);
    setPendingCheckError(false);
    try {
      const { data } = await api.get('/tickets/my-pending-csm');
      setResolvedTicket(data.pending ? data.ticket : null);
    } catch { setPendingCheckError(true); }
    finally { setCheckingResolved(false); }
  }
  const [officeLocation, setOfficeLocation] = useState(user?.office_location || '');
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draggingFiles, setDraggingFiles] = useState(false);

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
    setCategoriesLoading(true);
    api.get('/categories').then(res => { setCategories(res.data); setCategoryError(''); })
      .catch(() => setCategoryError('Categories could not be loaded. Please reload to try again.'))
      .finally(() => setCategoriesLoading(false));
    api.get('/service-areas').then(res => setServiceAreas(res.data)).catch(() => setServiceAreas([]));

    // ✅ Use dedicated endpoint — checks only THIS user's resolved tickets
    //    AND excludes tickets that already have CSM submitted
    if (user?.empno) {
      api.get('/tickets/my-pending-csm', { params: { empno: user.empno } })
        .then(res => {
          setResolvedTicket(res.data.pending ? res.data.ticket : null);
        })
        .catch(() => setPendingCheckError(true))
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

  function addFiles(selected: File[]) {
    if (submitting || attachments.length >= 5) return;
    const unsupported = selected.find(file => !/\.(jpe?g|png|gif|webp|mp4|webm|mov|pdf|docx?|txt)$/i.test(file.name));
    if (unsupported) { showErrorToast(`${unsupported.name} is not a supported file type.`); return; }
    const oversized = selected.find(file => file.size > 25 * 1024 * 1024);
    if (oversized) { showErrorToast(`${oversized.name} exceeds the 25 MB file limit.`); return; }
    const existing = new Set(attachments.map(file => `${file.name}-${file.size}-${file.lastModified}`));
    const unique = selected.filter(file => {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      if (existing.has(key)) return false;
      existing.add(key); return true;
    });
    const available = 5 - attachments.length;
    if (unique.length > available) showErrorToast(`You can attach up to 5 files. Only ${available} additional file(s) were added.`);
    setAttachments(current => [...current, ...unique.slice(0, available)]);
  }
  function addAttachments(event: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files || []));
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

    const cat = categories.find(c => String(c.id) === catId);

    const sla = resolveSLA(null, null, cat);
    setSelectedSLA(sla);
    setForm(p => ({ ...p, priority: cat?.default_priority || 'Medium' }));
    try {
      const res = await api.get('/categories/' + catId + '/subs');
      setSubCategories(res.data);
      setCategoryError('');
    } catch {
      setCategoryError('Sub-categories could not be loaded. Select the category again to retry.');
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

async function handleSubmit() {
  if (submissionLock.current) return;
  if (checkingResolved || pendingCheckError || resolvedTicket) {
    showErrorToast('Complete pending feedback before submitting a new ticket.');
    return;
  }
  try {
    const { data } = await api.get('/tickets/my-pending-csm');
    if (data.pending) { setResolvedTicket(data.ticket); return; }
  } catch {
    setPendingCheckError(true);
    showErrorToast('Unable to check pending feedback. Please try again.');
    return;
  }
  if (submissionLock.current) return;
  if (!form.service_area_id) {
    showErrorToast('Please select the service area that should handle this request.');
    return;
  }
  if (!form.subject.trim()) {
    showErrorToast('Please fill in the Subject field.');
    return;
  }
  if (!form.category_id) {
    showErrorToast('Please select a Category.');
    return;
  }
  if (!user?.empno) {
    showErrorToast('You must be logged in to submit a ticket.');
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

  submissionLock.current = true;
  setSubmitting(true);
  const submissionStartedAt = Date.now();
  let completedTicket: { ticket_number: string; subject: string } | null = null;
  tourRef.current?.destroy();
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

    const feedbackDelay = Math.max(0, 800 - (Date.now() - submissionStartedAt));
    if (feedbackDelay > 0) await new Promise(resolve => setTimeout(resolve, feedbackDelay));
    completedTicket = { ticket_number: res.data.ticket_number, subject: form.subject };
    setForm({ subject: '', description: '', priority: 'Medium', service_area_id: '', category_id: '', sub_category_id: '', sub_item_id: '', division: '' });
    setSubCategories([]);
    setSubItems([]);
    setSelectedSLA(null);
    setAttachments([]);
  } catch (err: any) {
    console.error('Submit error:', err.response?.data);
    notify.error(err.response?.data?.error || 'Failed to submit ticket. Your entries are still here; please try again.');
  } finally {
    setSubmitting(false);
    if (!completedTicket) submissionLock.current = false;
  }
  if (completedTicket) {
    // Let the button render its idle state before presenting the confirmation.
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    setSubmittedTicket(completedTicket);
    submissionLock.current = false;
  }
}

  const initials = (user?.full_name || 'User').split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('');
  return (
    <div className="submit-page">
      <div className="submit-breadcrumb">Home / <strong>Submit a Ticket</strong></div>

      {toast && <p role="status">{toast}</p>}
      {showPendingCSM && resolvedTicket && <CSMModal ticketId={resolvedTicket.id} ticketNumber={resolvedTicket.ticket_number} assignedTo={null} onClose={() => setShowPendingCSM(false)} onSubmitted={() => { setShowPendingCSM(false); void checkPendingFeedback(); }} />}
      <div className="submit-gated-layout">
        {!checkingResolved && (pendingCheckError || resolvedTicket) && <div className="submit-gate-overlay"><div className="submit-gate-card" role="status">
          <span className="submit-gate-icon"><LockKeyhole size={24} /></span>
          <h2>{pendingCheckError ? 'Unable to check feedback' : 'Help us make our service better'}</h2>
          <p>{pendingCheckError ? 'Retry the check to continue submitting your ticket.' : 'How did we do? Your feedback helps us improve our support and serve you better. Share your experience with your resolved ticket, then you can submit a new request.'}</p>
          {resolvedTicket && !checkingResolved && !pendingCheckError && <><span className="submit-gate-reference">{resolvedTicket.ticket_number}</span><button type="button" onClick={() => setShowPendingCSM(true)}>Share your feedback</button></>}
          {pendingCheckError && <button type="button" onClick={() => void checkPendingFeedback()}>Retry</button>}
        </div></div>}
        <div className={'submit-columns' + (!checkingResolved && (pendingCheckError || resolvedTicket) ? ' is-locked' : '')} inert={!checkingResolved && Boolean(pendingCheckError || resolvedTicket)}>
        <div className="submit-requestor-column">
        <aside className="submit-requestor">
          <h2>Requestor Information</h2>
          <div className="submit-identity"><div className="submit-avatar" aria-hidden="true">{initials}</div><span className="submit-caption">Submitting as</span><strong>{user?.full_name}</strong><span className="submit-employee"><IdCard size={13} aria-hidden="true" />Employee No. {user?.empno}</span></div>
          <dl className="submit-profile-fields">{[{ label: 'Unit', value: user?.unit }, { label: 'Division', value: user?.division }, { label: 'Office location', value: officeLocation }].map(field => <div key={field.label}><dt>{field.label}</dt><dd>{field.value || 'Not available'}</dd></div>)}</dl>
          <p className="submit-profile-note"><LockKeyhole size={14} aria-hidden="true" />Taken from your profile. You do not need to fill in anything here.</p>
        </aside>
      <div className="submit-guide-row"><button ref={tourButtonRef} type="button" className="submit-guide-button" onClick={startSubmissionTour} disabled={!checkingResolved && !!resolvedTicket}><CircleHelp size={16} />How to submit a ticket</button></div>
        </div>
        <section className="submit-details"><h2>Ticket Details</h2>
          <form onSubmit={event => { event.preventDefault(); void handleSubmit(); }} className="submit-form" aria-busy={submitting}><fieldset className="submit-form-lock" disabled={submitting || (!checkingResolved && (pendingCheckError || !!resolvedTicket))}>
            <fieldset className="submit-services submit-services-selector"><legend className="submit-sr-only">Which service do you need?</legend><div className="submit-services-heading"><strong><span>STEP 1</span>Which service do you need?</strong><p>Choose the team that can help with your concern.</p></div>
              {serviceAreas.filter(area => Boolean(area.is_active)).length > 6 ? <ServiceAreaSelect areas={serviceAreas.filter(area => Boolean(area.is_active))} value={form.service_area_id} onChange={value => void handleServiceAreaChange(value)} /> : (<div className="submit-service-options">{serviceAreas.filter(area => Boolean(area.is_active)).map(area => <label key={area.id} className={'submit-service-option' + (form.service_area_id === String(area.id) ? ' is-selected' : '')}><input type="radio" name="service_area_id" value={area.id} checked={form.service_area_id === String(area.id)} onChange={event => handleServiceAreaChange(event.target.value)} required /><span><strong>{area.code}</strong><small>{area.name}</small></span>{form.service_area_id === String(area.id) && <CircleCheck className="submit-service-check" size={22} strokeWidth={1.8} aria-hidden="true" />}</label>)}</div>)}
              {!serviceAreas.some(area => Boolean(area.is_active)) && <p className="submit-no-services">No service areas are available. Please contact your administrator.</p>}
            </fieldset>
            <div className="submit-fields">
              <div className="submit-full"><label htmlFor="ticket-subject" style={labelStyle}>Subject *</label><input id="ticket-subject" name="subject" value={form.subject} onChange={handleChange} required placeholder="Brief description of the issue" style={inputStyle} /></div>
              <div><label htmlFor="ticket-category" style={labelStyle}>Category *</label><select id="ticket-category" value={form.category_id} onChange={event => void handleCategoryChange(event.target.value)} disabled={!form.service_area_id || categoriesLoading || !categories.length} aria-describedby="ticket-category-help" required style={{ ...inputStyle, background: !form.service_area_id ? '#F5F8FC' : '#fff' }}><option value="">{!form.service_area_id ? 'Select a service area above first' : categoriesLoading ? 'Loading categories...' : 'Select Category'}</option>{categories.filter(c => String(c.service_area_id) === form.service_area_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><p id="ticket-category-help" className="submit-file-hint">{!form.service_area_id ? 'Choose a service in Step 1 to enable this field.' : !categoriesLoading && !categories.some(c => String(c.service_area_id) === form.service_area_id) ? 'No categories are configured for this service area. Contact your administrator.' : 'Select the type of help you need.'}</p>{categoryError && <p role="alert" style={{ color: '#B42318', fontSize: 12 }}>{categoryError}</p>}</div>
              <div><label style={labelStyle}>Priority (automatic)</label><div className="submit-priority"><strong data-priority={form.priority}>{form.priority}</strong><span>{form.priority === 'Critical' ? 'System down / no workaround' : form.priority === 'High' ? 'Significant impact' : form.priority === 'Medium' ? 'Moderate impact' : 'Minor issue'}</span>{!selectedSLA && <small>Based on the selected category</small>}</div></div>
              {subCategories.length > 0 && <div><label htmlFor="ticket-subcategory" style={labelStyle}>Sub-Category</label><select id="ticket-subcategory" value={form.sub_category_id} onChange={event => void handleSubCategoryChange(event.target.value)} style={inputStyle}><option value="">Select Sub-Category</option>{subCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
              {subItems.length > 0 && <div><label htmlFor="ticket-subitem" style={labelStyle}>Sub-Item</label><select id="ticket-subitem" value={form.sub_item_id} onChange={event => handleSubItemChange(event.target.value)} style={inputStyle}><option value="">Select Sub-Item</option>{subItems.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}
              {selectedSLA?.sla_rule_id && <div className="submit-sla submit-full">SLA applied ({selectedSLA.level}): {selectedSLA.sla_impact} | Response: <strong>{formatTime(selectedSLA.response_time_hours)}</strong> | Resolution: <strong>{formatTime(selectedSLA.resolution_time_hours)}</strong></div>}
              <div className="submit-full"><label htmlFor="ticket-description" style={labelStyle}>Description</label><textarea id="ticket-description" name="description" value={form.description} onChange={handleChange} placeholder="Provide detailed information: what happened, when it started, steps already taken, affected devices/users..." rows={5} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', minHeight: 110 }} /></div>
              <div className="submit-full">
                <label htmlFor="ticket-files" style={labelStyle}>Supporting Files (Optional)</label>
                <input ref={fileInputRef} id="ticket-files" className="submit-sr-only" type="file" multiple accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime,application/pdf,.doc,.docx,.txt" onChange={addAttachments} disabled={submitting || attachments.length >= 5} tabIndex={-1} />
                <button type="button" className={'submit-dropzone' + (draggingFiles ? ' is-dragging' : '')} disabled={submitting || attachments.length >= 5} onClick={() => fileInputRef.current?.click()} aria-describedby="submit-dropzone-hint" onDragOver={event => { event.preventDefault(); if (!submitting && attachments.length < 5) setDraggingFiles(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDraggingFiles(false); }} onDrop={event => { event.preventDefault(); setDraggingFiles(false); addFiles(Array.from(event.dataTransfer.files)); }}>
                  <span className="submit-dropzone-icon"><UploadCloud size={24} strokeWidth={1.6} /></span>
                  <strong>{attachments.length >= 5 ? 'Maximum of 5 files attached' : 'Drop your files here, or click to browse'}</strong>
                  <span>Images, videos, PDF, Word, and text files</span>
                </button>
                <p id="submit-dropzone-hint" className="submit-file-hint">Documents, photos, or videos - up to 5 files, 25 MB each.</p>
                <div aria-live="polite">{attachments.map((file,index) => <SubmissionAttachment key={file.name + file.size + file.lastModified} file={file} disabled={submitting} onRemove={() => setAttachments(current => current.filter((_,i) => i !== index))} />)}</div>
              </div>
            </div>
            <footer className="submit-actions"><button type="button" onClick={() => navigate('/tickets')}>Cancel</button><button type="submit" disabled={submitting || checkingResolved || pendingCheckError || !!resolvedTicket || !serviceAreas.length} aria-busy={submitting} className="submit-confirm">{submitting ? <LoaderCircle size={16} className="submission-feedback-spinner" /> : <Check size={16} aria-hidden="true" />}{submitting ? 'Submitting...' : 'Submit Ticket'}</button></footer>
          </fieldset></form>
        </section>
      </div>
      </div>

      <SubmissionFeedback busy={false} progress={null} ticket={submitting ? null : submittedTicket} onView={() => navigate('/tickets')} onAnother={() => setSubmittedTicket(null)} />

    </div>
  );
}
