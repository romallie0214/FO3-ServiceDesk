import { useEffect, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip } from 'chart.js';
import type { Plugin } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip);
type Score = { label: string; score: number | null; count: number };
export default function CSMQualityChart({ scores, loading, officerRatings }: { scores: Score[]; loading: boolean; officerRatings: number[] }) {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark');
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(document.documentElement.dataset.theme === 'dark'));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  const chartScores = scores.filter(score => score.label !== 'Cost');
  const text = dark ? '#c7d4e5' : '#465c74';
  const labels: Plugin<'bar'> = {
    id: 'csmScoreLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      ctx.fillStyle = document.documentElement.dataset.theme === 'dark' ? '#c7d4e5' : '#465c74';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      chart.getDatasetMeta(0).data.forEach((bar, index) => {
        const score = chart.data.datasets[0].data[index] as number | null;
        ctx.fillText(score === null ? 'N/A' : score.toFixed(2), bar.x, (score === null ? chart.scales.y.getPixelForValue(0) : bar.y) - 8);
      });
      ctx.restore();
    },
  };
  const ratingLabels = ['Very Satisfied (5)', 'Satisfied (4)', 'Neither (3)', 'Unsatisfied (2)', 'Very Unsatisfied (1)'];
  const ratingColors = ['#285585', '#39836c', '#e1ac49', '#cf8050', '#bc5863'];
  const ratingCounts = [5, 4, 3, 2, 1].map(rating => officerRatings.filter(value => value === rating).length);
  const totalRatings = ratingCounts.reduce((sum, count) => sum + count, 0);
  return <section className="csm-report-section csm-quality-chart">
    <div className="csm-quality-chart-heading"><h2>Service Quality Dimensions</h2><span>Cost: N/A</span></div>
    <p>Average ratings out of 5 for the current report filters. Cost is not applicable.</p>
    {loading ? <p role="status">Loading ratings...</p> : <div className="csm-summary-chart-grid"><div className="csm-quality-chart-scroll"><div className="csm-quality-chart-canvas">
      <Bar plugins={[labels]} role="img" aria-label={`Average service quality ratings out of 5. ${scores.map(s => `${s.label}: ${s.score === null ? 'not applicable or no answers' : s.score.toFixed(2)}`).join('. ')}`} data={{
        labels: chartScores.map(s => s.label),
        datasets: [{ label: 'Average rating', data: chartScores.map(s => s.score), backgroundColor: dark ? '#70a9df' : '#285585', hoverBackgroundColor: dark ? '#97c7f3' : '#3972a8', borderRadius: 4, maxBarThickness: 44 }],
      }} options={{
        indexAxis: 'x', responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 26 } },
        animation: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 450 },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => {
          const score = chartScores[context.dataIndex];
          return score.score === null ? 'N/A' : `${score.score.toFixed(2)} / 5 (${score.count} answered)`;
        } } } },
        scales: {
          y: { min: 0, max: 5, ticks: { stepSize: 1, color: text }, grid: { color: dark ? '#34465c' : '#edf0f3' }, title: { display: true, text: 'Average rating (0-5)', color: text }, border: { display: false } },
          x: { ticks: { autoSkip: false, maxRotation: 45, minRotation: 0, color: text, font: { size: 12 } }, grid: { display: false }, border: { display: false } },
        },
      }} />
    </div></div>
    <aside className="csm-officer-chart" aria-label="Officer rating breakdown">
      <h3>Officer Rating Breakdown</h3>
      {totalRatings > 0 ? <div className="csm-doughnut-canvas">
        <Doughnut role="img" aria-label={ratingLabels.map((label, index) => `${label}: ${ratingCounts[index]}`).join('. ')} data={{ labels: ratingLabels, datasets: [{ data: ratingCounts, backgroundColor: ratingColors, borderWidth: 2, borderColor: dark ? '#172334' : '#fff', hoverOffset: 5 }] }} options={{
          responsive: true, maintainAspectRatio: false, cutout: '74%',
          animation: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : { duration: 450 },
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => `${context.label}: ${context.parsed} (${(context.parsed / totalRatings * 100).toFixed(1)}%)` } } },
        }} />
        <div className="csm-doughnut-center" aria-hidden="true"><strong>{totalRatings}</strong><span>ratings</span></div>
      </div> : <p className="csm-doughnut-empty" role="status">No officer ratings for these filters.</p>}
      <ul className="csm-rating-legend">{ratingLabels.map((label, index) => <li key={label}><i style={{ backgroundColor: ratingColors[index] }} aria-hidden="true" /><span>{label}</span><strong>{ratingCounts[index]}</strong><small>{totalRatings ? `${(ratingCounts[index] / totalRatings * 100).toFixed(1)}%` : 'N/A'}</small></li>)}</ul>
    </aside>
    </div>}
  </section>;
}
