import { getTheme, subscribeTheme } from '../../utils/theme';
import { useState, useSyncExternalStore } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Filler } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import type { DashboardTicket } from '../../hooks/useAdminDashboard';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Filler);
const dateKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
export default function TicketCharts({ tickets, unavailable, monthly = false }: { tickets: DashboardTicket[]; unavailable: boolean; monthly?: boolean }) {
  const theme = useSyncExternalStore(subscribeTheme, getTheme);
  const dark = theme === 'dark';
  const now = new Date();
  const currentYear = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Taipei', year: 'numeric' }).format(now));
  const [days, setDays] = useState(7);
  const [year, setYear] = useState(currentYear);
  const years = [...new Set([currentYear, ...tickets.map(ticket => Number(dateKey(new Date(ticket.created_at)).slice(0, 4)))])].sort((a,b) => b-a);
  const dates = Array.from({ length: days }, (_, i) => new Date(now.getTime() - (days - 1 - i) * 86400000));
  const keys = dates.map(dateKey);
  const labels = monthly ? Array.from({ length: 12 }, (_, month) => new Date(2026, month, 1).toLocaleDateString('en', { month: 'short' })) : dates.map(date => date.toLocaleDateString('en', { timeZone: 'Asia/Taipei', month: 'short', day: 'numeric' }));
  const counts = labels.map((_, index) => tickets.filter(ticket => {
    const key = dateKey(new Date(ticket.created_at));
    return monthly ? Number(key.slice(0,4)) === year && Number(key.slice(5,7)) === index + 1 : key === keys[index];
  }).length);
  const options = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { displayColors: false } }, scales: { x: { grid: { display: false }, border: { display: false }, ticks: { color: dark ? '#9badc4' : '#8a96a8', font: { size: 11 } } }, y: { beginAtZero: true, border: { display: false }, ticks: { precision: 0, color: dark ? '#9badc4' : '#8a96a8', font: { size: 11 } }, grid: { color: dark ? '#2b3749' : '#f0f2f6' } } } };
  return <section className={'desk-panel desk-chart-panel ' + (monthly ? 'desk-monthly-chart' : '')}><header><h2>{monthly ? 'Ticket statistics' : 'Ticket activity'}</h2>{monthly ? <select aria-label="Ticket statistics year" value={year} onChange={e => setYear(Number(e.target.value))}>{years.map(value => <option key={value}>{value}</option>)}</select> : <select aria-label="Ticket activity period" value={days} onChange={e => setDays(Number(e.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option></select>}</header>
    <div className="desk-chart-body" data-shimmer-no-children>{unavailable ? <p>Ticket data could not be loaded.</p> : monthly ? <Bar aria-label={`Tickets submitted each month in ${year}`} role="img" options={options} data={{ labels, datasets: [{ label: 'Tickets submitted', data: counts, backgroundColor: '#f0e4fc', hoverBackgroundColor: '#7138ed', borderRadius: 4, maxBarThickness: 46 }] }} /> : <Line aria-label={`Tickets submitted in the last ${days} days`} role="img" options={options} data={{ labels, datasets: [{ label: 'Tickets submitted', data: counts, borderColor: '#9a77df', backgroundColor: '#a78bfa12', fill: true, tension: 0, borderWidth: 1.5, pointRadius: 2.5, pointBackgroundColor: '#fff', pointBorderColor: '#9a77df' }] }} />}</div><p className="desk-chart-caption">Tickets submitted{monthly ? ` in ${year}` : ` over the last ${days} days`} ? Taiwan time</p>
  </section>;
}
