import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Pagination.css';

interface PaginationProps {
  attached?: boolean;
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export default function Pagination({ attached = false, page, total, pageSize, onPageChange, onPageSizeChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  const visible = Array.from(new Set([1, pages, current - 1, current, current + 1]))
    .filter(value => value >= 1 && value <= pages).sort((a, b) => a - b);
  return (
    <div className={`app-pagination${attached ? ' app-pagination-attached' : ''}`}>
      <span className="app-pagination-count" aria-live="polite">
        Showing <strong>{total ? (current - 1) * pageSize + 1 : 0}{'\u2013'}{Math.min(current * pageSize, total)}</strong> of <strong>{total}</strong>
      </span>
      <div className="app-pagination-controls">
        {onPageSizeChange && <label className="app-pagination-size">Rows per page
          <select aria-label="Rows per page" value={pageSize} onChange={event => { onPageSizeChange(Number(event.target.value)); onPageChange(1); }}>
            {[10, 20, 30].map(size => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>}
        <nav aria-label="Table pagination" className="app-pagination-pages">
          <button type="button" aria-label="Previous page" disabled={current === 1} onClick={() => onPageChange(current - 1)}><ChevronLeft size={16} /></button>
          {visible.map((value, index) => <span className="app-pagination-page-item" key={value}>
            {index > 0 && value - visible[index - 1] > 1 && <span className="app-pagination-ellipsis" aria-hidden="true">{'\u2026'}</span>}
            <button type="button" aria-label={`Page ${value}`} aria-current={value === current ? 'page' : undefined} onClick={() => onPageChange(value)}>{value}</button>
          </span>)}
          <span className="app-pagination-mobile">{current} / {pages}</span>
          <button type="button" aria-label="Next page" disabled={current === pages} onClick={() => onPageChange(current + 1)}><ChevronRight size={16} /></button>
        </nav>
      </div>
    </div>
  );
}
