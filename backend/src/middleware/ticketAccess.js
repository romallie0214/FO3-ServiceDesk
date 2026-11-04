const db = require('../db');
const { ticketPermissions } = require('../services/ticketAccess');

module.exports = function requireTicket(action = 'read', source = 'params', field = 'id') {
  return async (req, res, next) => {
    if (!req.user?.sid || req.user.purpose) return res.status(401).json({ error: 'Complete sign-in before accessing tickets.' });
    const id = req[source]?.[field];
    if (!/^[1-9][0-9]*$/.test(String(id))) return res.status(400).json({ error: 'Invalid ticket ID.' });
    try {
      const [rows] = await db.query('SELECT id, empno, assigned_to, service_area_id, status FROM tickets WHERE id = ? LIMIT 1', [id]);
      if (!rows.length) return res.status(404).json({ error: 'Ticket not found.' });
      const permissions = await ticketPermissions(req.user, rows[0]);
      const allowed = action === 'cancel' ? permissions.owner : action === 'comment' ? permissions.read : permissions[action];
      if (!allowed) return res.status(403).json({ error: 'You do not have access to this ticket.' });
      if (action !== 'read' && ['Closed','Cancelled'].includes(rows[0].status)) return res.status(409).json({ error: 'Closed or cancelled tickets cannot be modified.' });
      req.ticket = rows[0];
      req.body ||= {};
      // Acting identities are server-derived. Co-assignee target identity is handled by its route.
      if (['work','cancel','comment'].includes(action)) req.body.empno = req.user.empno;
      req.body.user_name = req.user.full_name;
      req.body.assigner_name = req.user.full_name;
      req.body.remover_name = req.user.full_name;
      req.body.assigned_by_empno = req.user.empno;
      req.body.removed_by = req.user.empno;
      if (req.route?.path === '/:id/assign') req.body.empno = req.user.empno;
      next();
    } catch (err) { console.error('Ticket permission check failed:', err.message); return res.status(500).json({ error: 'Unable to check ticket access.' }); }
  };
};
