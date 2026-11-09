/* Repeatable local demo fixtures. Existing records are never overwritten. */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function main() {
  if (process.env.NODE_ENV !== 'development') throw new Error('Demo seeding requires NODE_ENV=development.');
  const db = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  let added = 0;
  // Table and column identifiers below come only from this script, never user input.
  async function ensure(table, key, data) {
    const fields = Object.keys(key);
    const where = fields.map(k => '\x60' + k + '\x60 = ?').join(' AND ');
    const [existing] = await db.query('SELECT id FROM ' + table + ' WHERE ' + where, Object.values(key));
    if (existing.length) return existing[0].id;
    const record = { ...key, ...data };
    const [result] = await db.query('INSERT INTO ' + table + ' SET ?', record);
    added++;
    return result.insertId;
  }
  try {
    await db.beginTransaction();
    const areas = [];
    for (const [code, name] of [['ICT', 'Information and Communications Technology'], ['DEMO-BGMS', '[DEMO] Budget and General Management']]) {
      areas.push(await ensure('service_areas', { code }, { name, description: '[DEMO] Service area for testing', is_active: 1 }));
    }
    const people = [];
    for (const [i, role] of ['supervisor', 'ictms_staff', 'ictms_staff', 'dswd_staff'].entries()) {
      const empno = 'DEMO-' + (i + 1);
      const full_name = '[DEMO] ' + ['Supervisor', 'Technical Staff One', 'Technical Staff Two', 'Requestor'][i];
      const id = await ensure('users', { empno }, { full_name, email: 'demo-' + (i + 1) + '@example.invalid', role, division: 'Demo Division', unit: 'Demo Unit', office_location: 'Demo Main Office' });
      people.push({ id, empno, full_name });
      if (i < 3) for (const area of areas) await ensure('user_service_roles', { service_area_id: area, user_id: id }, { service_role: i === 0 ? 'supervisor' : 'technical_staff', is_active: 1 });
    }
    const [owners] = await db.query('SELECT id, empno, full_name FROM users WHERE empno = ? AND deleted_at IS NULL', ['03-12613']);
    const owner = owners[0] || people[3];
    const priorities = ['Low', 'Medium', 'High', 'Critical'];
    const categories = [];
    const subs = [];
    const items = [];
    for (let i = 0; i < 4; i++) {
      const area = areas[i % areas.length];
      const sla = await ensure('sla_rules', { service_area_id: area, priority: priorities[i], impact_level: 'Individual' }, { response_time_hours: [8,4,2,1][i], resolution_time_hours: [72,48,24,8][i], escalation_time_hours: [48,24,12,4][i], description: '[DEMO] Individual support SLA', is_active: 1 });
      const category = await ensure('categories', { service_area_id: area, name: '[DEMO] ' + ['Hardware Support','Budget Processing','Network Support','Facilities Request'][i] }, { description: 'Synthetic category for testing', default_priority: priorities[i], sla_rule_id: sla });
      categories.push(category);
      const sub = await ensure('sub_categories', { category_id: category, name: '[DEMO] General Assistance' }, { default_priority: priorities[i], sla_rule_id: sla });
      subs.push(sub);
      items.push(await ensure('sub_items', { sub_category_id: sub, name: '[DEMO] Diagnostic and resolution' }, { default_priority: priorities[i], sla_rule_id: sla }));
    }
    for (const [i, title] of ['Troubleshoot a network connection','Prepare a budget request','Request workstation support','Report a facilities issue'].entries()) {
      await ensure('knowledge_base', { title: '[DEMO] ' + title, service_area_id: areas[i % 2] }, { category: 'Demo guides', description: 'Test article: describe the issue, record troubleshooting steps, and submit a support ticket. No attachment is included.' });
    }
    const statuses = ['Open','Assigned','In Progress','On-Hold','Resolved','Cancelled','Closed'];
    for (let i = 0; i < 28; i++) {
      const status = statuses[i % 7];
      const assigned = status !== 'Open' && status !== 'Cancelled';
      const assignee = i % 2 === 0 ? owner : people[1 + i % 2];
      const created = new Date(Date.now() - (i + 1) * 86400000);
      const assignedAt = new Date(created.getTime() + 3600000);
      const completed = new Date(created.getTime() + 4 * 3600000);
      const categoryIndex = i % 4;
      const requester = i % 3 === 0 ? owner : people[3];
      const ticket = await ensure('tickets', { ticket_number: 'DEMO-' + String(i + 1).padStart(4, '0') }, {
        empno: requester.empno, requestor_name: requester.full_name,
        subject: '[DEMO] ' + ['Workstation will not start','Budget document review','Intermittent network access','Office equipment request'][categoryIndex] + ' #' + (i + 1),
        description: 'Synthetic test ticket. Use this record to test filtering, assignment, comments, SLA tracking, and status changes.',
        status, priority: priorities[categoryIndex], category_id: categories[categoryIndex], sub_category_id: subs[categoryIndex], sub_item_id: items[categoryIndex], service_area_id: areas[categoryIndex % 2],
        division: 'Demo Division', unit: 'Demo Unit', office_location: i % 2 ? 'Demo Field Office' : 'Demo Main Office',
        assigned_to: assigned ? assignee.id : null, created_at: created, updated_at: assigned ? completed : created,
        assigned_at: assigned ? assignedAt : null, first_response_at: assigned ? assignedAt : null,
        resolved_at: ['Resolved','Closed'].includes(status) ? completed : null,
        cancel_reason: status === 'Cancelled' ? '[DEMO] Duplicate request' : null,
        hold_started_at: status === 'On-Hold' ? completed : null,
      });
      if (assigned) await ensure('ticket_assignees', { ticket_id: ticket, user_id: assignee.id }, { empno: assignee.empno, full_name: assignee.full_name, role: 'primary', assigned_at: assignedAt, assigned_by: owner.empno });
      await ensure('comments', { ticket_id: ticket, content: '[DEMO] Initial testing note: request details have been recorded.' }, { empno: requester.empno, created_at: created });
      if (['Resolved','Closed'].includes(status)) {
        const rating = 3 + i % 3;
        await ensure('csm_responses', { ticket_id: ticket }, { empno: requester.empno, client_name: requester.full_name, sex: 'Prefer not to say', office_location: 'Demo Main Office', unit_name: 'Demo Unit', division_name: 'Demo Division', client_type: 'Internal', service_mode: 'Online', officer_rating: rating, rating_promptness: rating, rating_reliability: rating, rating_access: rating, rating_courtesy: rating, rating_cost: rating, rating_integrity: rating, rating_assurance: rating, rating_outcome: rating, commendation: '[DEMO] Helpful support', suggestion: '[DEMO] Improve progress updates', submitted_at: completed });
      }
    }
    const [counts] = await db.query("SELECT status, COUNT(*) AS count FROM tickets WHERE ticket_number LIKE 'DEMO-%' GROUP BY status");
    await db.commit();
    console.log('Demo seed complete. New records:', added);
    console.table(counts);
    console.log('Demo users are fixtures only; Harmony authentication is unchanged. No emails sent or storage files created.');
  } catch (error) { await db.rollback(); throw error; }
  finally { await db.end(); }
}
main().catch(error => { console.error('Demo seed failed:', error.message); process.exitCode = 1; });
