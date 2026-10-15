const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all comments for a ticket
router.get('/:ticketId', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        c.id,
        c.empno,
        c.content,
        c.created_at,
        COALESCE(u.full_name, c.empno) AS full_name,  -- ✅ fallback to empno if no user found
        COALESCE(u.role, 'unknown')    AS role
      FROM comments c
      LEFT JOIN users u ON c.empno = u.empno
      WHERE c.ticket_id = ?
      ORDER BY c.created_at ASC
    `, [req.params.ticketId]);

    //console.log('Comments fetched:', rows.length, 'for ticket:', req.params.ticketId);
    res.json(rows);
  } catch (err) {
    //console.error('Comment GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
// POST add a comment to a ticket
router.post('/', async (req, res) => {
  try {
    const { ticket_id, empno, content } = req.body;

    if (!empno)         return res.status(400).json({ error: 'empno is required' });
    if (!content?.trim()) return res.status(400).json({ error: 'content is required' });

    await db.query(
      `INSERT INTO comments (ticket_id, empno, content) VALUES (?, ?, ?)`,
      [ticket_id, empno, content]
    );
    res.status(201).json({ message: 'Comment posted.' });
  } catch (err) {
    console.error('Comment POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;