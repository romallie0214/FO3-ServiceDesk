import { showErrorToast } from '../utils/notifications';
import toast from 'react-hot-toast';
import { useEffect, useRef, useState } from 'react';
import { Ticket as TicketIcon, X, Maximize2, Minimize2, Shuffle, Users, UserPlus, Plus, Paperclip, Check, Undo2, Pause, TriangleAlert, ClipboardCheck, CircleDot, ChevronRight, Save, Send, LoaderCircle } from 'lucide-react';
import './TicketDetailModal.css';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import CSMModal from './CSMModal';


interface Ticket {
  id: number;
  ticket_number: string;
  subject: string;
  description: string;
  status: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  category: string;
  sub_category: string | null;
  sub_item: string | null;
  requestor: string;
  division: string;
  unit?: string | null;
  office_location?: string | null;
  assigned_to: string | null;
  created_at: string;
  cancel_reason: string | null;
  empno?: string;
  service_area_id?: number | null;
  service_area_code?: string | null;
  service_area_name?: string | null;
}

interface Comment {
  id: number;
  content: string;
  full_name: string;
  role: string;
  created_at: string;
  author_name?: string;
}

interface SLAInfo {
  sla_priority: string;
  sla_impact: string;
  sla_response_hours: number;
  sla_resolution_hours: number;
  sla_escalation_hours: number;
  sla_level: string;
  effective_elapsed_seconds?: number;
  total_hold_seconds?: number;
  is_on_hold?: boolean;
  created_at: string;
  status: string;
  first_response_at: string | null;
  assigned_at: string | null;
  escalation_started_at: string | null;
  resolved_at: string | null;
}

interface User {
  id: number;
  full_name: string;
  role: string;
  empno?: string;
  service_role?: string;
}

interface Category {
  id: number;
  name: string;
}

interface SubCategory {
  id: number;
  name: string;
}

interface SubItem {
  id: number;
  name: string;
}

interface Props {
  ticket: Ticket | null;
  onClose: () => void;
  onResolved: () => void;
  forceRequestorView?: boolean;
}

interface CoAssignee {
  id:          number;
  user_id:     number;
  empno:       string;
  full_name:   string;
  role:        'primary' | 'co-assignee';
  assigned_at: string;
}
interface TicketAttachment {
  id: number;
  original_filename: string;
  content_type: string;
  file_size: number;
  storage_download_url: string | null;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, React.CSSProperties> = {
    'Open':        { background: '#E8F1FA', color: '#0D3B6E' },
    'Assigned':    { background: '#E1F5EE', color: '#085041' },
    'In Progress': { background: '#FEF3DC', color: '#CC7700' },
    'On-Hold':     { background: '#FDF5DC', color: '#854F0B' },
    'Resolved':    { background: '#E8F5EE', color: '#1B6B3A' },
    'Cancelled':   { background: '#FDE8E8', color: '#8B1A1A' },
    'Closed':      { background: '#F0F0F0', color: '#4A4A4A' },
  };
  const s = styles[status] ?? styles['Open'];
  return (
    <span style={{
      ...s, fontSize: 'var(--text-xs)', padding: '2px 8px',
      borderRadius: 3, fontWeight: 500,
    }}>
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, React.CSSProperties> = {
    'Critical': { background: '#FDE8E8', color: '#8B1A1A' },
    'High':     { background: '#FEF3DC', color: '#CC7700' },
    'Medium':   { background: '#E8F1FA', color: '#0D3B6E' },
    'Low':      { background: '#F0F0F0', color: '#666'    },
  };
  return (
    <span style={{
      ...styles[priority] ?? styles['Medium'],
      fontSize: 'var(--text-xs)', padding: '2px 8px',
      borderRadius: 3, fontWeight: 500,
    }}>
      {priority}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '6px 10px', border: '1px solid #C8D0DC',
  borderRadius: 4, fontSize: 'var(--text-sm)', width: '100%',
  background: '#fff', color: '#2A2A2A',
};



function OnHoldReasonBox({
  ticketNumber, reason, onReasonChange, onConfirm, onCancel, loading,
}: {
  ticketNumber: string; reason: string;
  onReasonChange: (v: string) => void;
  onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 9999,
    }}>
      <div style={{
        background: '#fff', borderRadius: 10,
        width: 420, overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{
          background: '#CC7700', padding: '16px 20px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 22 }}>⏸</span>
          <span style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: '#fff' }}>
            Put Ticket On-Hold
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>
          <p style={{ fontSize: 'var(--text-base)', color: '#3A3A3A', marginBottom: 12 }}>
            You are putting <strong>{ticketNumber}</strong> on hold.
            Please provide a reason so the requestor is informed.
          </p>
          <label style={{
            fontSize: 'var(--text-xs)', fontWeight: 600, color: '#5A6475',
            textTransform: 'uppercase', letterSpacing: 0.4,
            display: 'block', marginBottom: 6,
          }}>
            Reason for On-Hold <span style={{ color: '#8B1A1A' }}>*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => onReasonChange(e.target.value)}
            rows={3}
            placeholder="e.g. Waiting for replacement part, pending vendor response..."
            style={{
              width: '100%', padding: '8px 10px',
              fontSize: 'var(--text-sm)', border: '1px solid #C8D0DC',
              borderRadius: 4, resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px 20px',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button onClick={onCancel} style={{
            padding: '8px 18px', fontSize: 'var(--text-sm)',
            border: '1px solid #C8D0DC', borderRadius: 5,
            background: '#fff', cursor: 'pointer', color: '#4A4A4A',
          }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading || !reason.trim()} style={{
            padding: '8px 20px', fontSize: 'var(--text-sm)',
            background: loading || !reason.trim() ? '#C8D0DC' : '#CC7700',
            color: '#fff', border: 'none', borderRadius: 5,
            cursor: loading || !reason.trim() ? 'not-allowed' : 'pointer',
            fontWeight: 500,
          }}>
            {loading ? 'Saving...' : 'Confirm On-Hold'}
          </button>
        </div>
      </div>
    </div>
  );
}

  export default function TicketDetailModal({ ticket: ticketProp, onClose: dismissSheet, onResolved, forceRequestorView }: Props) {
  const { user } = useAuth();
  const [assignedName, setAssignedName] = useState<string | null>(null);
  const assignmentChanged = useRef(false);
  const ticket = ticketProp && assignedName !== null ? { ...ticketProp, assigned_to: assignedName } : ticketProp;
  useEffect(() => { setAssignedName(null); assignmentChanged.current = false; }, [ticketProp?.id]);
  function onClose() {
    if (assignmentChanged.current) { assignmentChanged.current = false; onResolved(); }
    dismissSheet();
  }
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setClosing(false);
    return () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  }, [ticket?.id]);
  function closeSheet() {
    if (closing) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { onClose(); return; }
    setClosing(true);
    closeTimer.current = setTimeout(onClose, 280);
  }
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setExpanded(false); setShowReclassify(false); }, [ticket?.id]);
  useEffect(() => {
    if (!ticket) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheetRef.current?.focus({ preventScroll: true });
    return () => { document.body.style.overflow = previousOverflow; previousFocus?.focus({ preventScroll: true }); };
  }, [ticket?.id]);
  const [comments, setComments]     = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting]       = useState(false);
  const [showCSM, setShowCSM]       = useState(false);
  const [slaInfo, setSlaInfo]       = useState<SLAInfo | null>(null);
  const [ictmsStaff, setIctmsStaff] = useState<User[]>([]);


  const [showOnHoldBox, setShowOnHoldBox] = useState(false);
  const [onHoldReason,  setOnHoldReason]  = useState('');

  // Role checks
  const isRequestorView =
    forceRequestorView || user?.role === 'dswd_staff';

  const isDswdStaff = isRequestorView;
  const isTicketRequestor = Boolean(
    ticket?.empno && user?.empno && String(ticket.empno) === String(user.empno)
  );

  const isIctmsOrAdmin =
    !isRequestorView &&
    (user?.role === 'ictms_staff' || user?.role === 'super_admin');
  const isServiceAdmin = user?.role !== 'super_admin' && (user?.area_admin_service_ids?.length ?? 0) > 0;
  const canAssignTickets = isIctmsOrAdmin || isServiceAdmin;

  const isTerminal =
    ticket?.status === 'Closed' || ticket?.status === 'Cancelled';
  // DSWD cancel states
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling]               = useState(false);

  // ICTMS assign states
  const [assignTo, setAssignTo]   = useState('');
  const [assigning, setAssigning] = useState(false);

  // ICTMS status states
  const [updatingStatus, setUpdatingStatus]     = useState(false);
  const [cancelReason, setCancelReason]         = useState('');
  const [showCancelReason, setShowCancelReason] = useState(false);

  const [showResolutionBox, setShowResolutionBox] = useState(false);
  const [resolutionDetails, setResolutionDetails] = useState('');

  // Reclassify states
  const [showReclassify, setShowReclassify]         = useState(false);
  const [reclassifying, setReclassifying]           = useState(false);
  const [reclassifyReason, setReclassifyReason]     = useState('');
  const [categories, setCategories]                 = useState<Category[]>([]);
  const [subCategories, setSubCategories]           = useState<SubCategory[]>([]);
  const [subItems, setSubItems]                     = useState<SubItem[]>([]);
  const [newCategoryId, setNewCategoryId]           = useState('');
  const [newSubCategoryId, setNewSubCategoryId]     = useState('');
  const [newSubItemId, setNewSubItemId]             = useState('');
  const [newPriority, setNewPriority]               = useState('');

  const [coAssignees,    setCoAssignees]    = useState<CoAssignee[]>([]);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [viewingAttachment, setViewingAttachment] = useState<TicketAttachment | null>(null);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState('');
  const [addingCoAssign, setAddingCoAssign] = useState(false);
  const [coAssignTo,     setCoAssignTo]     = useState('');

  useEffect(() => {
    if (ticket) {
      fetchComments();
      fetchCoAssignees();
      fetchSLA();
      fetchAttachments();
      if (canAssignTickets) {
        fetchIctmsStaff();
      }
      if (isIctmsOrAdmin) {
        fetchCategories();
      }
    }
  }, [ticket?.id, ticket?.service_area_id, canAssignTickets, isIctmsOrAdmin]);

  // Show the current assignee when the staff options finish loading.
  useEffect(() => {
    const currentStaff = ictmsStaff.find(staff => staff.full_name === ticket?.assigned_to);
    setAssignTo(currentStaff ? String(currentStaff.id) : '');
  }, [ticket?.id, ticket?.assigned_to, ictmsStaff]);

  // Load sub-categories when category changes
  useEffect(() => {
    if (newCategoryId) {
      api.get(`/categories/${newCategoryId}/subs`)
        .then(res => setSubCategories(res.data))
        .catch(() => setSubCategories([]));
      setNewSubCategoryId('');
      setNewSubItemId('');
      setSubItems([]);
    } else {
      setSubCategories([]);
      setSubItems([]);
    }
  }, [newCategoryId]);

  // Load sub-items when sub-category changes
  useEffect(() => {
    if (newSubCategoryId) {
      api.get(`/categories/subs/${newSubCategoryId}/items`)
        .then(res => setSubItems(res.data))
        .catch(() => setSubItems([]));
      setNewSubItemId('');
    } else {
      setSubItems([]);
    }
  }, [newSubCategoryId]);

  async function fetchComments() {
    if (!ticket) return;
    try {
      const res = await api.get(`/tickets/${ticket.id}/comments`);
      console.log('Comments response:', res.data);  // ✅ add this
      setComments(res.data);
    } catch (err: any) {
      console.error('fetchComments error:', err.response?.data); // ✅ add this
    }
  }

  async function fetchCoAssignees() {
    if (!ticket) return;
    try {
      const res = await api.get(`/tickets/${ticket.id}/assignees`);
      setCoAssignees(res.data);
    } catch {
      // ignore failures silently for now
    }
  }

  async function fetchSLA() {
    if (!ticket) return;
    try {
      const res = await api.get(`/tickets/${ticket.id}/sla`);
      if (res.data.sla_priority) setSlaInfo(res.data);
      else setSlaInfo(null);
    } catch { setSlaInfo(null); }
  }

  async function fetchAttachments() {
    if (!ticket) return;
    try {
      const res = await api.get(`/tickets/${ticket.id}/attachments`);
      setAttachments(res.data);
    } catch { setAttachments([]); }
  }

  async function openAttachment(file: TicketAttachment) {
    try {
      const response = await api.get(`/tickets/${ticket!.id}/attachments/${file.id}/content`, { responseType: 'blob' });
      if (attachmentPreviewUrl) URL.revokeObjectURL(attachmentPreviewUrl);
      setAttachmentPreviewUrl(URL.createObjectURL(response.data));
      setViewingAttachment(file);
    } catch {
      showErrorToast('Unable to load this attachment preview.');
    }
  }

  function closeAttachmentPreview() {
    if (attachmentPreviewUrl) URL.revokeObjectURL(attachmentPreviewUrl);
    setAttachmentPreviewUrl('');
    setViewingAttachment(null);
  }

  async function fetchIctmsStaff() {
    if (!ticket?.service_area_id) {
      setIctmsStaff([]);
      return;
    }
    try {
      const res = await api.get('/users/assignable-staff', {
        params: { service_area_id: ticket.service_area_id },
      });
      setIctmsStaff(res.data);
    } catch {
      setIctmsStaff([]);
    }
  }

  async function fetchCategories() {
    try {
      const res = await api.get('/categories');
      setCategories(res.data);
    } catch { }
  }

  async function handlePostComment() {
    if (posting || !newComment.trim() || !ticket || !user) return;

    // ADD THIS — check what empno value actually is at post time
    console.log('user object:', user);
    console.log('empno being sent:', user?.empno);

    setPosting(true);
    const postingStartedAt = Date.now();
    try {
      await api.post(`/tickets/${ticket.id}/comments`, {
        ticket_id: ticket.id,
        empno:     user?.empno,
        content:   newComment.trim(),
      });
      const feedbackDelay = Math.max(0, 600 - (Date.now() - postingStartedAt));
      if (feedbackDelay > 0) await new Promise(resolve => setTimeout(resolve, feedbackDelay));
      setNewComment('');
      fetchComments();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to post comment.';
      console.error('Comment error:', err.response?.data);
      showErrorToast(msg);
    } finally {
      const remainingDelay = Math.max(0, 600 - (Date.now() - postingStartedAt));
      if (remainingDelay > 0) await new Promise(resolve => setTimeout(resolve, remainingDelay));
      setPosting(false);
    }
  }

  async function handleDswdCancel() {
    if (!ticket) return;
    setCancelling(true);
    try {
      await api.patch(`/tickets/${ticket.id}/cancel`);
      showToast('Ticket cancelled.');
      setTimeout(() => { onResolved(); onClose(); }, 1500);
    } catch (err: any) {
      showErrorToast(err.response?.data?.error || 'Failed to cancel.');
    } finally { setCancelling(false); setShowCancelConfirm(false); }
  }

  async function handleAssign() {
    if (!assignTo || !ticket) return;
    setAssigning(true);
    try {
      const isReassign    = !!ticket.assigned_to;
      const selectedStaff = ictmsStaff.find(s => s.id === Number(assignTo));

      await api.patch(`/tickets/${ticket.id}/assign`, {
        assigned_to:   Number(assignTo),
        empno:         user?.empno,
        assigner_name: user?.full_name,
      });

      fetchComments();
      //onResolved();
      setAssignTo('');

      // ✅ Show success box
      setAssignedName(selectedStaff?.full_name ?? ticket.assigned_to ?? 'Unassigned');
      assignmentChanged.current = true;
      fetchCoAssignees();
      fetchSLA();
      notifySuccess({
        keepOpen: true,
        icon:    isReassign ? '🔄' : '👤',
        title:   isReassign ? 'Ticket Reassigned' : 'Ticket Assigned',
        message: isReassign
          ? `Ticket ${ticket.ticket_number} has been successfully reassigned to ${selectedStaff?.full_name ?? 'the selected staff'}.`
          : `Ticket ${ticket.ticket_number} has been successfully assigned to ${selectedStaff?.full_name ?? 'the selected staff'}.`,
      });
    } catch (err: any) {
      showErrorToast(err.response?.data?.error || 'Failed to assign.');
    } finally {
      setAssigning(false);
    }
  }

  async function handleStatusUpdate(status: string) {
    if (!ticket) return;

    // Resolved → show resolution input box
    if (status === 'Resolved') {
      setShowResolutionBox(true);
      return;
    }

    // Cancelled → show cancel reason box
    if (status === 'Cancelled') {
      setShowCancelReason(true);
      return;
    }

    // On-Hold → show on-hold reason box
    if (status === 'On-Hold') {
      setShowOnHoldBox(true);
      return;
    }

    // In Progress → call API then show success box
    if (status === 'In Progress') {
      setUpdatingStatus(true);
      try {
        await api.patch(`/tickets/${ticket.id}/status`, {
          status,
          empno:     user?.empno,
          user_name: user?.full_name,
        });
        fetchComments();
        // ✅ Show In Progress success box
        notifySuccess({
          icon:    '🔧',
          color:   '#5B21B6',
          title:   'Ticket In Progress',
          message: `Ticket ${ticket.ticket_number} is now tagged as In Progress. The requestor has been notified.`,
        });
      } catch (err: any) {
        showErrorToast(err.response?.data?.error || 'Failed to update status.');
      } finally { setUpdatingStatus(false); }
      return;
    }
  }

    async function handleOnHold() {
    if (!onHoldReason.trim()) { showErrorToast('Please provide a reason.'); return; }
    setUpdatingStatus(true);
    try {
      await api.patch(`/tickets/${ticket!.id}/status`, {
        status:        'On-Hold',
        cancel_reason: onHoldReason,
        empno:         user?.empno,
        user_name:     user?.full_name,
      });
      fetchComments();
      setShowOnHoldBox(false);
      setOnHoldReason('');

      // ✅ Show On-Hold success box
      notifySuccess({
        icon:    '⏸',
        color:   '#CC7700',
        title:   'Ticket On-Hold',
        message: `Ticket ${ticket!.ticket_number} has been placed on hold. The requestor has been informed.`,
      });
    } catch (err: any) {
      showErrorToast(err.response?.data?.error || 'Failed to put ticket on hold.');
    } finally { setUpdatingStatus(false); }
  }

  async function handleIctmsCancel() {
    if (!cancelReason.trim()) { showErrorToast('Please provide a reason.'); return; }
    setUpdatingStatus(true);
    try {
      await api.patch(`/tickets/${ticket!.id}/status`, {
        status:        'Cancelled',
        cancel_reason: cancelReason,
        empno:         user?.empno,
        user_name:     user?.full_name,
      });
      setShowCancelReason(false);
      fetchComments();

      // ✅ Show Cancelled success box
      notifySuccess({
        icon:    '❌',
        color:   '#8B1A1A',
        title:   'Ticket Cancelled',
        message: `Ticket ${ticket!.ticket_number} has been cancelled. The requestor has been notified.`,
      });
    } catch (err: any) {
      showErrorToast(err.response?.data?.error || 'Failed to cancel.');
    } finally { setUpdatingStatus(false); }
  }

  async function handleResolveTicket() {
    if (!resolutionDetails.trim()) {
      showErrorToast('Please provide resolution details.');
      return;
    }
    setUpdatingStatus(true);
    try {
      await api.patch(`/tickets/${ticket!.id}/status`, {
        status:             'Resolved',
        empno:              user?.empno,
        user_name:          user?.full_name,
        resolution_details: resolutionDetails,
      });
      setShowResolutionBox(false);
      setResolutionDetails('');
      fetchComments();

      // ✅ Show Resolved success box
      notifySuccess({
        icon:    '✅',
        color:   '#1B6B3A',
        title:   'Ticket Resolved',
        message: `Ticket ${ticket!.ticket_number} has been marked as Resolved. The requestor has been notified and asked to fill out the CSMF.`,
      });
    } catch (err: any) {
      showErrorToast(err.response?.data?.error || 'Failed to resolve ticket.');
    } finally { setUpdatingStatus(false); }
  }

  async function handleReclassify() {
    if (!reclassifyReason.trim() || !ticket) return;
    setReclassifying(true);
    try {
      await api.patch(`/tickets/${ticket.id}/reclassify`, {
        category_id:     newCategoryId    || null,
        sub_category_id: newSubCategoryId || null,
        sub_item_id:     newSubItemId     || null,
        priority:        newPriority      || null,
        reason:          reclassifyReason,
        empno:           user?.empno,
        user_name:       user?.full_name,
      });

      setShowReclassify(false);
      setReclassifyReason('');
      setNewCategoryId('');
      setNewSubCategoryId('');
      setNewSubItemId('');
      setNewPriority('');
      fetchComments();
      //onResolved();

      // ✅ Show success box
      notifySuccess({
        icon:    '📋',
        title:   'Ticket Reclassified',
        message: `Ticket ${ticket.ticket_number} has been successfully reclassified. All changes have been logged in the comments.`,
      });
    } catch (err: any) {
      showErrorToast(err.response?.data?.error || 'Failed to reclassify.');
    } finally { setReclassifying(false); }
  }

  function showToast(msg: string) {
    toast.success(msg);
  }
  function notifySuccess({ title, message, keepOpen = false }: { title: string; message: string; icon?: string; color?: string; keepOpen?: boolean }) {
    toast.success(<div><strong style={{ display: 'block', marginBottom: 3 }}>{title}</strong><span>{message}</span></div>);
    if (!keepOpen) { onResolved(); onClose(); }
  }

  function getInitials(name: string) {
    return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '??';
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString('en-PH', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function getAvailableStatuses(): string[] {
    if (!ticket) return [];
    switch (ticket.status) {
      case 'Assigned':    return ['In Progress', 'On-Hold', 'Resolved', 'Cancelled'];
      case 'In Progress': return ['On-Hold', 'Resolved', 'Cancelled'];
      case 'On-Hold':     return ['In Progress', 'Resolved', 'Cancelled'];
      default:            return [];
    }
  }

  const statusColors: Record<string, { bg: string; color: string }> = {
    'In Progress': { bg: '#E8F5EE', color: '#1B6B3A' },
    'On-Hold':     { bg: '#FDF5DC', color: '#854F0B' },
    'Resolved':    { bg: '#E8F5EE', color: '#181088' },
    'Cancelled':   { bg: '#FDE8E8', color: '#8B1A1A' },
  };

  // Is comment a system reclassification entry?
  function isSystemComment(content: string): boolean {
    return content.startsWith('[ASSIGNED]')     ||
          content.startsWith('[REASSIGNED]')   ||
          content.startsWith('[RECLASSIFIED]') ||
          content.startsWith('[STATUS]')       ||
          content.startsWith('[RESOLVED]');
  }
  function getSystemCommentStyle(content: string) {

  if (content.startsWith('[RESOLVED]')) {
    return {
      bg: '#E8F5EE',
      border: '#B7DFC8',
      text: '#1B6B3A',
      iconBg: '#D4F2E1',
      icon: '✅',
      title: 'System — Resolution',
    };
  }

  if (content.startsWith('[RECLASSIFIED]')) {
    return {
      bg: '#F3F0FF',
      border: '#AFA9EC',
      text: '#534AB7',
      iconBg: '#E4E0FF',
      icon: '🔀',
      title: 'System — Reclassification',
    };
  }

  if (content.startsWith('[ASSIGNED]')) {
    return {
      bg: '#E8F1FA',
      border: '#B5D4F4',
      text: '#0D3B6E',
      iconBg: '#D6E8FA',
      icon: '👤',
      title: 'System — Assignment',
    };
  }

  if (content.startsWith('[REASSIGNED]')) {
    return {
      bg: '#FEF3DC',
      border: '#F3D08A',
      text: '#CC7700',
      iconBg: '#FCE8BB',
      icon: '🔄',
      title: 'System — Reassignment',
    };
  }

  if (content.startsWith('[STATUS]')) {
    return {
      bg: '#FDE8E8',
      border: '#F5C0C0',
      text: '#8B1A1A',
      iconBg: '#FFDCDC',
      icon: '📌',
      title: 'System — Status Update',
    };
  }

  return {
    bg: '#F5F8FC',
    border: '#D0D9E4',
    text: '#4A4A4A',
    iconBg: '#E8F1FA',
    icon: '⚙️',
    title: 'System',
  };
}

  if (!ticket) return null;

  return (
    <>
      <div className={`ticket-sheet-backdrop ${closing ? "ticket-sheet-closing" : ""}`} onClick={closeSheet} style={{ position: 'fixed', inset: 0,
          background: 'rgba(0,0,20,0.5)',
          zIndex: 100, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div
          ref={sheetRef}
          className={`ticket-sheet ${expanded ? 'ticket-sheet-expanded' : ''} ${showReclassify ? 'ticket-sheet-reclassifying' : ''}`}
          role="dialog" aria-modal="true" aria-labelledby="ticket-sheet-heading" tabIndex={-1}
          onKeyDown={event => {
            if (event.key === 'Escape') { event.stopPropagation(); if (showReclassify) setShowReclassify(false); else closeSheet(); }
            if (event.key === 'Tab') {
              const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')).filter(item => item.getClientRects().length > 0 && !item.closest('[inert]'));
              const first = items[0]; const last = items[items.length - 1];
              if (!first) { event.preventDefault(); return; }
              if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last.focus(); }
              else if (!event.shiftKey && (document.activeElement === last || document.activeElement === event.currentTarget)) { event.preventDefault(); first.focus(); }
            }
          }}
          onClick={e => e.stopPropagation()}
          style={{
            background: '#fff', width: 680,
            maxWidth: '95vw', maxHeight: '92vh',
            overflowY: 'auto', borderRadius: 10,
            border: '0.5px solid #C0C8D4',
          }}
        >
          <aside id="ticket-reclassify-pane" className="ticket-reclassify-pane" aria-label="Reclassify ticket" inert={!showReclassify}>
            <div className="ticket-reclassify-header"><h3><Shuffle size={16} />Reclassify Ticket</h3><button type="button" aria-label="Close reclassification" onClick={() => setShowReclassify(false)}><X size={18} /></button></div>
            <p className="ticket-reclassify-help">Update the classification and add a reason for the activity record.</p>
                  <div className="ticket-reclassify-form" style={{
                    background: '#F3F0FF', borderRadius: 6,
                    padding: 14, border: '0.5px solid #AFA9EC',
                  }}>


                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr',
                      gap: 10, marginBottom: 10,
                    }}>
                      {/* New Priority */}
                      <div>
                        <label style={{
                          fontSize: 'var(--text-xs)', fontWeight: 500, color: '#5A6475',
                          textTransform: 'uppercase', letterSpacing: 0.4,
                          display: 'block', marginBottom: 4,
                        }}>
                          New Priority
                          <span style={{ color: '#888', fontWeight: 400, marginLeft: 4 }}>
                            (current: {ticket.priority})
                          </span>
                        </label>
                        <select
                          value={newPriority}
                          onChange={e => setNewPriority(e.target.value)}
                          style={inputStyle}
                        >
                          <option value="">— Keep current —</option>
                          {['Critical','High','Medium','Low'].map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>

                      {/* New Category */}
                      <div>
                        <label style={{
                          fontSize: 'var(--text-xs)', fontWeight: 500, color: '#5A6475',
                          textTransform: 'uppercase', letterSpacing: 0.4,
                          display: 'block', marginBottom: 4,
                        }}>
                          New Category
                          <span style={{ color: '#888', fontWeight: 400, marginLeft: 4 }}>
                            (current: {ticket.category})
                          </span>
                        </label>
                        <select
                          value={newCategoryId}
                          onChange={e => setNewCategoryId(e.target.value)}
                          style={inputStyle}
                        >
                          <option value="">— Keep current —</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Sub-Category */}
                      {(newCategoryId || ticket.sub_category) && (
                        <div>
                          <label style={{
                            fontSize: 'var(--text-xs)', fontWeight: 500, color: '#5A6475',
                            textTransform: 'uppercase', letterSpacing: 0.4,
                            display: 'block', marginBottom: 4,
                          }}>
                            New Sub-Category
                            <span style={{ color: '#888', fontWeight: 400, marginLeft: 4 }}>
                              (current: {ticket.sub_category || 'None'})
                            </span>
                          </label>
                          <select
                            value={newSubCategoryId}
                            onChange={e => setNewSubCategoryId(e.target.value)}
                            style={inputStyle}
                            disabled={!newCategoryId && subCategories.length === 0}
                          >
                            <option value="">— Keep current / None —</option>
                            {subCategories.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Sub-Item */}
                      {(newSubCategoryId || ticket.sub_item) && (
                        <div>
                          <label style={{
                            fontSize: 'var(--text-xs)', fontWeight: 500, color: '#5A6475',
                            textTransform: 'uppercase', letterSpacing: 0.4,
                            display: 'block', marginBottom: 4,
                          }}>
                            New Sub-Item
                            <span style={{ color: '#888', fontWeight: 400, marginLeft: 4 }}>
                              (current: {ticket.sub_item || 'None'})
                            </span>
                          </label>
                          <select
                            value={newSubItemId}
                            onChange={e => setNewSubItemId(e.target.value)}
                            style={inputStyle}
                            disabled={!newSubCategoryId && subItems.length === 0}
                          >
                            <option value="">— Keep current / None —</option>
                            {subItems.map(i => (
                              <option key={i.id} value={i.id}>{i.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Reason — full width */}
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{
                          fontSize: 'var(--text-xs)', fontWeight: 500, color: '#5A6475',
                          textTransform: 'uppercase', letterSpacing: 0.4,
                          display: 'block', marginBottom: 4,
                        }}>
                          Reason for Reclassification <span style={{ color: '#8B1A1A' }}>*</span>
                        </label>
                        <textarea
                          value={reclassifyReason}
                          onChange={e => setReclassifyReason(e.target.value)}
                          placeholder="Explain why this ticket needs to be reclassified..."
                          rows={2}
                          style={{ ...inputStyle, resize: 'vertical' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => {
                          setShowReclassify(false);
                          setReclassifyReason('');
                          setNewCategoryId('');
                          setNewSubCategoryId('');
                          setNewSubItemId('');
                          setNewPriority('');
                        }}
                        style={{
                          padding: '5px 12px', fontSize: 'var(--text-xs)',
                          border: '1px solid #AFA9EC', borderRadius: 4,
                          background: '#fff', cursor: 'pointer', color: '#534AB7',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleReclassify}
                        disabled={reclassifying || !reclassifyReason.trim()}
                        style={{
                          padding: '5px 14px', fontSize: 'var(--text-xs)',
                          background: reclassifying ? '#888' : '#534AB7',
                          color: '#fff', border: 'none',
                          borderRadius: 4, cursor: reclassifying ? 'not-allowed' : 'pointer',
                          fontWeight: 500,
                        }}
                      >
                        {reclassifying ? 'Reclassifying...' : <><Save size={14} /> Save Reclassification</>}
                      </button>
                    </div>
                  </div>
          </aside>
          <header className="ticket-sheet-header">
            <div className="ticket-sheet-heading"><span><TicketIcon size={18} /></span><h2 id="ticket-sheet-heading">{expanded ? 'Ticket Details' : 'Ticket Preview'}</h2></div>
            <div className="ticket-sheet-header-actions"><button className="ticket-sheet-expand" onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}{expanded ? 'Compact View' : 'View Full Details'}</button><button className="ticket-sheet-close" onClick={closeSheet} aria-label="Close ticket"><X size={20} /></button></div>
          </header>
          <div className="ticket-sheet-body" style={{ padding: 20 }}>
            <section className="ticket-sheet-summary" aria-label="Ticket summary">
              <div className="ticket-sheet-title"><strong>{ticket.ticket_number}</strong><h3>{ticket.subject}</h3><StatusBadge status={ticket.status} /></div>
              <div className="ticket-sheet-summary-grid">
                <div><span>Ticket Category</span><strong>{ticket.category || 'Uncategorized'}</strong></div>
                <div><span>Priority</span><PriorityBadge priority={ticket.priority} /></div>
                <div><span>Assigned to</span><strong>{ticket.assigned_to || 'Unassigned'}</strong></div>
              </div>
            </section>
            {slaInfo && !isTerminal && <div className="ticket-sheet-due-grid">
              <div><span>First Response Due</span><strong>{formatDate(new Date(new Date(slaInfo.created_at || ticket.created_at).getTime() + slaInfo.sla_response_hours * 3600000).toISOString())}</strong></div>
              <div><span>Resolution Due</span><strong>{slaInfo.assigned_at ? formatDate(new Date(new Date(slaInfo.assigned_at).getTime() + slaInfo.sla_resolution_hours * 3600000 + Number(slaInfo.total_hold_seconds || 0) * 1000).toISOString()) : 'Awaiting assignment'}</strong></div>
            </div>}



            <h4 className="ticket-sheet-section-title">Ticket Details</h4>
            {/* META GRID */}
            <div className="ticket-sheet-meta" style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: 8, marginBottom: 14,
            }}>
              {[
                { label: 'Status',       value: <StatusBadge status={ticket.status} /> },
                { label: 'Priority',     value: <PriorityBadge priority={ticket.priority} /> },
                { label: 'Category',     value: ticket.category },
                { label: 'Sub-Category', value: ticket.sub_category || '—' },
                { label: 'Sub-Item',     value: ticket.sub_item || '—' },
                { label: 'Requestor',    value: ticket.requestor },
                { label: 'Office Location', value: ticket.office_location || 'Not recorded' },
                { label: 'Division / Unit', value: [ticket.division, ticket.unit].filter(Boolean).join(' / ') || 'Not recorded' },
                { label: 'Assigned To',  value: ticket.assigned_to || 'Unassigned' },
                { label: 'Date Filed',   value: new Date(ticket.created_at).toLocaleDateString() },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  background: '#F5F8FC', borderRadius: 4, padding: '8px 10px',
                }}>
                  <div style={{
                    fontSize: 'var(--text-xs)', color: '#6A7280',
                    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2,
                  }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: '#1A1A1A', fontWeight: 500 }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* CANCELLATION REASON */}
            {ticket.status === 'Cancelled' && ticket.cancel_reason && (
              <div style={{
                background: '#FDE8E8', borderRadius: 4,
                padding: '8px 12px', marginBottom: 14,
                fontSize: 'var(--text-xs)', color: '#8B1A1A',
              }}>
                <strong>Cancellation Reason:</strong> {ticket.cancel_reason}
              </div>
            )}

            <section className="ticket-sheet-controls" aria-label="Ticket management">
            {/* ── ICTMS ASSIGN / RE-ASSIGN ── */}
            {canAssignTickets && !isTerminal &&
              ['Open','Assigned','In Progress','On-Hold'].includes(ticket.status) && (
              <div className="ticket-sheet-assignment" style={{
                background: ticket.status === 'Open' ? '#E8F1FA' : '#F5F8FC',
                borderRadius: 6, padding: 12, marginBottom: 12,
                border: `0.5px solid ${ticket.status === 'Open' ? '#B5D4F4' : '#D0D9E4'}`,
              }}>
                <p style={{
                  fontSize: 'var(--text-xs)', fontWeight: 500,
                  color: ticket.status === 'Open' ? '#0D3B6E' : '#4A4A4A',
                  marginBottom: 8,
                }}>
                  <UserPlus size={14} /> {ticket.status === 'Open' ? 'Assign to' : 'Reassign to'}
                </p>
                <div style={{ fontSize: 'var(--text-xs)', color: '#52657A', marginBottom: 8 }}>
                  Service area: <strong>{ticket.service_area_code || 'Not assigned'}</strong>
                  {ticket.service_area_name ? ` — ${ticket.service_area_name}` : ''}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select aria-label="Assign ticket to staff"
                    value={assignTo}
                    onChange={e => setAssignTo(e.target.value)}
                    disabled={!ticket.service_area_id}
                    style={inputStyle}
                  >
                    <option value="">{ticket.assigned_to && !ictmsStaff.some(staff => staff.full_name === ticket.assigned_to) ? `${ticket.assigned_to} (current assignee)` : 'Select staff'}</option>
                    {ictmsStaff
                      .filter(s => s.empno !== ticket?.empno)
                      .map(s => (
                        <option key={s.id} value={s.id}>
                          {s.full_name}
                        </option>
                      ))
                    }
                  </select>
                  <button
                    onClick={handleAssign}
                    disabled={!assignTo || assigning}
                    style={{
                      padding: '6px 14px', fontSize: 'var(--text-sm)',
                      background: !assignTo ? '#C8D0DC' : 'var(--gov-navy)',
                      color: '#fff', border: 'none', borderRadius: 4,
                      cursor: !assignTo ? 'not-allowed' : 'pointer', fontWeight: 500,
                    }}
                  >
                    {assigning ? 'Saving...' : ticket.status === 'Open' ? <><Plus size={14} /> Assign</> : <><Undo2 size={14} /> Reassign</>}
                  </button>
                </div>
              </div>
            )}

            {/* CO-ASSIGNEES SECTION */}
            {canAssignTickets && (
              <div className="ticket-sheet-technicians" style={{
                background: '#F8FAFC', border: '0.5px solid #D0D9E4',
                borderRadius: 6, padding: 14, marginBottom: 12,
              }}>
                <div style={{
                  fontSize: 'var(--text-xs)', fontWeight: 600, color: '#5A6475',
                  textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10,
                }}>
                  <Users size={14} /> Assigned Technicians
                </div>

                {/* List of current assignees */}
                <div style={{ marginBottom: 10 }}>
                  {coAssignees.length === 0 ? (
                    <div style={{ fontSize: 'var(--text-xs)', color: '#aaa', fontStyle: 'italic' }}>
                      No technicians assigned yet.
                    </div>
                  ) : coAssignees.map(a => (
                    <div key={a.id} style={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 0', borderBottom: '0.5px solid #EEF1F5',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: a.role === 'primary' ? 'var(--gov-navy)' : '#E8F1FA',
                          color:      a.role === 'primary' ? '#fff' : 'var(--gov-navy)',
                          display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: 'var(--text-xs)', fontWeight: 700,
                        }}>
                          {a.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: '#1A2A3A' }}>
                            {a.full_name}
                          </div>
                          <div style={{ fontSize: 'var(--text-xs)', color: '#888' }}>
                            <span style={{
                              background: a.role === 'primary' ? '#E8F1FA' : '#E8F5EE',
                              color:      a.role === 'primary' ? '#0D3B6E' : '#1B6B3A',
                              padding: '1px 6px', borderRadius: 3, fontSize: 'var(--text-xs)',
                              fontWeight: 600, marginRight: 5,
                            }}>
                              {a.role === 'primary' ? 'Primary' : 'Co-Assignee'}
                            </span>
                            Since {new Date(a.assigned_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {/* Remove button — only for co-assignees */}
                      {a.role === 'co-assignee' && (
                        <button
                          onClick={async () => {
                            await api.delete(
                              `/tickets/${ticket!.id}/assignees/${a.user_id}`,
                              { data: { removed_by: user?.empno, remover_name: user?.full_name } }
                            );
                            fetchCoAssignees();
                            fetchComments();
                          }}
                          disabled={isTerminal}
                          style={{
                            background: 'none', border: `1px solid ${isTerminal ? '#D0D9E4' : '#FDE8E8'}`,
                            color: isTerminal ? '#888' : '#8B1A1A', fontSize: 'var(--text-xs)', padding: '3px 8px',
                            borderRadius: 4, cursor: isTerminal ? 'not-allowed' : 'pointer',
                            opacity: isTerminal ? 0.5 : 1,
                          }}
                        >
                          {isTerminal ? 'Cannot Remove' : 'Remove'}
                        </button>
                      )}
                                          </div>
                  ))}
                </div>

                {/* Add co-assignee — DISABLED when ticket is closed/cancelled */}
                {!isTerminal ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select aria-label="Add co-assignee"
                      value={coAssignTo}
                      onChange={e => setCoAssignTo(e.target.value)}
                      disabled={!ticket.service_area_id}
                      style={{
                        flex: 1, padding: '5px 9px', fontSize: 'var(--text-xs)',
                        border: '1px solid #C8D0DC', borderRadius: 4, background: '#fff',
                      }}
                    >
                      <option value="">— Add co-assignee —</option>
                      {ictmsStaff
                        .filter(s =>
                          s.empno !== ticket?.empno &&                              // not requestor
                          !coAssignees.some(a => a.user_id === s.id) &&            // not already co-assigned
                          s.full_name !== ticket?.assigned_to                       // not the primary assignee
                        )
                        .map(s => (
                          <option key={s.id} value={s.id}>{s.full_name}</option>
                        ))
                      }
                    </select>
                    <button
                      onClick={async () => {
                        if (!coAssignTo) return;
                        setAddingCoAssign(true);
                        try {
                          const staff = ictmsStaff.find(s => s.id === Number(coAssignTo));
                          await api.post(`/tickets/${ticket!.id}/assignees`, {
                            user_id:           Number(coAssignTo),
                            empno:             staff?.empno,
                            full_name:         staff?.full_name,
                            assigned_by_empno: user?.empno,
                            assigner_name:     user?.full_name,
                          });
                          setCoAssignTo('');
                          fetchCoAssignees();
                          fetchComments();
                        } catch (err: any) {
                          showErrorToast(err.response?.data?.error || 'Failed to add co-assignee.');
                        } finally { setAddingCoAssign(false); }
                      }}
                      disabled={!coAssignTo || addingCoAssign}
                      style={{
                        padding: '5px 14px', fontSize: 'var(--text-xs)',
                        background: !coAssignTo ? '#C8D0DC' : '#1A5490',
                        color: '#fff', border: 'none', borderRadius: 4,
                        cursor: !coAssignTo ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {addingCoAssign ? '...' : '+ Add'}
                    </button>
                  </div>
                ) : (
                  <div style={{
                    padding: '8px 12px', background: '#F5F8FC',
                    borderRadius: 4, fontSize: 'var(--text-xs)', color: '#888',
                    textAlign: 'center', border: '0.5px solid #D0D9E4',
                  }}>
                    ✓ This ticket is {ticket?.status.toLowerCase()}. No more team members can be added.
                  </div>
                )}
              </div>
            )}

            {/* ── ICTMS STATUS UPDATE ── */}
            {isIctmsOrAdmin && !isTerminal && !showCancelReason &&
              getAvailableStatuses().length > 0 && (
              <div className="ticket-sheet-status-control">
                <div className="ticket-sheet-status-heading"><label htmlFor="ticket-status-change"><CircleDot size={14} />Change Status</label><StatusBadge status={ticket.status} /></div>
                <div className="ticket-sheet-status-field"><select id="ticket-status-change" value="" disabled={updatingStatus} onChange={event => { if (event.target.value) handleStatusUpdate(event.target.value); }}>
                  <option value="" disabled>{updatingStatus ? 'Updating status...' : 'Select new status'}</option>
                  {getAvailableStatuses().map(status => <option key={status} value={status}>{status}</option>)}
                </select><ChevronRight size={14} aria-hidden="true" /></div>
              </div>
            )}

            {/* ── ICTMS CANCEL WITH REASON ── */}
            {showCancelReason && (
              <div style={{
                background: '#FDE8E8', borderRadius: 6,
                padding: 12, marginBottom: 12,
                border: '0.5px solid #F5C0C0',
              }}>
                <p style={{ fontSize: 'var(--text-xs)', color: '#8B1A1A', fontWeight: 500, marginBottom: 8 }}>
                  Reason for cancellation (required):
                </p>
                <textarea
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="Explain why this ticket is being cancelled..."
                  rows={3}
                  style={{
                    ...inputStyle, resize: 'vertical',
                    border: '1px solid #F5C0C0', marginBottom: 8,
                  }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { setShowCancelReason(false); setCancelReason(''); }}
                    style={{
                      padding: '5px 12px', fontSize: 'var(--text-xs)',
                      border: '1px solid #C8D0DC', borderRadius: 4,
                      background: '#fff', cursor: 'pointer',
                    }}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleIctmsCancel}
                    disabled={updatingStatus || !cancelReason.trim()}
                    style={{
                      padding: '5px 14px', fontSize: 'var(--text-xs)',
                      background: '#8B1A1A', color: '#fff',
                      border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500,
                    }}
                  >
                    {updatingStatus ? 'Cancelling...' : 'Confirm Cancel'}
                  </button>
                </div>
              </div>
            )}
             {/* ── Resolution  ── */}
            {showResolutionBox && (
            <div style={{
              background: '#E8F5EE',
              borderRadius: 6,
              padding: 12,
              marginBottom: 12,
              border: '0.5px solid #B7DFC8',
            }}>

              <p style={{
                fontSize: 'var(--text-xs)',
                color: '#1B6B3A',
                fontWeight: 500,
                marginBottom: 8,
              }}>
                Resolution Details (required):
              </p>

              <textarea
                value={resolutionDetails}
                onChange={e => setResolutionDetails(e.target.value)}
                placeholder="Describe the resolution provided to the requestor..."
                rows={4}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  marginBottom: 8,
                }}
              />

              <div style={{ display: 'flex', gap: 8 }}>

                <button
                  onClick={() => {
                    setShowResolutionBox(false);
                    setResolutionDetails('');
                  }}
                  style={{
                    padding: '5px 12px',
                    fontSize: 'var(--text-xs)',
                    border: '1px solid #C8D0DC',
                    borderRadius: 4,
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>

                <button
                  onClick={handleResolveTicket}
                  disabled={updatingStatus || !resolutionDetails.trim()}
                  style={{
                    padding: '5px 14px',
                    fontSize: 'var(--text-xs)',
                    background: 'var(--gov-green)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {updatingStatus ? 'Resolving...' : '✓ Confirm Resolution'}
                </button>

              </div>
            </div>
          )}

            {/* ── ICTMS RECLASSIFY ── */}
            {isIctmsOrAdmin && !isTerminal && ticket.status !== 'Resolved' && (
              <div style={{ marginBottom: 12 }}>
                <button className="ticket-sheet-reclassify-trigger" aria-expanded={showReclassify} aria-controls="ticket-reclassify-pane" onClick={() => setShowReclassify(value => !value)}><Shuffle size={14} /> Reclassify Ticket</button>
              </div>
            )}

            </section>

            {/* DESCRIPTION */}
            <div className="ticket-sheet-section-title" style={{
              fontSize: 'var(--text-xs)', fontWeight: 500, color: '#6A7280',
              textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6,
            }}>
              Description
            </div>
            <div style={{
              background: '#F5F8FC', borderRadius: 4,
              padding: 12, marginBottom: 16,
            }}>
              <p style={{ fontSize: 'var(--text-sm)', color: '#2A2A2A', lineHeight: 1.6 }}>
                {ticket.description || 'No description provided.'}
              </p>
            </div>

            {attachments.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: '#6A7280', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
                  Attachments
                </div>
                <div style={{ background: '#F5F8FC', borderRadius: 4, padding: 10 }}>
                  {attachments.map(file => (
                    <div key={file.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: '5px 2px', fontSize: 'var(--text-sm)' }}>
                      <span style={{ overflowWrap: 'anywhere' }}>📎 {file.original_filename}</span>
                      <button onClick={() => openAttachment(file)} style={{ color: 'var(--gov-navy)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }}>View</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SLA STATUS */}
            {slaInfo && !isTerminal && (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: 'var(--text-xs)', fontWeight: 500, color: '#6A7280',
                  textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  SLA Status
                  {/* ⏸ ON-HOLD PAUSED BADGE */}
                  {ticket.status === 'On-Hold' && (
                    <span style={{
                      fontSize: 'var(--text-xs)', padding: '2px 8px',
                      background: '#FDF5DC', color: '#854F0B',
                      border: '1px solid #E8C96A',
                      borderRadius: 3, fontWeight: 600, letterSpacing: 0.3,
                    }}>
                      ⏸ PAUSED — ON HOLD
                    </span>
                  )}
                </div>

                {/* ON-HOLD INFO BANNER */}
                {ticket.status === 'On-Hold' && (
                  <div style={{
                    background: '#FDF5DC', border: '1px solid #E8C96A',
                    borderRadius: 5, padding: '8px 12px', marginBottom: 8,
                    fontSize: 'var(--text-xs)', color: '#854F0B', lineHeight: 1.5,
                  }}>
                    The ticket is <strong>On-Hold</strong>. Its escalation SLA started when it first entered On-Hold and continues until resolution.
                  </div>
                )}

                <div style={{
                  background: '#F5F8FC', borderRadius: 6,
                  padding: 12, display: 'flex', gap: 12, flexWrap: 'wrap',
                  opacity: 1,
                }}>
                  {(() => {
                    const now = new Date();
                    const created = new Date(slaInfo.created_at || ticket.created_at);
                    const resolvedAt = slaInfo.resolved_at ? new Date(slaInfo.resolved_at) : null;
                    const stoppedAt = resolvedAt || now;
                    const assignedAt = slaInfo.assigned_at ? new Date(slaInfo.assigned_at) : null;
                    const escalationStartedAt = slaInfo.escalation_started_at ? new Date(slaInfo.escalation_started_at) : null;
                    const responseStoppedAt = slaInfo.first_response_at ? new Date(slaInfo.first_response_at) : stoppedAt;
                    const pausedResolutionSeconds = Number(slaInfo.total_hold_seconds || 0);

                    const responseDeadline = new Date(created.getTime() + slaInfo.sla_response_hours * 3600000);
                    // total_hold_seconds includes the active hold returned by the API.
                    // Extending the deadline by it pauses resolution SLA on On-Hold.
                    const resolutionDeadline = assignedAt
                      ? new Date(assignedAt.getTime() + slaInfo.sla_resolution_hours * 3600000 + pausedResolutionSeconds * 1000)
                      : null;
                    const escalationDeadline = escalationStartedAt ? new Date(escalationStartedAt.getTime() + slaInfo.sla_escalation_hours * 3600000) : null;

                    const fmt = (d: Date | null) => d ? d.toLocaleString('en-PH', {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    }) : 'Not started';
                    return (
                      <>
                        <div style={{ flex: 1, minWidth: 110 }}>
                          <div style={{ fontSize: 'var(--text-xs)', color: '#6A7280', textTransform: 'uppercase', marginBottom: 4 }}>
                            SLA Rule ({slaInfo.sla_level})
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 'var(--text-xs)', padding: '1px 6px', background: '#FDE8E8', color: '#8B1A1A', borderRadius: 3, fontWeight: 500 }}>
                              {slaInfo.sla_priority}
                            </span>
                            <span style={{ fontSize: 'var(--text-xs)', padding: '1px 6px', background: '#E8F1FA', color: '#0D3B6E', borderRadius: 3, fontWeight: 500 }}>
                              {slaInfo.sla_impact}
                            </span>
                          </div>
                        </div>
                        {[
                          { label: 'Response', deadline: responseDeadline, breached: responseStoppedAt > responseDeadline, started: true, stopped: Boolean(slaInfo.first_response_at) },
                          { label: 'Escalation', deadline: escalationDeadline, breached: Boolean(escalationDeadline && stoppedAt > escalationDeadline), started: Boolean(escalationStartedAt), stopped: Boolean(resolvedAt) },
                          { label: 'Resolution', deadline: resolutionDeadline, breached: Boolean(resolutionDeadline && stoppedAt > resolutionDeadline), started: Boolean(assignedAt), stopped: Boolean(resolvedAt) },
                        ].map(({ label, deadline, breached, started, stopped }) => (
                          <div key={label} style={{ flex: 1, minWidth: 120 }}>
                            <div style={{ fontSize: 'var(--text-xs)', color: '#6A7280', textTransform: 'uppercase', marginBottom: 4 }}>
                              {label} Deadline
                            </div>
                            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: !started ? '#6A7280' : breached ? '#8B1A1A' : '#1B6B3A' }}>
                              {!started ? 'Not started' : breached ? '⚠ Breached' : stopped ? '✓ Completed on time' : '✓ Running'}
                            </div>
                            <div style={{ fontSize: 'var(--text-xs)', color: '#6A7280', marginTop: 2 }}>
                              {fmt(deadline)}
                            </div>
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}


            <section className="ticket-sheet-activity-section" aria-label="Ticket activity">
            <h4 className="ticket-sheet-section-title">Ticket Activity <span>{comments.length}</span></h4>
            <div className="ticket-sheet-created"><span><TicketIcon size={14} /></span><div><p><strong>{ticket.requestor || 'Requestor'}</strong> created this ticket</p><time>{formatDate(ticket.created_at)}</time></div></div>
            {/* COMMENTS */}
            <div className="ticket-sheet-old-activity-title" style={{
              fontSize: 'var(--text-xs)', fontWeight: 500, color: '#6A7280',
              textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10,
            }}>
              Ticket Activity ({comments.length})
            </div>

            {comments.length === 0 ? (
              <div style={{ fontSize: 'var(--text-xs)', color: '#999', marginBottom: 12 }}>
                No additional activity yet.
              </div>
            ) : comments.map(c => {
              const isSystem = isSystemComment(c.content);
              const systemStyle = getSystemCommentStyle(c.content);
              return (
                <div className="ticket-sheet-activity" key={c.id} style={{ display: 'flex', gap: 9, marginBottom: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: isSystem ? systemStyle.iconBg : '#E8F1FA',
                    color: isSystem ? systemStyle.text : 'var(--gov-navy)',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 'var(--text-xs)',
                    fontWeight: 600, flexShrink: 0,
                  }}>
                    {isSystem ? systemStyle.icon : getInitials(c.full_name)}
                  </div>
                  <div style={{
                    background: isSystem ? systemStyle.bg : '#F5F8FC',
                    borderRadius: 4, padding: '8px 10px', flex: 1,
                    border: isSystem ? `0.5px solid ${systemStyle.border}` : 'none',
                  }}>
                    <span style={{
                      fontSize: 'var(--text-xs)', fontWeight: 500,
                      color: isSystem ? '#3C3489' : '#1A2A3A',
                    }}>
                      {isSystem ? systemStyle.title : c.full_name}
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: '#999', marginLeft: 8 }}>
                      {formatDate(c.created_at)}
                    </span>
                    <div style={{
                      fontSize: 'var(--text-xs)', color: isSystem ? systemStyle.text : '#3A3A3A',
                      marginTop: 4, lineHeight: 1.6,
                      whiteSpace: 'pre-line',
                    }}>
                      {c.content}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* COMMENT INPUT */}
            {!isTerminal ? (
              <form className="ticket-comment-composer" aria-busy={posting} onSubmit={event => { event.preventDefault(); if (!posting) handlePostComment(); }}>
                <input
                  type="text"
                  aria-label="Comment"
                  value={newComment}
                  disabled={posting}
                  onChange={event => setNewComment(event.target.value)}
                  placeholder={isDswdStaff ? 'Add a follow-up comment...' : 'Add a comment or update...'}
                />
                <button type="submit" disabled={posting || !newComment.trim()} aria-label={posting ? 'Sending comment' : 'Send comment'} title={posting ? 'Sending...' : 'Send comment'}>
                  {posting ? <LoaderCircle size={18} className="ticket-comment-spinner" /> : <Send size={18} />}
                </button>
                <span className="ticket-grid-sr" role="status">{posting ? 'Sending comment...' : ''}</span>
              </form>
            ) : (
              <div style={{
                marginTop: 12, padding: '8px 12px',
                background: '#F5F8FC', borderRadius: 4,
                fontSize: 'var(--text-xs)', color: '#888', textAlign: 'center',
              }}>
                This ticket is {ticket.status.toLowerCase()}. No further comments can be added.
              </div>
            )}
            </section>

          </div>

          {/* FOOTER */}
          <div className="ticket-sheet-footer" style={{
            padding: '12px 20px', borderTop: '0.5px solid #E5EAF0',
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', background: '#F8FAFC',
            position: 'sticky', bottom: 0,
          }}>
            {/* LEFT — DSWD cancel */}
            <div>
              {isDswdStaff && ticket.status === 'Open' && !showCancelConfirm && (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  style={{
                    padding: '6px 14px', fontSize: 'var(--text-sm)',
                    background: '#FDE8E8', color: '#8B1A1A',
                    border: '1px solid #F5C0C0',
                    borderRadius: 4, cursor: 'pointer',
                  }}
                >
                  Cancel Ticket
                </button>
              )}
              {isDswdStaff && showCancelConfirm && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: '#8B1A1A', fontWeight: 500 }}>
                    Are you sure?
                  </span>
                  <button
                    onClick={handleDswdCancel}
                    disabled={cancelling}
                    style={{
                      padding: '5px 12px', fontSize: 'var(--text-xs)',
                      background: '#8B1A1A', color: '#fff',
                      border: 'none', borderRadius: 4, cursor: 'pointer',
                    }}



                  >
                    {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    style={{
                      padding: '5px 10px', fontSize: 'var(--text-xs)',
                      border: '1px solid #C8D0DC', borderRadius: 4,
                      background: '#fff', cursor: 'pointer',
                    }}
                  >
                    No
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT */}
            <div style={{ display: 'flex', gap: 8 }}>


              {/* DSWD Staff — fill CSM when Resolved */}
              {isDswdStaff && isTicketRequestor && ticket.status === 'Resolved' && (
                <button
                  onClick={() => setShowCSM(true)}
                  style={{
                    padding: '6px 14px', fontSize: 'var(--text-sm)',
                    background: 'var(--gov-amber)', color: '#fff',
                    border: 'none', borderRadius: 4,
                    cursor: 'pointer', fontWeight: 500,
                  }}
                >
                  <ClipboardCheck size={15} aria-hidden="true" /> Fill CSM to Close Ticket
                </button>
              )}

              {/* ✅ ICTMS — NO CSM button. CSM is for requestor only. */}
            </div>
          </div>
        </div>
      </div>

      {/* CSM MODAL */}
      {showCSM && ticket && (
        <CSMModal
          ticketId={ticket.id}
          ticketNumber={ticket.ticket_number}
          assignedTo={ticket.assigned_to}
          onClose={() => setShowCSM(false)}
          onSubmitted={() => {
            setShowCSM(false);
            showToast('CSM submitted! Ticket is now Closed ✓');
            setTimeout(() => { onResolved(); onClose(); }, 1500);
          }}
        />
      )}

      {viewingAttachment && attachmentPreviewUrl && (
        <div onClick={closeAttachmentPreview} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,20,0.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={event => event.stopPropagation()} style={{ width: 'min(1100px, 94vw)', height: 'min(780px, 88vh)', background: '#fff', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: 'var(--gov-navy)', color: '#fff', padding: '10px 14px', display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📎 {viewingAttachment.original_filename}</span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button onClick={closeAttachmentPreview} style={{ color: '#fff', background: 'rgba(255,255,255,.16)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 18, width: 28, height: 28 }}>×</button>
              </div>
            </div>
            {viewingAttachment.content_type.startsWith('image/') ? (
              <div style={{ flex: 1, display: 'grid', placeItems: 'center', background: '#F5F8FC', overflow: 'auto', padding: 16 }}><img src={attachmentPreviewUrl} alt={viewingAttachment.original_filename} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /></div>
            ) : viewingAttachment.content_type.startsWith('video/') ? (
              <div style={{ flex: 1, display: 'grid', placeItems: 'center', background: '#111' }}><video src={attachmentPreviewUrl} controls style={{ maxWidth: '100%', maxHeight: '100%' }} /></div>
            ) : (
              <iframe src={attachmentPreviewUrl} title={viewingAttachment.original_filename} style={{ flex: 1, border: 'none', width: '100%' }} />
            )}
          </div>
        </div>
      )}

      {showOnHoldBox && ticket && (
        <OnHoldReasonBox
          ticketNumber={ticket.ticket_number}
          reason={onHoldReason}
          onReasonChange={setOnHoldReason}
          onConfirm={handleOnHold}
          onCancel={() => { setShowOnHoldBox(false); setOnHoldReason(''); }}
          loading={updatingStatus}
        />
      )}



      {/* ✅ SUCCESS BOX  */}


    </>
  );
}
