import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import './ServiceAreaSelect.css';

interface Area { id: number; code: string; name: string }
interface Props { areas: Area[]; value: string; onChange: (value: string) => void }

export default function ServiceAreaSelect({ areas, value, onChange }: Props) {
  const details = useRef<HTMLDetailsElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const [query, setQuery] = useState('');
  const selected = areas.find(area => String(area.id) === value);
  const results = areas.filter(area => `${area.code} ${area.name}`.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (details.current && !details.current.contains(event.target as Node)) details.current.open = false;
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  return <details className="service-area-select" ref={details}
    onToggle={event => { if (event.currentTarget.open) { setQuery(''); search.current?.focus({ preventScroll: true }); } }}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); if (details.current) details.current.open = false; trigger.current?.focus(); } }}>
    <summary ref={trigger} aria-label="Select service area">
      <span>{selected ? <><strong>{selected.name}</strong><small>{selected.code}</small></> : 'Select a service area'}</span><ChevronDown size={16} aria-hidden="true" />
    </summary>
    <div className="service-area-select-menu">
      <label className="service-area-select-search"><Search size={15} aria-hidden="true" /><input ref={search} aria-label="Search service areas" placeholder="Search by name or code..." value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); details.current?.querySelector<HTMLButtonElement>('.service-area-select-results button')?.focus(); } }} /></label>
      <div className="service-area-select-results" aria-label="Service areas" onKeyDown={event => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        const buttons = Array.from(event.currentTarget.querySelectorAll('button'));
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault();
        if (index === 0 && event.key === 'ArrowUp') search.current?.focus();
        else buttons[Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus();
      }}>
        {results.map(area => <button type="button" key={area.id} aria-pressed={String(area.id) === value} onClick={() => { onChange(String(area.id)); if (details.current) details.current.open = false; trigger.current?.focus(); }}><span><strong>{area.name}</strong><small>{area.code}</small></span>{String(area.id) === value && <Check size={16} aria-hidden="true" />}</button>)}
        {!results.length && <p role="status">No service areas match your search.</p>}
      </div>
    </div>
  </details>;
}
