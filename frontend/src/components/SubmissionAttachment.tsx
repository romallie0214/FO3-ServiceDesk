import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, FileText, X, Download } from 'lucide-react';

export default function SubmissionAttachment({ file, disabled, onRemove }: { file: File; disabled: boolean; onRemove: () => void }) {
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const image = /\.(jpe?g|png|gif|webp)$/i.test(file.name);
  const video = /\.(mp4|webm|mov)$/i.test(file.name);
  const pdf = /\.pdf$/i.test(file.name);
  useEffect(() => { const objectUrl = URL.createObjectURL(file); setUrl(objectUrl); return () => URL.revokeObjectURL(objectUrl); }, [file]);
  useEffect(() => {
    if (!preview) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.showModal();
    return () => { document.body.style.overflow = previousOverflow; };
  }, [preview]);
  return <div className="submission-attachment">
    <span className="submission-attachment-thumb">{image && url ? <img src={url} alt="" /> : <FileText size={21} />}</span>
    <span className="submission-attachment-info"><strong title={file.name}>{file.name}</strong><small>{(file.size / (1024 * 1024)).toFixed(2)} MB</small></span>
    <button type="button" aria-label={`Preview ${file.name}`} onClick={() => setPreview(true)}><Eye size={14} />Preview</button>
    <button type="button" disabled={disabled} aria-label={`Remove ${file.name}`} onClick={onRemove}><X size={15} /></button>
    {preview && createPortal(<dialog ref={dialogRef} className="submission-preview" aria-label={`Preview ${file.name}`} onCancel={() => setPreview(false)} onClose={() => setPreview(false)} onClick={event => { if (event.target === event.currentTarget) setPreview(false); }}>
      <div className="submission-preview-shell"><header><strong>{file.name}</strong><button type="button" aria-label="Close file preview" onClick={() => setPreview(false)}><X size={20} /></button></header>
        <div className="submission-preview-body">{image ? <img src={url} alt={file.name} /> : video ? <video src={url} controls /> : pdf ? <iframe src={url} title={file.name} /> : <div className="submission-preview-fallback"><FileText size={36} /><p>This document cannot be previewed in the browser.</p><a href={url} download={file.name}><Download size={15} />Download file</a></div>}</div>
      </div>
    </dialog>, document.body)}
  </div>;
}
