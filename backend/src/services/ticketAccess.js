const db = require('../db');

// The SQL scope and single-ticket guard use the same owner/assignment/area rules.
function ticketScope(user, alias = 't') {
  if (!/^[a-z]+$/i.test(alias)) throw new Error('Invalid SQL alias');
  if (user.role === 'super_admin') return { sql: '1=1', params: [] };
  return { sql: `(${alias}.empno = ? OR ${alias}.assigned_to = ? OR EXISTS (
    SELECT 1 FROM ticket_assignees access_ta WHERE access_ta.ticket_id = ${alias}.id AND access_ta.user_id = ? AND access_ta.role = 'co-assignee'
  ) OR EXISTS (
    SELECT 1 FROM user_service_roles access_usr JOIN service_areas access_sa ON access_sa.id = access_usr.service_area_id
    WHERE access_usr.user_id = ? AND access_usr.service_area_id = ${alias}.service_area_id AND access_usr.is_active = 1 AND access_sa.is_active = 1
      AND access_usr.service_role IN ('admin', 'supervisor', 'technical_staff')
  ))`, params: [user.empno, user.id, user.id, user.id] };
}

async function ticketPermissions(user, ticket) {
  if (user.role === 'super_admin') return { read: true, work: true, manage: true, owner: String(ticket.empno) === user.empno };
  const owner = String(ticket.empno) === user.empno;
  const [roles] = user.id ? await db.query(`SELECT usr.service_role FROM user_service_roles usr JOIN service_areas sa ON sa.id = usr.service_area_id WHERE usr.user_id = ? AND usr.service_area_id = ? AND usr.is_active = 1 AND sa.is_active = 1`, [user.id, ticket.service_area_id]) : [[]];
  const manage = roles.some(row => ['admin', 'supervisor'].includes(row.service_role));
  const member = roles.some(row => ['admin', 'supervisor', 'technical_staff'].includes(row.service_role));
  const [co] = user.id ? await db.query("SELECT id FROM ticket_assignees WHERE ticket_id = ? AND user_id = ? AND role = 'co-assignee' LIMIT 1", [ticket.id, user.id]) : [[]];
  const assigned = Boolean(user.id && Number(ticket.assigned_to) === Number(user.id)) || co.length > 0;
  return { owner, manage, read: owner || assigned || member, work: manage || (member && assigned) };
}
module.exports = { ticketScope, ticketPermissions };
