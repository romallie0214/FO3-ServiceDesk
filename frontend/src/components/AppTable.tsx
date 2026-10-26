import { useEffect, useId, useRef, useState } from 'react';
import type { TableHTMLAttributes } from 'react';
import { MoveHorizontal } from 'lucide-react';
import './AppTable.css';

/** Every table shares a contained, keyboard-accessible scroll region. */
export default function AppTable({ className = '', ...props }: TableHTMLAttributes<HTMLTableElement>) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => setOverflowing(viewport.scrollWidth > viewport.clientWidth + 1);
    const labelCells = () => {
      const table = viewport.querySelector('table');
      if (!table) return;
      const headers = Array.from(table.tHead?.rows[0]?.cells || []).flatMap(cell => Array(cell.colSpan).fill(cell.textContent?.trim() || 'Details'));
      for (const body of Array.from(table.tBodies)) {
        for (const row of Array.from(body.rows)) {
          let column = 0;
          for (const cell of Array.from(row.cells)) {
            cell.dataset.column = headers[column] || 'Details';
            cell.dataset.spanning = String(cell.colSpan > 1);
            column += cell.colSpan;
          }
        }
      }
      update();
    };
    const mutations = new MutationObserver(labelCells);
    mutations.observe(viewport, { childList: true, subtree: true, characterData: true });
    labelCells();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild);
    update();
    return () => { observer.disconnect(); mutations.disconnect(); };
  }, []);
  return <div className="app-table-responsive">
    {overflowing && <div id={hintId} className="app-table-scroll-hint"><MoveHorizontal size={13} aria-hidden="true" /><span>Scroll horizontally to see all columns</span></div>}
    <div ref={viewportRef} className="app-table-viewport" role={overflowing ? 'region' : undefined} aria-label={overflowing ? props['aria-label'] || 'Scrollable data table' : undefined} aria-describedby={overflowing ? hintId : undefined} tabIndex={overflowing ? 0 : undefined}>
      <table {...props} className={`app-table ${className}`.trim()} />
    </div>
  </div>;
}
