import type { LucideIcon } from 'lucide-react';
import './SummaryCards.css';
interface SummaryCard { label: string; value: number | string; description?: string; color: string; background: string; icon: LucideIcon; active?: boolean; onClick?: () => void; }
export default function SummaryCards({ cards }: { cards: SummaryCard[] }) {
  return <div className="summary-cards">{cards.map(card => {
    const content = <><span className="summary-card-icon" style={{ color: card.color, background: card.background }}><card.icon size={22} strokeWidth={1.7} aria-hidden="true" /></span><span className="summary-card-content"><span className="summary-card-label">{card.label}</span><strong className={typeof card.value === 'string' ? 'summary-card-text-value' : undefined}>{card.value}</strong>{card.description && <small>{card.description}</small>}{card.onClick && <small>{card.active ? 'Click to clear' : 'Click to filter'}</small>}</span></>;
    return card.onClick ? <button type="button" key={card.label} className="summary-card" aria-pressed={!!card.active} onClick={card.onClick} style={card.active ? { borderColor: card.color, background: card.background } : undefined}>{content}</button> : <div className="summary-card" key={card.label}>{content}</div>;
  })}</div>;
}
