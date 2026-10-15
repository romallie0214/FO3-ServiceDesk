const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { canManageArea, requireAreaAdmin } = require('../services/serviceAreaAccess');

// GET all SLA rules
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT sr.*, sa.name AS service_area_name, sa.code AS service_area_code
      FROM sla_rules sr LEFT JOIN service_areas sa ON sa.id = sr.service_area_id
      ORDER BY 
        sa.name, FIELD(sr.priority, 'Critical','High','Medium','Low'),
        FIELD(sr.impact_level, 'Enterprise-wide','Departmental','Individual')
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single SLA rule
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM sla_rules WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'SLA rule not found.' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create SLA rule
router.post('/', auth, requireAreaAdmin, async (req, res) => {
  try {
    const {
      priority, impact_level,
      response_time_hours, resolution_time_hours,
      escalation_time_hours, description, is_active, service_area_id,
    } = req.body;

    if (!priority || !impact_level || !service_area_id) {
      return res.status(400).json({ error: 'Service area, Priority, and Impact Level are required.' });
    }
    if (!await canManageArea(req.user, service_area_id)) return res.status(403).json({ error: 'You can only manage SLA rules in your designated service area.' });
    if (Number(response_time_hours) <= 0 ||
        Number(resolution_time_hours) <= 0 ||
        Number(escalation_time_hours) <= 0) {
      return res.status(400).json({ error: 'All time values must be greater than 0.' });
    }
    if (Number(response_time_hours) >= Number(resolution_time_hours)) {
      return res.status(400).json({ error: 'Resolution time must be greater than response time.' });
    }

    const [result] = await db.query(`
      INSERT INTO sla_rules 
        (priority, impact_level, response_time_hours, 
         resolution_time_hours, escalation_time_hours, 
         description, is_active, service_area_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      priority, impact_level,
      response_time_hours, resolution_time_hours,
      escalation_time_hours, description ?? '',
      is_active ?? 1, service_area_id,
    ]);

    res.status(201).json({ message: 'SLA rule created.', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        error: `An SLA rule for ${req.body.priority} / ${req.body.impact_level} already exists.`
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT update SLA rule
router.put('/:id', auth, requireAreaAdmin, async (req, res) => {
  try {
    const {
      priority, impact_level,
      response_time_hours, resolution_time_hours,
      escalation_time_hours, description, is_active, service_area_id,
    } = req.body;
    const [existing] = await db.query('SELECT service_area_id FROM sla_rules WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'SLA rule not found.' });
    if (!await canManageArea(req.user, existing[0].service_area_id) || !await canManageArea(req.user, service_area_id)) return res.status(403).json({ error: 'You can only manage SLA rules in your designated service area.' });

    if (Number(response_time_hours) >= Number(resolution_time_hours)) {
      return res.status(400).json({
        error: 'Resolution time must be greater than response time.'
      });
    }

    await db.query(`
      UPDATE sla_rules SET
        priority = ?, impact_level = ?,
        response_time_hours = ?, resolution_time_hours = ?,
        escalation_time_hours = ?, description = ?,
        is_active = ?, service_area_id = ?
      WHERE id = ?
    `, [
      priority, impact_level,
      response_time_hours, resolution_time_hours,
      escalation_time_hours, description ?? '',
        is_active, service_area_id, req.params.id,
    ]);

    res.json({ message: 'SLA rule updated.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        error: `An SLA rule for this Priority / Impact combination already exists.`
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// PATCH toggle active status
router.patch('/:id/toggle', auth, requireAreaAdmin, async (req, res) => {
  try {
    const [existing] = await db.query('SELECT service_area_id FROM sla_rules WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'SLA rule not found.' });
    if (!await canManageArea(req.user, existing[0].service_area_id)) return res.status(403).json({ error: 'You can only manage SLA rules in your designated service area.' });
    await db.query(
      'UPDATE sla_rules SET is_active = NOT is_active WHERE id = ?',
      [req.params.id]
    );
    res.json({ message: 'SLA rule status toggled.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE SLA rule
router.delete('/:id', auth, requireAreaAdmin, async (req, res) => {
  try {
    const [existing] = await db.query('SELECT service_area_id FROM sla_rules WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'SLA rule not found.' });
    if (!await canManageArea(req.user, existing[0].service_area_id)) return res.status(403).json({ error: 'You can only manage SLA rules in your designated service area.' });
    await db.query('DELETE FROM sla_rules WHERE id = ?', [req.params.id]);
    res.json({ message: 'SLA rule deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
