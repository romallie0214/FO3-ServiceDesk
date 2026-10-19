const express = require('express');
const db = require('../db');
const { createIpAllowlist } = require('../middleware/ipAllowlist');

const router = express.Router();

router.use(createIpAllowlist());

// Read-only, deliberately limited dataset for the no-login monitoring screen.
router.get('/tickets', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        t.id, t.ticket_number, t.subject,
        t.status, t.priority, t.created_at,
        c.name AS category,
        sc.name AS sub_category,
        si.name AS sub_item,
        u2.full_name AS assigned_to,
        COALESCE(si_sla.priority, sc_sla.priority, c_sla.priority) AS sla_priority,
        COALESCE(si_sla.impact_level, sc_sla.impact_level, c_sla.impact_level) AS sla_impact,
        COALESCE(si_sla.response_time_hours, sc_sla.response_time_hours, c_sla.response_time_hours) AS sla_response_hours,
        COALESCE(si_sla.resolution_time_hours, sc_sla.resolution_time_hours, c_sla.resolution_time_hours) AS sla_resolution_hours,
        COALESCE(si_sla.escalation_time_hours, sc_sla.escalation_time_hours, c_sla.escalation_time_hours) AS sla_escalation_hours,
        CASE
          WHEN si.sla_rule_id IS NOT NULL THEN 'Sub-Item'
          WHEN sc.sla_rule_id IS NOT NULL THEN 'Sub-Category'
          WHEN c.sla_rule_id IS NOT NULL THEN 'Category'
          ELSE NULL
        END AS sla_level,
        t.first_response_at, t.assigned_at, t.escalation_started_at, t.resolved_at,
        t.hold_started_at,
        COALESCE(t.total_hold_seconds, 0) AS total_hold_seconds
      FROM tickets t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN sub_categories sc ON t.sub_category_id = sc.id
      LEFT JOIN sub_items si ON t.sub_item_id = si.id
      LEFT JOIN users u2 ON t.assigned_to = u2.id
      LEFT JOIN sla_rules c_sla ON c.sla_rule_id = c_sla.id
      LEFT JOIN sla_rules sc_sla ON sc.sla_rule_id = sc_sla.id
      LEFT JOIN sla_rules si_sla ON si.sla_rule_id = si_sla.id
      WHERE t.status NOT IN ('Closed', 'Cancelled')
      ORDER BY t.created_at ASC
    `);

    return res.json(rows);
  } catch (err) {
    console.error('Public monitoring error:', err.message);
    return res.status(500).json({ error: 'Unable to load monitoring data.' });
  }
});

module.exports = router;
