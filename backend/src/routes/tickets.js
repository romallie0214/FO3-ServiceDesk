const express = require('express');
const router  = express.Router();
const db      = require('../db');
const harmonyApi = require('../HarmonyApiClient');
const { sendEmail } = require('../services/emailService');
const authMiddleware = require('../middleware/auth');
const { adminAreaIds } = require('../services/serviceAreaAccess');
const multer = require('multer');
const axios = require('axios');
const { uploadTicketAttachment, isObjectStorageConfigured, getPresignedDownloadUrl, assertValidTicketAttachment } = require('../services/objectStorage');
const ticketUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 5 }, fileFilter: (_, file, cb) => cb(null, /^(image\/(jpeg|png|gif|webp)|video\/(mp4|webm|quicktime)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)|text\/plain)$/.test(file.mimetype)) });

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function sendTicketEmail(ticketId, { subject: emailSubject, html }) {
  try {
    const [tRows] = await db.query(
      'SELECT ticket_number, subject, empno FROM tickets WHERE id = ?',
      [ticketId]
    );
    if (!tRows.length) return;
    const ticket = tRows[0];

    let requesterEmail = null;
    try {
      const emp = await harmonyApi.getEmployeeByEmpno(ticket.empno);
      const empData = emp?.data || emp;
      requesterEmail = empData?.email || empData?.user?.email || null;
    } catch (e) { console.warn('Harmony email lookup failed:', e.message); }
    if (!requesterEmail?.includes('@')) return;

    const [threadRows] = await db.query(
      'SELECT * FROM ticket_email_threads WHERE ticket_id = ? LIMIT 1',
      [ticketId]
    );
    const thread = threadRows[0] || null;

    await sendEmail({
      to:        requesterEmail,
      subject:   emailSubject || `Re: [${ticket.ticket_number}] ${ticket.subject}`,
      html,
      ...(thread && {
        inReplyTo:  thread.email_message_id,
        references: thread.email_message_id,
      }),
    });
  } catch (err) {
    console.error('sendTicketEmail error:', err.message);
  }
}

function emailWrapper(title, color, bodyHtml) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:${color};padding:16px 20px;border-radius:6px 6px 0 0;">
        <h2 style="color:#fff;margin:0;font-size:16px;">${title}</h2>
      </div>
      <div style="background:#f9f9f9;padding:20px;border:1px solid #ddd;
                  border-top:none;border-radius:0 0 6px 6px;">
        ${bodyHtml}
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="color:red;font-size:11px;margin:0;">
          *** This is a system generated message. DO NOT REPLY TO THIS EMAIL. ***
        </p>
      </div>
    </div>
  `;
}

function ticketInfoHtml(ticket_number, subject, extraRows = []) {
  const rows = [
    ['Ticket Number', ticket_number],
    ['Subject',       subject],
    ...extraRows,
  ];
  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:12px;">
      ${rows.map(([label, value]) => `
        <tr>
          <td style="padding:6px 10px;background:#eee;font-weight:bold;
                     width:40%;border:1px solid #ddd;">${label}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;">${value || '—'}</td>
        </tr>
      `).join('')}
    </table>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET all tickets
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { empno, assigned_to_id, assigned_to_empno, assignedToMe, role, onlyMine, serviceAdmin } = req.query;
    const serviceAdminAreaIds = serviceAdmin === 'true' ? await adminAreaIds(req.user) : [];
    if (serviceAdmin === 'true' && !serviceAdminAreaIds.length) {
      return res.status(403).json({ error: 'Service Admin access is required.' });
    }

    // "My submitted tickets" must always be bound to the authenticated user,
    // not to an employee number supplied in the browser query string.
    if (onlyMine === 'true') {
      const requestorEmpno = req.user.empno;
      const [rows] = await db.query(`
        SELECT
          t.id, t.ticket_number, t.subject, t.description,
          t.status, t.priority, t.created_at,
          t.cancel_reason,
          t.empno, t.requestor_name, t.unit, t.division, t.office_location,
          c.name  AS category,
          sc.name AS sub_category,
          si.name AS sub_item,
          t.requestor_name AS requestor,
          t.division       AS requestor_division,
          t.assigned_to    AS assigned_to_id,
          u2.full_name     AS assigned_to,
          t.service_area_id,
          sa.code          AS service_area_code,
          sa.name          AS service_area_name
        FROM tickets t
        LEFT JOIN categories     c  ON t.category_id     = c.id
        LEFT JOIN sub_categories sc ON t.sub_category_id = sc.id
        LEFT JOIN sub_items      si ON t.sub_item_id     = si.id
        LEFT JOIN users          u2 ON t.assigned_to     = u2.id
        LEFT JOIN service_areas  sa ON t.service_area_id  = sa.id
        WHERE t.empno = ?
        ORDER BY t.created_at DESC
      `, [requestorEmpno]);
      return res.json(rows);
    }

    // ICTMS Staff: smart sorting by office location
    if (role === 'ictms_staff' && empno) {
      const [locRows] = await db.query(
        'SELECT office_location_code FROM user_office_locations WHERE empno = ?',
        [empno]
      );
      const locationCodes = locRows.map(r => r.office_location_code);

      if (locationCodes.length > 0) {
        const orderClause = `
          ORDER BY
            CASE
              WHEN t.empno = ? THEN 3
              WHEN t.office_location IN (
                SELECT uol.office_location_name
                FROM user_office_locations uol
                WHERE uol.empno = ?
              ) THEN 1
              ELSE 2
            END ASC,
            t.id DESC
        `;
        const [rows] = await db.query(`
          SELECT
            t.id, t.ticket_number, t.subject, t.description,
            t.status, t.priority, t.created_at,
            t.cancel_reason,
            t.empno, t.requestor_name, t.unit, t.division, t.office_location,
            c.name  AS category,
            sc.name AS sub_category,
            si.name AS sub_item,
            t.requestor_name AS requestor,
            t.division       AS requestor_division,
            t.assigned_to    AS assigned_to_id,
            u2.full_name     AS assigned_to
          FROM tickets t
          LEFT JOIN categories     c  ON t.category_id     = c.id
          LEFT JOIN sub_categories sc ON t.sub_category_id = sc.id
          LEFT JOIN sub_items      si ON t.sub_item_id     = si.id
          LEFT JOIN users          u2 ON t.assigned_to     = u2.id
          ${orderClause}
        `, [empno, empno]);
        return res.json(rows);
      } else {
        const [rows] = await db.query(`
          SELECT
            t.id, t.ticket_number, t.subject, t.description,
            t.status, t.priority, t.created_at,
            t.cancel_reason,
            t.empno, t.requestor_name, t.unit, t.division, t.office_location,
            c.name  AS category,
            sc.name AS sub_category,
            si.name AS sub_item,
            t.requestor_name AS requestor,
            t.division       AS requestor_division,
            t.assigned_to    AS assigned_to_id,
            u2.full_name     AS assigned_to
          FROM tickets t
          LEFT JOIN categories     c  ON t.category_id     = c.id
          LEFT JOIN sub_categories sc ON t.sub_category_id = sc.id
          LEFT JOIN sub_items      si ON t.sub_item_id     = si.id
          LEFT JOIN users          u2 ON t.assigned_to     = u2.id
          ORDER BY t.id DESC
        `);
        return res.json(rows);
      }
    }

    // Default: dswd_staff (own tickets) or supervisor/admin (all tickets)
    let whereClause = '';
    let params = [];
    if (assignedToMe === 'true') {
      const ownAssignmentClause = `
        WHERE (
          u2.empno = ?
          OR EXISTS (
            SELECT 1
            FROM ticket_assignees ta
            INNER JOIN users assigned_user ON assigned_user.id = ta.user_id
            WHERE ta.ticket_id = t.id
              AND assigned_user.empno = ?
              AND ta.role = 'co-assignee'
          )
        )`;
      const areaClause = serviceAdminAreaIds.length
        ? ` AND t.service_area_id IN (${serviceAdminAreaIds.map(() => '?').join(',')})`
        : '';
      whereClause = ownAssignmentClause + areaClause;
      params = [req.user.empno, req.user.empno, ...serviceAdminAreaIds];
    } else if (serviceAdmin === 'true') {
      whereClause = `WHERE t.service_area_id IN (${serviceAdminAreaIds.map(() => '?').join(',')})`;
      params = serviceAdminAreaIds;
    } else if (empno && role === 'dswd_staff') {
      whereClause = 'WHERE t.empno = ?';
      params = [empno];
    } else if (assigned_to_id) {
      whereClause = `
        WHERE (
          t.assigned_to = ?
          OR EXISTS (
            SELECT 1
            FROM ticket_assignees ta
            WHERE ta.ticket_id = t.id
              AND ta.user_id = ?
              AND ta.role = 'co-assignee'
          )
        )
      `;
      params = [assigned_to_id, assigned_to_id];
    } else if (assigned_to_empno) {
      whereClause = `
        WHERE (
          u2.empno = ?
          OR EXISTS (
            SELECT 1
            FROM ticket_assignees ta
            INNER JOIN users assigned_user ON assigned_user.id = ta.user_id
            WHERE ta.ticket_id = t.id
              AND assigned_user.empno = ?
              AND ta.role = 'co-assignee'
          )
        )
      `;
      params = [assigned_to_empno, assigned_to_empno];
    }

    const [rows] = await db.query(`
      SELECT
        t.id, t.ticket_number, t.subject, t.description,
        t.status, t.priority, t.created_at,
        t.first_response_at, t.assigned_at, t.escalation_started_at, t.resolved_at,
        t.cancel_reason,
        t.empno, t.requestor_name, t.unit, t.division, t.office_location,
        c.name  AS category,
        sc.name AS sub_category,
        si.name AS sub_item,
        t.requestor_name AS requestor,
        t.division       AS requestor_division,
        t.assigned_to    AS assigned_to_id,
        t.service_area_id,
        u2.full_name     AS assigned_to,
        sa.code          AS service_area_code,
        sa.name          AS service_area_name
      FROM tickets t
      LEFT JOIN categories     c  ON t.category_id     = c.id
      LEFT JOIN sub_categories sc ON t.sub_category_id = sc.id
      LEFT JOIN sub_items      si ON t.sub_item_id     = si.id
      LEFT JOIN users          u2 ON t.assigned_to     = u2.id
      LEFT JOIN service_areas  sa ON t.service_area_id  = sa.id
      ${whereClause}
      ORDER BY t.created_at DESC
    `, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET monitoring/sla — MUST be before /:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/monitoring/sla', authMiddleware, async (req, res) => {
  try {
    const serviceAdminAreaIds = req.query.serviceAdmin === 'true'
      ? await adminAreaIds(req.user)
      : [];
    if (req.query.serviceAdmin === 'true' && !serviceAdminAreaIds.length) {
      return res.status(403).json({ error: 'Service Admin access is required.' });
    }
    const serviceAreaClause = serviceAdminAreaIds.length
      ? ` AND t.service_area_id IN (${serviceAdminAreaIds.map(() => '?').join(',')})`
      : '';
    const [rows] = await db.query(`
      SELECT
        t.id, t.ticket_number, t.subject,
        t.status, t.priority, t.created_at,
        t.service_area_id,
        sa.code AS service_area_code,
        sa.name AS service_area_name,
        c.name  AS category,
        sc.name AS sub_category,
        si.name AS sub_item,
        t.requestor_name AS requestor,
        t.division,
        u2.full_name AS assigned_to,
        COALESCE(si_sla.priority,              sc_sla.priority,              c_sla.priority)              AS sla_priority,
        COALESCE(si_sla.impact_level,          sc_sla.impact_level,          c_sla.impact_level)          AS sla_impact,
        COALESCE(si_sla.response_time_hours,   sc_sla.response_time_hours,   c_sla.response_time_hours)   AS sla_response_hours,
        COALESCE(si_sla.resolution_time_hours, sc_sla.resolution_time_hours, c_sla.resolution_time_hours) AS sla_resolution_hours,
        COALESCE(si_sla.escalation_time_hours, sc_sla.escalation_time_hours, c_sla.escalation_time_hours) AS sla_escalation_hours,
        CASE
          WHEN si.sla_rule_id IS NOT NULL THEN 'Sub-Item'
          WHEN sc.sla_rule_id IS NOT NULL THEN 'Sub-Category'
          WHEN c.sla_rule_id  IS NOT NULL THEN 'Category'
          ELSE NULL
        END AS sla_level,
        t.first_response_at, t.assigned_at, t.escalation_started_at, t.resolved_at,
        t.hold_started_at,
        COALESCE(t.total_hold_seconds, 0) AS total_hold_seconds
      FROM tickets t
      LEFT JOIN categories     c      ON t.category_id     = c.id
      LEFT JOIN sub_categories sc     ON t.sub_category_id = sc.id
      LEFT JOIN sub_items      si     ON t.sub_item_id     = si.id
      LEFT JOIN users          u2     ON t.assigned_to     = u2.id
      LEFT JOIN service_areas  sa     ON t.service_area_id = sa.id
      LEFT JOIN sla_rules      c_sla  ON c.sla_rule_id     = c_sla.id
      LEFT JOIN sla_rules      sc_sla ON sc.sla_rule_id    = sc_sla.id
      LEFT JOIN sla_rules      si_sla ON si.sla_rule_id    = si_sla.id
      WHERE t.status <> 'Cancelled'
      ${serviceAreaClause}
      ORDER BY t.created_at ASC
    `, serviceAdminAreaIds);
    res.json(rows);
  } catch (err) {
    console.error('Monitoring SLA error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /:id/sla — MUST be before /:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/sla', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        COALESCE(si_sla.priority,              sc_sla.priority,              c_sla.priority)              AS sla_priority,
        COALESCE(si_sla.impact_level,          sc_sla.impact_level,          c_sla.impact_level)          AS sla_impact,
        COALESCE(si_sla.response_time_hours,   sc_sla.response_time_hours,   c_sla.response_time_hours)   AS sla_response_hours,
        COALESCE(si_sla.resolution_time_hours, sc_sla.resolution_time_hours, c_sla.resolution_time_hours) AS sla_resolution_hours,
        COALESCE(si_sla.escalation_time_hours, sc_sla.escalation_time_hours, c_sla.escalation_time_hours) AS sla_escalation_hours,
        CASE
          WHEN si.sla_rule_id IS NOT NULL THEN 'Sub-Item'
          WHEN sc.sla_rule_id IS NOT NULL THEN 'Sub-Category'
          WHEN c.sla_rule_id  IS NOT NULL THEN 'Category'
          ELSE NULL
        END AS sla_level,
        t.created_at,
        t.first_response_at,
        t.assigned_at,
        t.escalation_started_at,
        t.resolved_at,
        t.status,
        t.hold_started_at,
        COALESCE(t.total_hold_seconds, 0) AS total_hold_seconds
      FROM tickets t
      LEFT JOIN categories     c      ON t.category_id     = c.id
      LEFT JOIN sub_categories sc     ON t.sub_category_id = sc.id
      LEFT JOIN sub_items      si     ON t.sub_item_id     = si.id
      LEFT JOIN sla_rules      c_sla  ON c.sla_rule_id     = c_sla.id
      LEFT JOIN sla_rules      sc_sla ON sc.sla_rule_id    = sc_sla.id
      LEFT JOIN sla_rules      si_sla ON si.sla_rule_id    = si_sla.id
      WHERE t.id = ?
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });

    const row = rows[0];

    // Calculate effective elapsed seconds (total elapsed minus all hold time)
    const now = new Date();
    const createdAt = new Date(row.created_at);
    const totalElapsedSeconds = Math.floor((now - createdAt) / 1000);

    // If currently on hold, add the running hold duration to total_hold_seconds
    let currentHoldSeconds = 0;
    if (row.status === 'On-Hold' && row.hold_started_at) {
      currentHoldSeconds = Math.floor((now - new Date(row.hold_started_at)) / 1000);
    }

    const effectiveElapsedSeconds = totalElapsedSeconds
      - Number(row.total_hold_seconds)
      - currentHoldSeconds;

    res.json({
      ...row,
      effective_elapsed_seconds: Math.max(0, effectiveElapsedSeconds),
      total_hold_seconds: Number(row.total_hold_seconds) + currentHoldSeconds,
      is_on_hold: row.status === 'On-Hold',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /my-pending-csm — MUST be before /:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/my-pending-csm', async (req, res) => {
  try {
    const { empno } = req.query;
    if (!empno) return res.status(400).json({ error: 'empno is required.' });

    const [rows] = await db.query(`
      SELECT t.id, t.ticket_number, t.subject
      FROM tickets t
      WHERE t.empno = ?
        AND t.status = 'Resolved'
        AND NOT EXISTS (
          SELECT 1 FROM csm_responses c WHERE c.ticket_id = t.id
        )
      LIMIT 1
    `, [empno]);

    res.json({ pending: rows.length > 0, ticket: rows[0] || null });
  } catch (err) {
    console.error('Pending CSM check error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET single ticket — MUST be after all specific GET routes
// ─────────────────────────────────────────────────────────────────────────────
// GET /tickets/report — served tickets for date range (cancelled excluded)
router.get('/report', authMiddleware, async (req, res) => {
  try {
    const { from, to, staff, status, serviceAdmin, service_area_id } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'from and to dates are required.' });
    }

    const serviceAdminAreaIds = serviceAdmin === 'true'
      ? await adminAreaIds(req.user)
      : [];
    if (serviceAdmin === 'true' && !serviceAdminAreaIds.length) {
      return res.status(403).json({ error: 'Service Admin access is required.' });
    }

    let staffClause = '';
    let params = [from, to];

    if (staff) {
      staffClause = 'AND u2.full_name = ?';
      params.push(staff);
    }
    let statusClause = '';
    if (status) {
      statusClause = 'AND t.status = ?';
      params.push(status);
    }
    let selectedServiceAreaClause = '';
    if (service_area_id) {
      const selectedServiceAreaId = Number(service_area_id);
      if (!Number.isInteger(selectedServiceAreaId) || selectedServiceAreaId <= 0) {
        return res.status(400).json({ error: 'Invalid service_area_id.' });
      }
      if (serviceAdminAreaIds.length && !serviceAdminAreaIds.includes(selectedServiceAreaId)) {
        return res.status(403).json({ error: 'You can generate reports for your service area only.' });
      }
      selectedServiceAreaClause = 'AND t.service_area_id = ?';
      params.push(selectedServiceAreaId);
    }
    const serviceAreaClause = serviceAdminAreaIds.length
      ? `AND t.service_area_id IN (${serviceAdminAreaIds.map(() => '?').join(',')})`
      : '';
    params.push(...serviceAdminAreaIds);

    const [rows] = await db.query(`
      SELECT
        t.id,
        t.ticket_number,
        t.subject,
        t.status,
        t.priority,
        t.created_at,
        t.updated_at,
        t.first_response_at,
        t.assigned_at,
        t.escalation_started_at,
        t.resolved_at,
        t.hold_started_at,
        COALESCE(t.total_hold_seconds, 0) AS total_hold_seconds,
        t.requestor_name      AS requestor,
        t.division,
        t.unit,
        t.office_location,
        t.service_area_id,
        sa.code              AS service_area_code,
        sa.name              AS service_area_name,
        c.name                AS category,
        sc.name               AS sub_category,
        si.name               AS sub_item,
        u2.full_name          AS assigned_to,
        COALESCE(si_sla.priority,              sc_sla.priority,              c_sla.priority)              AS sla_priority,
        COALESCE(si_sla.impact_level,          sc_sla.impact_level,          c_sla.impact_level)          AS sla_impact,
        COALESCE(si_sla.response_time_hours,   sc_sla.response_time_hours,   c_sla.response_time_hours)   AS sla_response_hours,
        COALESCE(si_sla.resolution_time_hours, sc_sla.resolution_time_hours, c_sla.resolution_time_hours) AS sla_resolution_hours,
        COALESCE(si_sla.escalation_time_hours, sc_sla.escalation_time_hours, c_sla.escalation_time_hours) AS sla_escalation_hours
      FROM tickets t
      LEFT JOIN categories     c      ON t.category_id     = c.id
      LEFT JOIN sub_categories sc     ON t.sub_category_id = sc.id
      LEFT JOIN sub_items      si     ON t.sub_item_id     = si.id
      LEFT JOIN users          u2     ON t.assigned_to     = u2.id
      LEFT JOIN service_areas  sa     ON t.service_area_id = sa.id
      LEFT JOIN sla_rules      c_sla  ON c.sla_rule_id     = c_sla.id
      LEFT JOIN sla_rules      sc_sla ON sc.sla_rule_id    = sc_sla.id
      LEFT JOIN sla_rules      si_sla ON si.sla_rule_id    = si_sla.id
      WHERE DATE(t.created_at) BETWEEN ? AND ?
        AND t.status <> 'Cancelled'
        ${staffClause}
        ${statusClause}
        ${selectedServiceAreaClause}
        ${serviceAreaClause}
      ORDER BY t.created_at DESC
    `, params);

    res.json(rows);
  } catch (err) {
    console.error('Report error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        t.*,
        c.name       AS category,
        sc.name      AS sub_category,
        si.name      AS sub_item,
        t.requestor_name AS requestor,
        u2.full_name AS assigned_to
      FROM tickets t
      LEFT JOIN categories     c  ON t.category_id     = c.id
      LEFT JOIN sub_categories sc ON t.sub_category_id = sc.id
      LEFT JOIN sub_items      si ON t.sub_item_id     = si.id
      LEFT JOIN users          u2 ON t.assigned_to     = u2.id
      WHERE t.id = ?
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET ticket error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET requestor info for CSM
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/requestor-info', async (req, res) => {
  try {
    // ── Step 1: Get ticket info from ICTMS DB ──
    const [rows] = await db.query(`
      SELECT 
        t.id,
        t.ticket_number,
        t.empno               AS requestor_empno,
        t.requestor_name,
        t.division            AS requestor_division,
        t.unit                AS requestor_unit,
        t.office_location     AS requestor_office_location,
        COALESCE(
          (SELECT ta.full_name FROM ticket_assignees ta
           WHERE ta.ticket_id = t.id AND ta.role = 'primary'
           ORDER BY ta.assigned_at ASC LIMIT 1),
          u2.full_name
        ) AS assigned_to_name
      FROM tickets t
      LEFT JOIN users u2 ON t.assigned_to = u2.id
      WHERE t.id = ?
    `, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found.' });
    }

    const ticket = rows[0];

    // ── Step 2: Enrich with ERM data (age, sex, mobile, email) ──
    if (ticket.requestor_empno) {
      try {
        const emp = await harmonyApi.getEmployeeByEmpno(ticket.requestor_empno);
        const empData = emp?.data || emp;
        const transformed = harmonyApi.transformEmployeeResponse(empData?.user || empData);
        if (transformed) {
          ticket.requestor_age    = transformed.age    ?? null;
          ticket.requestor_sex    = transformed.sex    ?? null;
          ticket.requestor_mobile = transformed.mobile || null;
          ticket.requestor_email  = transformed.email  || null;
        }
      } catch (ermErr) {
        console.warn('ERM enrichment failed:', ermErr.message);
      }
    }

    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ─────────────────────────────────────────────────────────────────────────────
// POST create ticket  →  EMAIL #1: Ticket Submitted
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', authMiddleware, ticketUpload.array('attachments', 5), async (req, res) => {
  try {
    const {
      subject, description, priority,
      category_id, service_area_id, sub_category_id, sub_item_id,
      empno, requestor_name, unit, division, office_location,
    } = req.body;
    const submitterEmpno = req.user.empno;
    const submitterName = req.user.full_name;
    if ((req.files || []).length && !isObjectStorageConfigured()) {
      return res.status(503).json({ error: 'Attachments are temporarily unavailable. Configure OBJECT_STORAGE_API_KEY in backend/.env and restart the backend.' });
    }
    for (const file of req.files || []) assertValidTicketAttachment(file);

    // Preserve the responsible service area on the ticket at submission time.
    // This keeps historical routing correct even if a category is moved later.
    let serviceAreaId = null;
    if (category_id) {
      const [categoryRows] = await db.query(
        `SELECT c.service_area_id, sa.code AS service_area_code
         FROM categories c JOIN service_areas sa ON sa.id = c.service_area_id
         WHERE c.id = ?`,
        [category_id]
      );
      if (!categoryRows.length) return res.status(400).json({ error: 'The selected category does not exist.' });
      serviceAreaId = categoryRows[0]?.service_area_id || null;
      var serviceAreaCode = String(categoryRows[0]?.service_area_code || '').trim().toUpperCase();
    }
    if (!serviceAreaId) return res.status(400).json({ error: 'Select a category assigned to an active service area.' });
    if (service_area_id && Number(service_area_id) !== Number(serviceAreaId)) {
      return res.status(400).json({ error: 'The selected category does not belong to the selected service area.' });
    }
    if (!serviceAreaCode) return res.status(400).json({ error: 'The selected service area has no service code.' });

    const currentYear = new Date().getFullYear();
    const prefix = `TKT-${serviceAreaCode}-${currentYear}-`;
    const [last] = await db.query(
      `SELECT ticket_number FROM tickets
       WHERE ticket_number LIKE ?
       ORDER BY CAST(SUBSTRING_INDEX(ticket_number, '-', -1) AS UNSIGNED) DESC
       LIMIT 1`,
      [`${prefix}%`]
    );
    const lastNum = last.length ? parseInt(last[0].ticket_number.split('-').pop(), 10) : 0;
    const ticket_number = `${prefix}${String(lastNum + 1).padStart(6, '0')}`;

    const attachments = [];
    let result;
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      [result] = await connection.query(
        `INSERT INTO tickets
          (ticket_number, subject, description, priority,
           category_id, service_area_id, sub_category_id, sub_item_id,
           empno, requestor_name, unit, division, office_location, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open')`,
        [ticket_number, subject, description, priority, category_id, serviceAreaId,
          sub_category_id || null, sub_item_id || null, submitterEmpno || null,
          submitterName || requestor_name || null, unit || null, division || null, office_location || null]
      );
      for (const file of req.files || []) {
        const uploaded = await uploadTicketAttachment(file, ticket_number);
        await connection.query(`INSERT INTO ticket_attachments (ticket_id, storage_bucket, object_key, original_filename, content_type, file_size, etag) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [result.insertId, uploaded.bucket || process.env.OBJECT_STORAGE_BUCKET || 'servicedesk-staging', uploaded.key, uploaded.original_filename || file.originalname, uploaded.content_type || file.mimetype, uploaded.size || file.size, uploaded.etag || null]);
        attachments.push({ key: uploaded.key, original_filename: uploaded.original_filename || file.originalname });
      }
      await connection.commit();
    } catch (submissionError) {
      await connection.rollback();
      throw submissionError;
    } finally {
      connection.release();
    }

    // ── EMAIL #1: Ticket Submitted ────────────────────────
    try {
      let requesterEmail = null;
      try {
        const emp = await harmonyApi.getEmployeeByEmpno(submitterEmpno);
        const empData = emp?.data || emp;
        requesterEmail = empData?.email || empData?.user?.email || null;
      } catch (e) { console.warn('Harmony email lookup failed:', e.message); }

      if (requesterEmail?.includes('@')) {
        // Fire and forget — don't block response
        setImmediate(async () => { try {
        const emailResult = await sendEmail({
          to:      requesterEmail,
          subject: `[${ticket_number}] ${subject}`,
          html: emailWrapper(
            `✅ Ticket Submitted — ${ticket_number}`, '#0D3B6E',
            `<p>Dear <strong>${requestor_name || 'Requestor'}</strong>,</p>
             <p>Your IT support ticket has been successfully submitted.
                Our ICTMS team will review and assign it shortly.</p>
             ${ticketInfoHtml(ticket_number, subject, [
               ['Status',   'Open'],
               ['Priority', priority],
               ['Division', division || '—'],
               ['Unit',     unit     || '—'],
             ])}
             <p>You will receive email updates as the ticket progresses.
                Please do not submit a duplicate request.</p>`
          ),
        });

        await db.query(
          `INSERT INTO ticket_email_threads (ticket_id, requester_email, email_message_id)
           VALUES (?, ?, ?)`,
          [result.insertId, requesterEmail, emailResult.messageId]
        );
        } catch(e){ console.error('EMAIL ERROR (submit bg):', e.message); }
        }); // end setImmediate
      }
    } catch (emailErr) {
      console.error('EMAIL ERROR (submit):', emailErr.message);
    }

    res.status(201).json({
      message: 'Ticket created successfully',
      ticket_number,
      id: result.insertId,
      attachments,
    });
  } catch (err) {
    res.status(err.code === 'OBJECT_STORAGE_NOT_CONFIGURED' ? 503 : err.code === 'INVALID_ATTACHMENT_CONTENT' ? 400 : 500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH assign  →  EMAIL #2: Assigned  |  EMAIL #3: Reassigned
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/assign', authMiddleware, async (req, res) => {
  try {
    const { assigned_to, empno, assigner_name } = req.body;
    const managedAreaIds = await adminAreaIds(req.user);
    const isServiceAdmin = req.user.role !== 'super_admin' && managedAreaIds.length > 0;
    if (!['super_admin', 'ictms_staff'].includes(req.user.role) && !isServiceAdmin) return res.status(403).json({ error: 'Ticket assignment access is required.' });

    if (!assigned_to) return res.status(400).json({ error: 'assigned_to is required.' });

    const [prevRows] = await db.query(`
      SELECT
        t.status,
        t.service_area_id,
        t.empno         AS requestor_empno,
        t.ticket_number,
        t.subject,
        u.full_name     AS prev_assignee_name
      FROM tickets t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.id = ?
    `, [req.params.id]);

    if (prevRows.length === 0) return res.status(404).json({ error: 'Ticket not found.' });
    if (isServiceAdmin && !managedAreaIds.includes(Number(prevRows[0].service_area_id))) return res.status(403).json({ error: 'You can assign tickets in your service area only.' });
    if (!prevRows[0].service_area_id) return res.status(400).json({ error: 'This ticket has no service area. Assign a service area before assigning staff.' });

    const [newUserRows] = await db.query(
      `SELECT u.id, u.full_name, u.empno FROM users u
       JOIN user_service_roles usr ON usr.user_id = u.id
       JOIN service_areas sa ON sa.id = usr.service_area_id
       WHERE u.id = ? AND u.deleted_at IS NULL AND usr.is_active = 1 AND sa.is_active = 1
         AND usr.service_area_id = ? AND usr.service_role IN ('admin', 'supervisor', 'technical_staff')`,
      [assigned_to, prevRows[0].service_area_id]
    );
    if (newUserRows.length === 0) return res.status(404).json({ error: 'Selected staff not found.' });

    const newAssignee    = newUserRows[0];
    const requestorEmpno = prevRows[0].requestor_empno;

    if (newAssignee.empno === requestorEmpno) {
      return res.status(400).json({ error: 'Ticket cannot be assigned to the requestor.' });
    }

    const prevAssignee = prevRows[0].prev_assignee_name;
    const isReassign   = !!prevAssignee;
    const ticket       = prevRows[0];

    await db.query(
      `UPDATE tickets
       SET assigned_to = ?, status = 'Assigned',
           assigned_at = COALESCE(assigned_at, NOW()),
            first_response_at = COALESCE(first_response_at, NOW()),
            total_hold_seconds = COALESCE(total_hold_seconds, 0)
              + CASE
                  WHEN hold_started_at IS NOT NULL
                  THEN TIMESTAMPDIFF(SECOND, hold_started_at, NOW())
                  ELSE 0
                END,
            hold_started_at = NULL
       WHERE id = ?`,
      [assigned_to, req.params.id]
    );

    const commentText = isReassign
      ? `[REASSIGNED] Ticket reassigned from ${prevAssignee} to ${newAssignee.full_name} by ${assigner_name || 'Admin'}.`
      : `[ASSIGNED] Ticket assigned to ${newAssignee.full_name} by ${assigner_name || 'Admin'}.`;

    await db.query(
      'INSERT INTO comments (ticket_id, empno, content) VALUES (?, ?, ?)',
      [req.params.id, empno || 'system', commentText]
    );

    // ── EMAIL #2 / #3 ─────────────────────────────────────
    try {
      if (isReassign) {
        sendTicketEmail(req.params.id, {
          html: emailWrapper(
            `🔄 Ticket Reassigned — ${ticket.ticket_number}`, '#1A5490',
            `<p>Your ticket has been <strong>reassigned</strong> to a new ICTMS Technical Staff.</p>
             ${ticketInfoHtml(ticket.ticket_number, ticket.subject, [
               ['Previously Assigned To', prevAssignee],
               ['Now Assigned To',        newAssignee.full_name],
               ['Reassigned By',          assigner_name || 'Admin'],
             ])}
             <p>Our team will continue working on your concern without interruption.</p>`
          ),
        });
      } else {
        sendTicketEmail(req.params.id, {
          html: emailWrapper(
            `👤 Ticket Assigned — ${ticket.ticket_number}`, '#1A5490',
            `<p>Your ticket has been <strong>assigned</strong> to an ICTMS Technical Staff.</p>
             ${ticketInfoHtml(ticket.ticket_number, ticket.subject, [
               ['Assigned To', newAssignee.full_name],
               ['Assigned By', assigner_name || 'Admin'],
             ])}
             <p>We will begin working on your concern shortly.
                You will be notified when the status changes.</p>`
          ),
        });
      }
    } catch (emailErr) {
      console.error('EMAIL ERROR (assign):', emailErr.message);
    }

    res.json({ message: isReassign ? 'Ticket reassigned.' : 'Ticket assigned.' });
  } catch (err) {
    console.error('Assign error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH status  →  EMAIL #4 In Progress | #5 On-Hold | #6 Resolved | #7 Cancelled
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, cancel_reason, empno, user_name, resolution_details } = req.body;

    const allowed = ['In Progress', 'On-Hold', 'Resolved', 'Cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    if (status === 'Cancelled' && !cancel_reason?.trim()) {
      return res.status(400).json({ error: 'Cancellation reason is required.' });
    }

    // ── SLA PAUSE / RESUME LOGIC ─────────────────────────
    if (status === 'On-Hold') {
      // Record the time the ticket was placed on hold
      await db.query(
        `UPDATE tickets
         SET status = ?, cancel_reason = ?, hold_started_at = NOW(),
             escalation_started_at = COALESCE(escalation_started_at, NOW())
         WHERE id = ?`,
        [status, cancel_reason || null, req.params.id]
      );
    } else if (status === 'In Progress') {
      // Accumulate the hold duration and clear hold_started_at
      await db.query(`
        UPDATE tickets
        SET
          status          = ?,
          cancel_reason   = ?,
          total_hold_seconds = COALESCE(total_hold_seconds, 0)
                             + CASE
                                 WHEN hold_started_at IS NOT NULL
                                 THEN TIMESTAMPDIFF(SECOND, hold_started_at, NOW())
                                 ELSE 0
                               END,
          hold_started_at = NULL
        WHERE id = ?
      `, [status, cancel_reason || null, req.params.id]);
    } else {
      // Resolved / Cancelled — also accumulate any open hold before closing
      await db.query(`
        UPDATE tickets
        SET
          status          = ?,
          cancel_reason   = ?,
          total_hold_seconds = COALESCE(total_hold_seconds, 0)
                             + CASE
                                 WHEN hold_started_at IS NOT NULL
                                 THEN TIMESTAMPDIFF(SECOND, hold_started_at, NOW())
                                 ELSE 0
                               END,
          hold_started_at = NULL,
          resolved_at = CASE WHEN ? = 'Resolved' THEN COALESCE(resolved_at, NOW()) ELSE resolved_at END
        WHERE id = ?
      `, [status, cancel_reason || null, status, req.params.id]);
    }

    const [tRows] = await db.query(
      'SELECT ticket_number, subject FROM tickets WHERE id = ?',
      [req.params.id]
    );
    const t = tRows[0];

    // ── EMAIL #4: In Progress ─────────────────────────────
    if (status === 'In Progress') {
      try {
        sendTicketEmail(req.params.id, {
          html: emailWrapper(
            `🔧 Ticket In Progress — ${t.ticket_number}`, '#5B21B6',
            `<p>Good news! Your ticket is now being actively worked on by our ICTMS team.</p>
             ${ticketInfoHtml(t.ticket_number, t.subject, [
               ['Status',     'In Progress'],
               ['Handled By', user_name || 'ICTMS Staff'],
             ])}
             <p>We will notify you once the issue has been resolved.</p>`
          ),
        });
      } catch (emailErr) {
        console.error('EMAIL ERROR (in-progress):', emailErr.message);
      }
    }

    // ── EMAIL #5: On-Hold ─────────────────────────────────
    if (status === 'On-Hold') {
      try {
        sendTicketEmail(req.params.id, {
          html: emailWrapper(
            `⏸ Ticket On-Hold — ${t.ticket_number}`, '#CC7700',
            `<p>Your ticket has been placed <strong>On-Hold</strong> by ICTMS.</p>
             ${ticketInfoHtml(t.ticket_number, t.subject, [
               ['Status',     'On-Hold'],
               ['Handled By', user_name || 'ICTMS Staff'],
             ])}
             <p>This may be due to pending requirements, parts, or system access.
                We will resume as soon as conditions allow and notify you of any update.</p>`
          ),
        });
      } catch (emailErr) {
        console.error('EMAIL ERROR (on-hold):', emailErr.message);
      }
    }

    // ── EMAIL #6: Resolved ────────────────────────────────
    if (status === 'Resolved') {
      const resolutionComment = [
        `[RESOLVED] Ticket resolved by ${user_name || 'ICTMS Staff'}`,
        `Resolution Details:\n${resolution_details || 'No resolution details provided.'}`,
        `Please accomplish the Client Satisfaction Measurement (CSM) Form to formally close this ticket.`,
      ].join('\n\n');

      await db.query(
        'INSERT INTO comments (ticket_id, empno, content) VALUES (?, ?, ?)',
        [req.params.id, empno || 'system', resolutionComment]
      );

      try {
        sendTicketEmail(req.params.id, {
          html: emailWrapper(
            `✅ Ticket Resolved — ${t.ticket_number}`, '#1B6B3A',
            `<p>Great news! Your ticket has been <strong>resolved</strong>.</p>
             ${ticketInfoHtml(t.ticket_number, t.subject, [
               ['Status',             'Resolved'],
               ['Resolved By',        user_name || 'ICTMS Staff'],
               ['Resolution Details', resolution_details || 'No resolution details provided.'],
             ])}
             <div style="background:#FEF3DC;border-left:4px solid #CC7700;
                         padding:12px;margin:16px 0;border-radius:4px;">
               <strong>⚠ Action Required — CSMF</strong><br>
               Please fill out the <strong>Client Satisfaction Measurement Form (CSMF)</strong>
               to formally close this ticket and help us improve our services.<br><br>
               Log in to the <strong>ICTMS Portal</strong> and go to
               <strong>Ticket List & Tracking</strong> to access the CSMF button.
             </div>
             <p>Thank you for using the DSWD ICTMS Help Desk.</p>`
          ),
        });
      } catch (emailErr) {
        console.error('EMAIL ERROR (resolved):', emailErr.message);
      }
    }

    // ── EMAIL #7: Cancelled ───────────────────────────────
    if (status === 'Cancelled') {
      try {
        sendTicketEmail(req.params.id, {
          html: emailWrapper(
            `❌ Ticket Cancelled — ${t.ticket_number}`, '#8B1A1A',
            `<p>Your ticket has been <strong>cancelled</strong> by ICTMS Staff.</p>
             ${ticketInfoHtml(t.ticket_number, t.subject, [
               ['Status',              'Cancelled'],
               ['Cancelled By',        user_name || 'ICTMS Staff'],
               ['Cancellation Reason', cancel_reason || '—'],
             ])}
             <p>If you believe this was cancelled in error or you still need assistance,
                please submit a new ticket through the ICTMS Portal.</p>`
          ),
        });
      } catch (emailErr) {
        console.error('EMAIL ERROR (cancelled):', emailErr.message);
      }
    }

    res.json({ message: `Ticket marked as ${status}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH cancel by DSWD Staff (requestor)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/cancel', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT status FROM tickets WHERE id = ?', [req.params.id]);
    if (rows.length === 0)       return res.status(404).json({ error: 'Ticket not found.' });
    if (rows[0].status !== 'Open') return res.status(400).json({ error: 'Only Open tickets can be cancelled.' });

    await db.query(
      `UPDATE tickets SET status = 'Cancelled', cancel_reason = 'Cancelled by requestor.' WHERE id = ?`,
      [req.params.id]
    );
    res.json({ message: 'Ticket cancelled.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH generic update — MUST be before reclassify
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const { status, assigned_to } = req.body;
    if (assigned_to) {
      const [staff] = await db.query(
        "SELECT id FROM users WHERE id = ? AND role IN ('ictms_staff', 'super_admin') AND deleted_at IS NULL",
        [assigned_to]
      );
      if (!staff.length) return res.status(400).json({ error: 'Selected staff is not active or assignable.' });
    }
    await db.query(`
      UPDATE tickets
      SET status = ?, assigned_to = ?,
          assigned_at = CASE WHEN ? IS NOT NULL THEN COALESCE(assigned_at, NOW()) ELSE assigned_at END,
          first_response_at = CASE WHEN ? IS NOT NULL THEN COALESCE(first_response_at, NOW()) ELSE first_response_at END,
          resolved_at = CASE WHEN ? = 'Resolved' THEN COALESCE(resolved_at, NOW()) ELSE resolved_at END
      WHERE id = ?
    `, [status, assigned_to, assigned_to, assigned_to, status, req.params.id]);
    res.json({ message: 'Ticket updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH reclassify  →  EMAIL #8: Reclassified
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/reclassify', async (req, res) => {
  try {
    const {
      category_id, sub_category_id, sub_item_id,
      priority, reason, empno, user_name,
    } = req.body;

    if (!reason?.trim()) return res.status(400).json({ error: 'Reclassification reason is required.' });

    const [old] = await db.query(`
      SELECT
        t.priority,
        c.name  AS category,
        sc.name AS sub_category,
        si.name AS sub_item
      FROM tickets t
      LEFT JOIN categories     c  ON t.category_id     = c.id
      LEFT JOIN sub_categories sc ON t.sub_category_id = sc.id
      LEFT JOIN sub_items      si ON t.sub_item_id     = si.id
      WHERE t.id = ?
    `, [req.params.id]);

    if (old.length === 0) return res.status(404).json({ error: 'Ticket not found.' });

    const prev = old[0];

    const [newCat]  = category_id     ? await db.query('SELECT name FROM categories WHERE id=?',     [category_id])     : [[{ name: prev.category }]];
    const [newSub]  = sub_category_id ? await db.query('SELECT name FROM sub_categories WHERE id=?', [sub_category_id]) : [[{ name: prev.sub_category }]];
    const [newItem] = sub_item_id     ? await db.query('SELECT name FROM sub_items WHERE id=?',      [sub_item_id])     : [[{ name: prev.sub_item }]];

    await db.query(`
      UPDATE tickets SET
        category_id     = COALESCE(?, category_id),
        sub_category_id = ?,
        sub_item_id     = ?,
        priority        = COALESCE(?, priority)
      WHERE id = ?
    `, [
      category_id     || null,
      sub_category_id || null,
      sub_item_id     || null,
      priority        || null,
      req.params.id,
    ]);

    const changes = [];
    if (priority && priority !== prev.priority)
      changes.push(`Priority: ${prev.priority} → ${priority}`);
    if (newCat[0]?.name  && newCat[0].name  !== prev.category)
      changes.push(`Category: ${prev.category} → ${newCat[0].name}`);
    if (newSub[0]?.name  !== prev.sub_category)
      changes.push(`Sub-Category: ${prev.sub_category || 'None'} → ${newSub[0]?.name  || 'None'}`);
    if (newItem[0]?.name !== prev.sub_item)
      changes.push(`Sub-Item: ${prev.sub_item || 'None'} → ${newItem[0]?.name || 'None'}`);

    const commentContent = [
      `[RECLASSIFIED] Ticket reclassified by ${user_name}.`,
      changes.length > 0 ? `Changes: ${changes.join(' | ')}` : '',
      `Reason: ${reason}`,
    ].filter(Boolean).join('\n');

    await db.query(
      'INSERT INTO comments (ticket_id, empno, content) VALUES (?, ?, ?)',
      [req.params.id, empno, commentContent]
    );

    // ── EMAIL #8: Reclassified ────────────────────────────
    try {
      const [tRows] = await db.query(
        'SELECT ticket_number, subject FROM tickets WHERE id = ?',
        [req.params.id]
      );
      const t = tRows[0];

      sendTicketEmail(req.params.id, {
        html: emailWrapper(
          `📋 Ticket Reclassified — ${t.ticket_number}`, '#0D3B6E',
          `<p>Your ticket has been <strong>reclassified</strong> by ICTMS to better route your concern.</p>
           ${ticketInfoHtml(t.ticket_number, t.subject,
             changes.length > 0
               ? [
                   ['Changes Made',      changes.join('<br>')],
                   ['Reason',            reason],
                   ['Reclassified By',   user_name || 'ICTMS Staff'],
                 ]
               : [
                   ['Reason',            reason],
                   ['Reclassified By',   user_name || 'ICTMS Staff'],
                 ]
           )}
           <p>This update ensures your ticket is properly categorized for the fastest possible resolution.</p>`
        ),
      });
    } catch (emailErr) {
      console.error('EMAIL ERROR (reclassify):', emailErr.message);
    }

    res.json({ message: 'Ticket reclassified successfully.' });
  } catch (err) {
    console.error('Reclassify error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET comments for a ticket
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/comments', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.id, c.empno, c.content, c.created_at
      FROM comments c
      WHERE c.ticket_id = ?
      ORDER BY c.created_at ASC
    `, [req.params.id]);

    // Bulk fetch employee names via Harmony API
    const empnos = [...new Set(rows.map(r => r.empno).filter(Boolean))];
    const nameMap = {};
    if (empnos.length > 0) {
      try {
        const bulk = await harmonyApi.getEmployeesBulk(empnos);
        const bulkData = bulk?.data || bulk || [];
        const list = Array.isArray(bulkData) ? bulkData : (bulkData.employees || []);
        list.forEach(e => {
          const d = e?.user || e;
          if (d?.empno) {
            nameMap[d.empno] = harmonyApi.formatEmployeeName(d);
          }
        });
      } catch (e) { console.warn('Harmony bulk lookup failed:', e.message); }
    }
    for (const row of rows) {
      row.full_name = nameMap[row.empno] || row.empno || 'Unknown User';
    }

    res.json(rows);
  } catch (err) {
    console.error('GET comments error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST comment (sends threaded email update)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/comments', async (req, res) => {
  try {
    const { content, empno } = req.body;

    if (!content?.trim()) return res.status(400).json({ error: 'Comment content is required.' });
    if (!empno)           return res.status(400).json({ error: 'empno is required.' });

    await db.query(
      'INSERT INTO comments (ticket_id, empno, content) VALUES (?, ?, ?)',
      [req.params.id, empno, content]
    );

    // The first response is the earliest ICTMS user comment or assignment.
    await db.query(`
      UPDATE tickets t
      JOIN users u ON u.empno = ? AND u.role IN ('super_admin', 'supervisor', 'ictms_staff') AND u.deleted_at IS NULL
      SET t.first_response_at = COALESCE(t.first_response_at, NOW())
      WHERE t.id = ?
    `, [empno, req.params.id]);

    // Threaded email for manual comments
    try {
      const [threadRows] = await db.query(
        'SELECT * FROM ticket_email_threads WHERE ticket_id = ? LIMIT 1',
        [req.params.id]
      );

      if (threadRows.length > 0) {
        const thread = threadRows[0];
        const [tRows] = await db.query(
          'SELECT ticket_number, subject FROM tickets WHERE id = ?',
          [req.params.id]
        );
        const ticket = tRows[0];

        await sendEmail({
          to:         thread.requester_email,
          subject:    `Re: [${ticket.ticket_number}] ${ticket.subject}`,
          inReplyTo:  thread.email_message_id,
          references: thread.email_message_id,
          html: emailWrapper(
            `💬 Ticket Update — ${ticket.ticket_number}`, '#0D3B6E',
            `<p>A new update has been added to your ticket.</p>
             ${ticketInfoHtml(ticket.ticket_number, ticket.subject)}
             <div style="background:#f0f4f8;border-left:4px solid #0D3B6E;
                         padding:12px;margin:12px 0;border-radius:4px;">
               <strong>Update:</strong><br>${content}
             </div>`
          ),
        });
      }
    } catch (emailErr) {
      console.error('EMAIL ERROR (comment):', emailErr.message);
    }

    res.status(201).json({ message: 'Comment posted.' });
  } catch (err) {
    console.error('POST comment error:', err.message);
    res.status(500).json({ error: err.message });
  }
});



// ─── ADD co-assignee to a ticket ──────────────────────────
router.post('/:id/assignees', authMiddleware, async (req, res) => {
  try {
    const { user_id, empno, full_name, assigned_by_empno, assigner_name } = req.body;
    const managedAreaIds = await adminAreaIds(req.user);
    const isServiceAdmin = req.user.role !== 'super_admin' && managedAreaIds.length > 0;
    if (!['super_admin', 'ictms_staff'].includes(req.user.role) && !isServiceAdmin) {
      return res.status(403).json({ error: 'Ticket assignment access is required.' });
    }

    if (!user_id || !full_name) {
      return res.status(400).json({ error: 'user_id and full_name are required.' });
    }
    // Check if already a co-assignee
    const [existing] = await db.query(
      'SELECT id FROM ticket_assignees WHERE ticket_id = ? AND user_id = ?',
      [req.params.id, user_id]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: `${full_name} is already a co-assignee on this ticket.` });
    }

    // Get ticket info
    const [ticketRows] = await db.query(
      'SELECT empno, assigned_to, service_area_id, ticket_number, subject FROM tickets WHERE id = ?',
      [req.params.id]
    );
    const ticket = ticketRows[0];
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });
    if (isServiceAdmin && !managedAreaIds.includes(Number(ticket.service_area_id))) {
      return res.status(403).json({ error: 'You can manage co-assignees in your service area only.' });
    }
    if (!ticket.service_area_id) return res.status(400).json({ error: 'This ticket has no service area. Assign a service area before assigning staff.' });
    const [activeStaff] = await db.query(
      `SELECT u.id FROM users u
       JOIN user_service_roles usr ON usr.user_id = u.id
       JOIN service_areas sa ON sa.id = usr.service_area_id
       WHERE u.id = ? AND u.deleted_at IS NULL AND usr.is_active = 1 AND sa.is_active = 1
         AND usr.service_area_id = ? AND usr.service_role IN ('admin', 'supervisor', 'technical_staff')`,
      [user_id, ticket.service_area_id]
    );
    if (!activeStaff.length) return res.status(400).json({ error: 'Selected staff is not active or assignable.' });

    // Prevent assigning the requestor
    if (ticket.empno === empno) {
      return res.status(400).json({ error: 'Cannot assign the requestor as a co-assignee.' });
    }

    // ✅ Prevent assigning the primary assignee (check tickets.assigned_to)
    if (Number(ticket.assigned_to) === Number(user_id)) {
      return res.status(400).json({ error: 'This staff is already the primary assignee of this ticket.' });
    }

    // ✅ Only co-assignees go into ticket_assignees
    await db.query(
      `INSERT INTO ticket_assignees
        (ticket_id, user_id, empno, full_name, role, assigned_by)
       VALUES (?, ?, ?, ?, 'co-assignee', ?)`,
      [
        req.params.id,
        Number(user_id),
        empno  || '',          // ✅ fallback to empty string if empno missing
        full_name,
        assigner_name || 'Admin',
      ]
    );

    // Auto-comment
    await db.query(
      'INSERT INTO comments (ticket_id, empno, content) VALUES (?, ?, ?)',
      [
        req.params.id,
        assigned_by_empno || 'system',
        `[CO-ASSIGNED] ${full_name} added as co-assignee by ${assigner_name || 'Admin'}.`,
      ]
    );

    res.json({ message: `${full_name} added as co-assignee.` });

    // Background email
    sendTicketEmail(req.params.id, {
      html: emailWrapper(
        `👥 You've Been Added as Co-Assignee — ${ticket.ticket_number}`, '#1A5490',
        `<p>You have been added as a <strong>co-assignee</strong> on this ticket.</p>
         ${ticketInfoHtml(ticket.ticket_number, ticket.subject, [
           ['Your Role',  'Co-Assignee'],
           ['Added By',   assigner_name || 'Admin'],
         ])}
         <p>Please coordinate with the primary assignee and post updates in the comments.</p>`
      ),
    }).catch(console.error);

  } catch (err) {
    console.error('POST co-assignee error:', err.message);  // ✅ log real error
    res.status(500).json({ error: err.message });
  }
});

// ─── REMOVE co-assignee from a ticket ─────────────────────
router.delete('/:id/assignees/:userId', authMiddleware, async (req, res) => {
  try {
    const managedAreaIds = await adminAreaIds(req.user);
    const isServiceAdmin = req.user.role !== 'super_admin' && managedAreaIds.length > 0;
    if (!['super_admin', 'ictms_staff'].includes(req.user.role) && !isServiceAdmin) {
      return res.status(403).json({ error: 'Ticket assignment access is required.' });
    }
    const [ticketRows] = await db.query('SELECT service_area_id FROM tickets WHERE id = ?', [req.params.id]);
    if (!ticketRows.length) return res.status(404).json({ error: 'Ticket not found.' });
    if (isServiceAdmin && !managedAreaIds.includes(Number(ticketRows[0].service_area_id))) {
      return res.status(403).json({ error: 'You can manage co-assignees in your service area only.' });
    }
    const [rows] = await db.query(
      'SELECT * FROM ticket_assignees WHERE ticket_id = ? AND user_id = ?',
      [req.params.id, req.params.userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Assignee not found.' });
    }
    if (rows[0].role === 'primary') {
      return res.status(400).json({
        error: 'Cannot remove the primary assignee. Use reassign instead.'
      });
    }

    await db.query(
      'DELETE FROM ticket_assignees WHERE ticket_id = ? AND user_id = ?',
      [req.params.id, req.params.userId]
    );

    const { full_name } = rows[0];
    const { removed_by, remover_name } = req.body;

    await db.query(
      'INSERT INTO comments (ticket_id, empno, content) VALUES (?, ?, ?)',
      [
        req.params.id,
        removed_by || 'system',
        `[CO-ASSIGNEE REMOVED] ${full_name} removed from co-assignees by ${remover_name || 'Admin'}.`,
      ]
    );

    res.json({ message: `${full_name} removed from co-assignees.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ticket attachments. The browser receives only the temporary URL returned
// by object storage; the permanent object key remains in the database.
router.get('/:id/attachments', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, storage_bucket, original_filename, content_type, file_size, object_key, created_at
       FROM ticket_attachments WHERE ticket_id = ? ORDER BY id`,
      [req.params.id]
    );
    const attachments = await Promise.all(rows.map(async attachment => {
      try {
        return {
          ...attachment,
          storage_download_url: await getPresignedDownloadUrl(attachment.storage_bucket, attachment.object_key),
        };
      } catch (err) {
        // Keep the attachment visible even when storage cannot issue a new
        // temporary link (for example, while its endpoint is unavailable).
        return { ...attachment, storage_download_url: null };
      }
    }));
    res.json(attachments);
  } catch (err) {
    res.status(500).json({ error: 'Unable to load ticket attachments.' });
  }
});

// Stream through the application server so storage-host CORS and frame policies
// do not prevent previews in the ticket modal.
router.get('/:id/attachments/:attachmentId/content', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT storage_bucket, object_key, original_filename, content_type
       FROM ticket_attachments WHERE id = ? AND ticket_id = ? LIMIT 1`,
      [req.params.attachmentId, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Attachment not found.' });
    const attachment = rows[0];
    const url = await getPresignedDownloadUrl(attachment.storage_bucket, attachment.object_key);
    const fileResponse = await axios.get(url, { responseType: 'stream', timeout: 60000 });
    res.setHeader('Content-Type', attachment.content_type || fileResponse.headers['content-type'] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${String(attachment.original_filename).replace(/"/g, '')}"`);
    fileResponse.data.pipe(res);
  } catch (err) {
    res.status(502).json({ error: 'Unable to retrieve attachment preview.' });
  }
});

// GET ticket assignees (primary + co-assignees)
router.get('/:id/assignees', async (req, res) => {
  try {
    // ✅ Get primary from tickets table
    const [ticketRows] = await db.query(`
      SELECT 
        t.assigned_to  AS user_id,
        u.empno,
        u.full_name,
        t.updated_at   AS assigned_at
      FROM tickets t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.id = ?
    `, [req.params.id]);

    // ✅ Get co-assignees from ticket_assignees (role = 'co-assignee' only)
    const [coRows] = await db.query(`
      SELECT 
        ta.id, ta.user_id, ta.empno,
        ta.full_name, ta.role,
        ta.assigned_at, ta.assigned_by
      FROM ticket_assignees ta
      WHERE ta.ticket_id = ?
        AND ta.role = 'co-assignee'
      ORDER BY ta.assigned_at ASC
    `, [req.params.id]);

    // ✅ Build final list — primary first, then co-assignees
    const result = [];

    const primary = ticketRows[0];
    if (primary?.user_id && primary?.full_name) {
      result.push({
        id:          null,
        user_id:     primary.user_id,
        empno:       primary.empno   || '',
        full_name:   primary.full_name,
        role:        'primary',
        assigned_at: primary.assigned_at,
        assigned_by: null,
      });
    }

    result.push(...coRows);

    res.json(result);
  } catch (err) {
    console.error('GET assignees error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;
