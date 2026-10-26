import type { CSSProperties } from 'react';

// Shared palette for ticket tables and dashboard summaries.
const STATUS_STYLES: Record<string, CSSProperties> = {
  Open: { background: '#E8F1FA', color: '#0D3B6E' },
  Assigned: { background: '#FEF3DC', color: '#CC7700' },
  'In Progress': { background: '#F3EFFF', color: '#6D28D9' },
  'On-Hold': { background: '#FDE8E8', color: '#B91C1C' },
  Resolved: { background: '#E8F5EE', color: '#1B6B3A' },
  Cancelled: { background: '#FCE7F3', color: '#9D174D' },
  Closed: { background: '#F0F0F0', color: '#666' },
};
export default function StatusBadge({ status }: { status: string }) {
  return <span style={{
    ...(STATUS_STYLES[status] || STATUS_STYLES.Closed),
    fontSize: 'clamp(8px, 1.5vw, 11px)',
    padding: 'clamp(1px, 0.3vw, 2px) clamp(6px, 1.2vw, 10px)',
    borderRadius: 3, fontWeight: 500, whiteSpace: 'nowrap',
  }}>{status}</span>;
}
