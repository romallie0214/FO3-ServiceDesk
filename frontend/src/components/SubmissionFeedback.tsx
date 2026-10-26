import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LoaderCircle, CircleCheck, Copy, Check, ArrowRight, Plus, Ticket, X } from 'lucide-react';
import toast from 'react-hot-toast';

type SubmittedTicket = { ticket_number: string; subject: string };
export default function SubmissionFeedback({ busy, progress, ticket, onView, onAnother }: { busy: boolean; progress: number | null; ticket: SubmittedTicket | null; onView: () => void; onAnother: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const viewRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const active = busy || !!ticket;
  useEffect(() => {
    if (!active) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.showModal();
    return () => { document.body.style.overflow = overflow; previousFocus?.focus({ preventScroll: true }); };
  }, [active]);
  useEffect(() => { if (ticket && !busy) viewRef.current?.focus({ preventScroll: true }); }, [ticket, busy]);
  async function copyReference() {
    if (!ticket) return;
    try { await navigator.clipboard.writeText(ticket.ticket_number); setCopied(true); }
    catch { toast.error('Could not copy. Select and copy the reference number below.'); }
  }
  if (!active) return null;
  return createPortal(<dialog ref={dialogRef} className="submission-feedback-dialog" aria-labelledby="submission-feedback-title" onCancel={event => { event.preventDefault(); if (!busy) onAnother(); }}>
    {busy ? <div className="submission-progress" role="status" aria-live="polite">
      <span className="submission-feedback-symbol is-loading"><LoaderCircle size={30} className="submission-feedback-spinner" /></span>
      <h2 id="submission-feedback-title">Submitting your ticket</h2>
      <p>{progress !== null && progress < 100 ? 'Uploading your supporting files...' : 'Saving your request and generating its reference number...'}</p>
      {progress !== null && progress < 100 ? <progress aria-label="File upload progress" max={100} value={progress} /> : <progress aria-label="Creating ticket" />}
      <small>Please keep this window open. This may take a moment.</small>
    </div> : ticket && <>
      <button className="submission-feedback-close" type="button" aria-label="Close submission confirmation" onClick={onAnother}><X size={19} /></button>
      <div className="submission-feedback-intro"><span className="submission-feedback-symbol"><CircleCheck size={30} strokeWidth={1.7} /></span><h2 id="submission-feedback-title">Ticket submitted</h2><p>Your request is in the queue. Keep your reference number to track its progress.</p></div>
      <div className="submission-feedback-reference"><div><span><Ticket size={13} />Reference number</span><strong>{ticket.ticket_number}</strong></div><button type="button" onClick={copyReference} aria-label={copied ? 'Reference copied' : 'Copy reference number'} title={copied ? 'Copied' : 'Copy reference number'}>{copied ? <Check size={17} /> : <Copy size={17} />}</button></div>
      <div className="submission-feedback-subject"><span>Subject</span><p>{ticket.subject}</p></div>
      <p className="submission-feedback-note">The responsible service team will review your ticket. You can follow updates in My Submitted.</p>
      <footer><button type="button" onClick={onAnother}><Plus size={15} />Submit another</button><button ref={viewRef} type="button" className="submission-feedback-primary" onClick={onView}>View my tickets<ArrowRight size={15} /></button></footer>
      <span className="submit-sr-only" role="status">{copied ? 'Reference number copied' : ''}</span>
    </>}
  </dialog>, document.body);
}
