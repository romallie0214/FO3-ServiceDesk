const express = require('express');
const router  = express.Router();
const db      = require('../db');
const harmonyApi = require('../HarmonyApiClient');
const { sendEmail } = require('../services/emailService');
const auth = require('../middleware/auth');
const { adminAreaIds } = require('../services/serviceAreaAccess');

// ─────────────────────────────────────────────────────────────────────────────
// GET all CSM responses — JOIN tickets for missing fields
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const areaIds = await adminAreaIds(req.user);
    const isServiceAdmin = req.user?.role !== 'super_admin' && areaIds.length > 0;
    const serviceScope = isServiceAdmin ? `WHERE t.service_area_id IN (${areaIds.map(() => '?').join(',')})` : '';
    const [rows] = await db.query(`
      SELECT 
        cr.*,
        t.ticket_number,
        t.subject,
        t.service_area_id,
        sa.code          AS service_area_code,
        sa.name          AS service_area_name,
        c.name          AS category,
        t.requestor_name,
        t.division      AS requestor_division,
        (SELECT COUNT(*) FROM ticket_assignees ta 
         WHERE ta.ticket_id = cr.ticket_id
           AND ta.role = 'co-assignee') AS co_assignee_count
      FROM csm_responses cr
      JOIN tickets t         ON cr.ticket_id  = t.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN service_areas sa ON sa.id = t.service_area_id
      ${serviceScope}
      ORDER BY cr.submitted_at DESC
    `, isServiceAdmin ? areaIds : []);

    const result = rows.map(r => {
      const officerStr     = r.attending_officer || '';
      const hasComma       = officerStr.includes(',');
      const hasCoAssignees = Number(r.co_assignee_count) > 0;

      return {
        ...r,
        is_team:          hasComma || hasCoAssignees,   // ✅ reliable detection
        co_assignee_count: Number(r.co_assignee_count),
      };
    });

    res.json(result);
  } catch (err) {
    console.error('CSM GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
// ─────────────────────────────────────────────────────────────────────────────
// POST — save CSM response, close ticket, send thank-you email
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const {
      ticket_id, empno, client_name, age, sex,
      contact, office_location, unit_name, division_name,
      sector, client_type, service_mode, attending_officer,
      officer_rating,
      rating_promptness, rating_reliability, rating_access,
      rating_courtesy, rating_cost, rating_integrity,
      rating_assurance, rating_outcome,
      cc_awareness, cc_visibility, cc_helpfulness,
      commendation, suggestion,
    } = req.body;

    // Convert 0/1 to 'Male'/'Female' for enum column
    const sexLabel =
      sex === '0' || sex === 0 ? 'Male'   :
      sex === '1' || sex === 1 ? 'Female' :
      sex || null;

    // CSMF closes a ticket, so only the original requestor can submit it.
    const [ticketRows] = await db.query(
      'SELECT empno, status FROM tickets WHERE id = ? LIMIT 1',
      [ticket_id]
    );
    if (!ticketRows.length) return res.status(404).json({ error: 'Ticket not found.' });
    if (String(ticketRows[0].empno) !== String(req.user.empno)) {
      return res.status(403).json({ error: 'Only the original requestor can complete the CSM form.' });
    }
    if (ticketRows[0].status !== 'Resolved') {
      return res.status(409).json({ error: 'Only resolved tickets can be closed through the CSM form.' });
    }

    await db.query(`
      INSERT INTO csm_responses (
        ticket_id, empno, client_name, age, sex,
        contact, office_location, unit_name, division_name,
        sector, client_type, service_mode, attending_officer,
        officer_rating,
        rating_promptness, rating_reliability, rating_access,
        rating_courtesy, rating_cost, rating_integrity,
        rating_assurance, rating_outcome,
        cc_awareness, cc_visibility, cc_helpfulness,
        commendation, suggestion
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `, [
      ticket_id, req.user.empno, client_name, age || null, sexLabel,
      contact, office_location, unit_name, division_name,
      sector, client_type, service_mode, attending_officer,
      officer_rating,
      rating_promptness, rating_reliability, rating_access,
      rating_courtesy, null,  // ← rating_cost ALWAYS NULL
      rating_integrity, rating_assurance, rating_outcome,
      cc_awareness, cc_visibility, cc_helpfulness,
      commendation || null, suggestion || null,
    ]);

    // Close the ticket
    await db.query(
      `UPDATE tickets
       SET status = 'Closed', resolved_at = COALESCE(resolved_at, updated_at)
       WHERE id = ?`,
      [ticket_id]
    );

    // Respond immediately — email runs in background
    res.status(201).json({ message: 'CSM submitted successfully.' });

    // ── EMAIL: Thank you for CSMF — Ticket Closed (background) ──────────────
    setImmediate(async () => { try {
      // Get ticket details
      const [tRows] = await db.query(
        `SELECT ticket_number, subject, empno FROM tickets WHERE id = ?`,
        [ticket_id]
      );
      const ticket = tRows[0];

      // Get requester email via Harmony API
      let requesterEmail = null;
      try {
        const lookupEmpno = ticket?.empno || empno;
        const emp = await harmonyApi.getEmployeeByEmpno(lookupEmpno);
        const empData = emp?.data || emp;
        requesterEmail = empData?.email || empData?.user?.email || null;
      } catch (e) { console.warn('Harmony email lookup failed:', e.message); }

      if (requesterEmail?.includes('@') && ticket) {

        // Get thread for reply headers
        const [threadRows] = await db.query(
          `SELECT * FROM ticket_email_threads WHERE ticket_id = ? LIMIT 1`,
          [ticket_id]
        );
        const thread = threadRows[0] || null;

        // Build rating summary rows
        const ratingMap = [
          ['Officer Rating',     officer_rating],
          ['Promptness',         rating_promptness],
          ['Reliability',        rating_reliability],
          ['Accessibility',      rating_access],
          ['Courtesy',           rating_courtesy],
          ['Cost-effectiveness', 'N/A'],  // ← Show as N/A
          ['Integrity',          rating_integrity],
          ['Assurance',          rating_assurance],
          ['Outcome',            rating_outcome],
        ];

        const ratingLabel = (val) => {
          const n = Number(val);
          if (n === 5) return '5 — Very Satisfied';
          if (n === 4) return '4 — Satisfied';
          if (n === 3) return '3 — Neither';
          if (n === 2) return '2 — Unsatisfied';
          if (n === 1) return '1 — Very Unsatisfied';
          return val || '—';
        };

        const ratingRows = ratingMap
          .filter(([, v]) => v !== null && v !== undefined && v !== '')
          .map(([label, val]) => `
            <tr>
              <td style="padding:5px 10px;border:1px solid #ddd;
                         background:#eee;font-weight:bold;width:50%;">
                ${label}
              </td>
              <td style="padding:5px 10px;border:1px solid #ddd;">
                ${ratingLabel(val)}
              </td>
            </tr>
          `).join('');

        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">

            <!-- Header -->
            <div style="background:#1B6B3A;padding:16px 20px;
                        border-radius:6px 6px 0 0;">
              <h2 style="color:#fff;margin:0;font-size:16px;">
                🎉 Ticket Closed — Thank You for Your Feedback!
              </h2>
            </div>

            <!-- Body -->
            <div style="background:#f9f9f9;padding:20px;border:1px solid #ddd;
                        border-top:none;border-radius:0 0 6px 6px;">

              <p>Dear <strong>${client_name || 'Requestor'}</strong>,</p>

              <p>
                Thank you for completing the
                <strong>Client Satisfaction Measurement Form (CSMF)</strong>.
                Your ticket has now been officially <strong>closed</strong>.
              </p>

              <!-- Ticket Info -->
              <table style="width:100%;border-collapse:collapse;
                            font-size:13px;margin-bottom:16px;">
                <tr>
                  <td style="padding:6px 10px;background:#eee;font-weight:bold;
                             width:40%;border:1px solid #ddd;">Ticket Number</td>
                  <td style="padding:6px 10px;border:1px solid #ddd;">
                    ${ticket.ticket_number}
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 10px;background:#eee;font-weight:bold;
                             border:1px solid #ddd;">Subject</td>
                  <td style="padding:6px 10px;border:1px solid #ddd;">
                    ${ticket.subject}
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 10px;background:#eee;font-weight:bold;
                             border:1px solid #ddd;">Status</td>
                  <td style="padding:6px 10px;border:1px solid #ddd;">
                    <span style="background:#E8F5EE;color:#1B6B3A;
                                 padding:2px 8px;border-radius:3px;
                                 font-weight:bold;">Closed</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 10px;background:#eee;font-weight:bold;
                             border:1px solid #ddd;">Attending Officer</td>
                  <td style="padding:6px 10px;border:1px solid #ddd;">
                    ${attending_officer || '—'}
                  </td>
                </tr>
              </table>

              <!-- Rating Summary -->
              ${ratingRows ? `
                <p><strong>Your Satisfaction Ratings:</strong></p>
                <table style="width:100%;border-collapse:collapse;
                              font-size:13px;margin-bottom:16px;">
                  ${ratingRows}
                </table>
              ` : ''}

              <!-- Commendation / Suggestion -->
              ${commendation ? `
                <p>
                  <strong>Commendation:</strong><br>
                  <em style="color:#555;">${commendation}</em>
                </p>
              ` : ''}
              ${suggestion ? `
                <p>
                  <strong>Suggestion:</strong><br>
                  <em style="color:#555;">${suggestion}</em>
                </p>
              ` : ''}

              <!-- Thank you message -->
              <div style="background:#E8F5EE;border-left:4px solid #1B6B3A;
                          padding:12px;margin:16px 0;border-radius:4px;">
                <strong>💚 Your feedback matters!</strong><br>
                Your responses help us continuously improve our ICT support services
                at the Department of Social Welfare and Development.
                We appreciate you taking the time to share your experience.
              </div>

              <p>
                If you encounter another ICT concern in the future, do not hesitate
                to submit a new ticket through the
                <strong>DSWD ICTMS Help Desk Portal</strong>.
              </p>

              <p>Mabuhay at maraming salamat!</p>
              <p><strong>ICTMS — IT Help Desk & Ticketing System</strong><br>
                 Department of Social Welfare and Development</p>

              <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
              <p style="color:red;font-size:11px;margin:0;">
                *** This is a system generated message.
                DO NOT REPLY TO THIS EMAIL. ***
              </p>

            </div>
          </div>
        `;

        await sendEmail({
          to:      requesterEmail,
          subject: `[${ticket.ticket_number}] Ticket Closed — Thank You for Your Feedback`,
          html,
          ...(thread && {
            inReplyTo:  thread.email_message_id,
            references: thread.email_message_id,
          }),
        });
      }
    } catch (emailErr) {
      console.error('EMAIL ERROR (CSM thank-you):', emailErr.message);
    } }); // end setImmediate
    // ── End email ────────────────────────────────────────────────────────────

  } catch (err) {
    console.error('CSM POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
