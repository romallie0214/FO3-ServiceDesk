const db = require('../db');

async function adminAreaIds(user) {
  if (user?.role === 'super_admin') return null;
  if (!user?.id) return [];
  const [rows] = await db.query(
    `SELECT service_area_id FROM user_service_roles
     WHERE user_id = ? AND service_role = 'admin' AND is_active = 1`,
    [user.id]
  );
  return rows.map(row => Number(row.service_area_id));
}

async function canManageArea(user, serviceAreaId) {
  if (user?.role === 'super_admin') return true;
  const ids = await adminAreaIds(user);
  return ids.includes(Number(serviceAreaId));
}

async function requireAreaAdmin(req, res, next) {
  if (req.user?.role === 'super_admin') return next();
  const ids = await adminAreaIds(req.user);
  if (!ids.length) return res.status(403).json({ error: 'Area Admin access is required.' });
  req.adminServiceAreaIds = ids;
  next();
}

module.exports = { adminAreaIds, canManageArea, requireAreaAdmin };
