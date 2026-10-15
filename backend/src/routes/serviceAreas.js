const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { canManageArea } = require('../services/serviceAreaAccess');

function requireSuperAdmin(req, res) {
  if (req.user?.role !== 'super_admin') {
    res.status(403).json({ error: 'Super Admin access is required.' });
    return false;
  }
  return true;
}

// Requesters must be able to choose an active destination service when
// submitting a ticket. Administrative configuration remains protected below.
router.get('/', auth, async (req, res) => {
  try {
    const activeOnly = req.user?.role === 'super_admin' ? '' : 'WHERE sa.is_active = 1';
    const [areas] = await db.query(`
      SELECT sa.*, COUNT(DISTINCT c.id) AS category_count, COUNT(DISTINCT usr.id) AS staff_count
      FROM service_areas sa
      LEFT JOIN categories c ON c.service_area_id = sa.id
      LEFT JOIN user_service_roles usr ON usr.service_area_id = sa.id AND usr.is_active = 1
      ${activeOnly}
      GROUP BY sa.id ORDER BY sa.name
    `);
    res.json(areas);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/staff', auth, async (req, res) => {
  try {
    if (!await canManageArea(req.user, req.params.id)) return res.status(403).json({ error: 'Area Admin access is required for this service area.' });
    const [rows] = await db.query(`
      SELECT usr.id, usr.service_role, usr.is_active, u.id AS user_id, u.empno, u.full_name, u.email, u.division, u.unit
      FROM user_service_roles usr JOIN users u ON u.id = usr.user_id
      WHERE usr.service_area_id = ? AND u.deleted_at IS NULL
      ORDER BY usr.service_role, u.full_name
    `, [req.params.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, (req, res, next) => {
  if (!requireSuperAdmin(req, res)) return;
  next();
}, async (req, res) => {
  try {
    const { code, name, division_code = null, division = null, unit_code = null, unit = null, description = '', is_active = true } = req.body;
    if (!code?.trim() || !name?.trim()) return res.status(400).json({ error: 'Code and name are required.' });
    const [result] = await db.query('INSERT INTO service_areas (code, name, division_code, division, unit_code, unit, description, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [code.trim().toUpperCase(), name.trim(), division_code || null, division || null, unit_code || null, unit || null, description, Boolean(is_active)]);
    res.status(201).json({ id: result.insertId, message: 'Service area created.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, (req, res, next) => {
  if (!requireSuperAdmin(req, res)) return;
  next();
}, async (req, res) => {
  try {
    const { code, name, division_code = null, division = null, unit_code = null, unit = null, description = '', is_active = true } = req.body;
    if (!code?.trim() || !name?.trim()) return res.status(400).json({ error: 'Code and name are required.' });
    await db.query('UPDATE service_areas SET code=?, name=?, division_code=?, division=?, unit_code=?, unit=?, description=?, is_active=? WHERE id=?', [code.trim().toUpperCase(), name.trim(), division_code || null, division || null, unit_code || null, unit || null, description, Boolean(is_active), req.params.id]);
    res.json({ message: 'Service area updated.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/staff/:userId', auth, async (req, res) => {
  try {
    const { service_role, is_active = true } = req.body;
    if (!['admin', 'supervisor', 'technical_staff'].includes(service_role)) return res.status(400).json({ error: 'Invalid service role.' });
    if (!await canManageArea(req.user, req.params.id)) return res.status(403).json({ error: 'Area Admin access is required for this service area.' });
    if (req.user.role !== 'super_admin' && service_role === 'admin') return res.status(403).json({ error: 'Only the FO3 Super Admin can assign Area Admin access.' });
    await db.query(`INSERT INTO user_service_roles (service_area_id, user_id, service_role, is_active) VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE service_role=VALUES(service_role), is_active=VALUES(is_active)`, [req.params.id, req.params.userId, service_role, Boolean(is_active)]);
    res.json({ message: 'Service role saved.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id/staff/:userId', auth, async (req, res) => {
  try {
    if (!await canManageArea(req.user, req.params.id)) return res.status(403).json({ error: 'Area Admin access is required for this service area.' });
    const [existing] = await db.query('SELECT service_role FROM user_service_roles WHERE service_area_id=? AND user_id=?', [req.params.id, req.params.userId]);
    if (req.user.role !== 'super_admin' && existing[0]?.service_role === 'admin') return res.status(403).json({ error: 'Only the FO3 Super Admin can remove Area Admin access.' });
    await db.query('DELETE FROM user_service_roles WHERE service_area_id=? AND user_id=?', [req.params.id, req.params.userId]);
    res.json({ message: 'Service role removed.' });
  }
  catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
