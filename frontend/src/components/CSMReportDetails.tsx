import { useState } from 'react';
import { CalendarRange, Users, Building2, ContactRound, ChevronRight } from 'lucide-react';
import AppTable from './AppTable';

type Response = {
  age: number; sex: string; sector: string; client_type: string;
  rating_promptness: number; rating_reliability: number; rating_access: number; rating_courtesy: number;
  rating_cost: number; rating_integrity: number; rating_assurance: number; rating_outcome: number;
  cc_awareness: string; cc_visibility: string; cc_helpfulness: string;
};
const dimensions = [
  ['rating_promptness', 'SQD1 - Responsiveness'], ['rating_reliability', 'SQD2 - Reliability'],
  ['rating_access', 'SQD3 - Access and Facilities'], ['rating_courtesy', 'SQD4 - Communication / Courtesy'],
  ['rating_cost', 'SQD5 - Costs'], ['rating_integrity', 'SQD6 - Integrity'],
  ['rating_assurance', 'SQD7 - Assurance'], ['rating_outcome', 'SQD8 - Outcome'],
] as const;
const charter = [
  { key: 'cc_awareness', title: 'CC1', question: "Are you aware of the Citizen\u2019s Charter?", options: [
    "Yes, I am aware before my transaction (Oo, alam ko bago ang aking transaksyon)",
    "Yes, but I only knew when I saw the CC of this office",
    "No, not aware of the CC (Hindi ko alam ang Citizen's Charter)"] },
  { key: 'cc_visibility', title: 'CC2', question: "Have you seen this office\u2019s Citizen\u2019s Charter?", options: [
    "Yes, the CC is accessible (Oo, Madaling makita)",
    "Yes, but the CC is hard to find (Oo, pero mahirap itong hanapin)",
    "I haven't seen the CC (Hindi ko nakita ang Citizen's Charter)"] },
  { key: 'cc_helpfulness', title: 'CC3', question: "Did the Citizen\u2019s Charter help you with your transaction?", options: [
    "Yes, it is very helpful (Oo, nakatulong ang paggamit ng Citizen's Charter)",
    "No, I wasn't able to use the CC"] },
] as const;
const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const internal = (r: Response) => /^internal(?:\b|\s*\()/i.test(r.client_type || '');
const percent = (count: number, total: number) => total ? `${(count / total * 100).toFixed(2)}%` : 'N/A';
function qualityCounts(responses: Response[], key: typeof dimensions[number][0]) {
  const counts = [0, 0, 0, 0, 0, 0];
  for (const r of responses) {
    const value = key === 'rating_cost' ? 0 : Number(r[key]);
    counts[Number.isInteger(value) && value >= 1 && value <= 5 ? 5 - value : 5]++;
  }
  return counts;
}
function QualityRow({ label, counts }: { label: string; counts: number[] }) {
  const answered = counts.slice(0, 5).reduce((a, b) => a + b, 0);
  return <tr><th scope="row">{label}</th>{counts.map((n, i) => <td key={i}>{n}</td>)}<td>{answered + counts[5]}</td><td><strong>{percent(counts[0] + counts[1], answered)}</strong></td></tr>;
}
export default function CSMReportDetails({ tab, responses, loading }: { tab: string; responses: Response[]; loading: boolean }) {
  const [demographicTab, setDemographicTab] = useState(0);
  const tableProps = { loading, empty: responses.length === 0, emptyMessage: 'No CSM responses match this view.', className: 'shared-management-table csm-breakdown-table' };
  if (tab === 'quality') {
    const rows = dimensions.map(([key, label]) => ({ label, counts: qualityCounts(responses, key) }));
    const totals = rows.reduce((acc, row) => acc.map((n, i) => n + row.counts[i]), [0, 0, 0, 0, 0, 0]);
    return <section className="csm-report-section"><h2>A. Service Quality Dimensions</h2><p>Counts use the current report filters. Overall rating is the percentage of answered ratings that are 4 or 5. Costs are not applicable in the current form.</p>
      <AppTable {...tableProps} loadingColumns={9}><thead><tr>{['Service Quality Dimensions', 'Strongly Agree (5)', 'Agree (4)', 'Neither Agree nor Disagree (3)', 'Disagree (2)', 'Strongly Disagree (1)', 'N/A', 'Total Responses', 'Overall Rating'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.map(row => <QualityRow key={row.label} {...row} />)}{responses.length > 0 && <QualityRow label="Overall" counts={totals} />}</tbody></AppTable>
    </section>;
  }
  if (tab === 'demographics') {
    const ageGroup = (r: Response) => { const age = Number(r.age); return !Number.isFinite(age) || age <= 0 ? 'Did not specify' : age < 20 ? '19 years old or lower' : age < 35 ? '20 - 34' : age < 50 ? '35 - 49' : age < 65 ? '50 - 64' : '65 or higher'; };
    const sex = (r: Response) => ['male', '0'].includes(normalize(r.sex)) ? 'Male' : ['female', '1'].includes(normalize(r.sex)) ? 'Female' : normalize(r.sex) === 'prefer not to say' ? 'Prefer not to say' : 'Did not specify';
    const clientType = (r: Response) => internal(r) || normalize(r.client_type) === 'government' ? 'Government' : ['citizen', 'business'].includes(normalize(r.client_type)) ? normalize(r.client_type) === 'citizen' ? 'Citizen' : 'Business' : r.client_type?.trim() ? 'Others' : 'Did not specify';
    const sectors = ['Person with Disability', 'Senior Citizen', 'Indigenous People', 'Solo Parent', 'Children and Youth', 'Women'];
    const sector = (r: Response) => sectors.find(s => normalize(s) === normalize(r.sector)) || (r.sector?.trim() && normalize(r.sector) !== 'government' ? 'Others' : 'Did not specify');
    const groups = [
      { title: 'i. Age Group', labels: ['19 years old or lower', '20 - 34', '35 - 49', '50 - 64', '65 or higher', 'Did not specify'], classify: ageGroup },
      { title: 'ii. Sex', labels: ['Male', 'Female', 'Prefer not to say', 'Did not specify'], classify: sex },
      { title: 'iii. Client Type', labels: ['Citizen', 'Business', 'Government', 'Others', 'Did not specify'], classify: clientType },
      { title: 'iv. Client Sector', labels: [...sectors, 'Others', 'Did not specify'], classify: sector },
    ];
    const group = groups[demographicTab];
    const icons = [CalendarRange, Users, Building2, ContactRound];
    const internalCount = responses.filter(internal).length;
    return <section className="csm-report-section"><h2>B. Demographic Profile</h2><p>Counts use the current report filters. Internal/DSWD employees are counted as Government clients. Other records are External. Government is not a client sector and is counted as unspecified.</p><div className="csm-report-totals"><span>External: {responses.length - internalCount}</span><span>Internal: {internalCount}</span></div>
      <div className="csm-demographic-layout">
        <nav className="csm-demographic-sidebar" aria-label="Demographic sections">
          <span className="csm-demographic-nav-label">Breakdown</span>
          {groups.map((item, index) => {
            const Icon = icons[index];
            return <button key={item.title} aria-current={demographicTab === index ? 'true' : undefined} aria-controls="csm-demographic-panel" onClick={() => setDemographicTab(index)}><Icon size={16} aria-hidden="true" />{item.title.replace(/^[iv]+\. /, '')}<ChevronRight className="csm-sidebar-arrow" size={16} aria-hidden="true" /></button>;
          })}
        </nav>
        <label className="csm-demographic-select">View breakdown
          <select value={demographicTab} onChange={event => setDemographicTab(Number(event.target.value))}>
            {groups.map((item, index) => <option key={item.title} value={index}>{item.title.replace(/^[iv]+\. /, '')}</option>)}
          </select>
        </label>
      <article id="csm-demographic-panel" aria-label={group.title.replace(/^[iv]+\. /, '')} className="csm-report-card csm-demographic-table">
        <h3>{group.title.replace(/^[iv]+\. /, '')}<small>{responses.length} responses</small></h3>
        <AppTable {...tableProps} loadingColumns={4}>
          <thead><tr>{['Item No.', group.title.replace(/^[iv]+\. /, ''), 'External Clients', 'Internal Clients'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
          <tbody>{group.labels.map((label, index) => {
            const matches = responses.filter(r => group.classify(r) === label);
            return <tr key={label}><td>{index + 1}</td><th scope="row">{label}</th><td>{matches.filter(r => !internal(r)).length}</td><td>{matches.filter(internal).length}</td></tr>;
          })}</tbody>
        </AppTable>
      </article>
      </div>
    </section>;
  }
  return <section className="csm-report-section"><h2>C. Citizen&apos;s Charter Results</h2><p>Each question uses its own submitted answers as the percentage denominator. Missing answers are shown separately.</p>
    {charter.map(question => {
      const answered = responses.filter(r => normalize(r[question.key]));
      const options = [...question.options] as string[];
      const other = answered.filter(r => !options.some(option => normalize(option) === normalize(r[question.key]))).length;
      const rows = options.map(label => ({ label, count: answered.filter(r => normalize(r[question.key]) === normalize(label)).length }));
      if (other) rows.push({ label: 'Other recorded answers', count: other });
      return <article className="csm-report-card" key={question.key}><h3>{question.title}<small>{question.question}</small></h3><AppTable {...tableProps} loadingColumns={3}><thead><tr><th scope="col">Citizen&apos;s Charter Answer</th><th scope="col">Responses</th><th scope="col">Percentage</th></tr></thead><tbody>{rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.count}</td><td>{percent(row.count, answered.length)}</td></tr>)}<tr className="csm-report-total"><th scope="row">Total answered</th><td>{answered.length}</td><td>{percent(answered.length, answered.length)}</td></tr><tr><th scope="row">Did not answer</th><td>{responses.length - answered.length}</td><td>N/A</td></tr></tbody></AppTable></article>;
    })}
  </section>;
}
