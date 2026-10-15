const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all statuses
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM ticket_statuses ORDER BY sort_order ASC, id ASC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create new status
router.post('/', async (req, res) => {
  try {
    const { name, type, color, description } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Name is required.' });
    }

    // Get max sort_order
    const [last] = await db.query(
      'SELECT MAX(sort_order) as maxOrder FROM ticket_statuses'
    );
    const nextOrder = (last[0].maxOrder ?? 0) + 1;

    const [result] = await db.query(
      `INSERT INTO ticket_statuses (name, type, color, description, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [name.trim(), type ?? 'in_progress', color ?? '#1A5490', description ?? '', nextOrder]
    );
    res.status(201).json({ message: 'Status created.', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'A status with this name already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT update status
router.put('/:id', async (req, res) => {
  try {
    const { name, type, color, description } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Name is required.' });
    }
    await db.query(
      `UPDATE ticket_statuses SET name=?, type=?, color=?, description=? WHERE id=?`,
      [name.trim(), type, color, description, req.params.id]
    );
    res.json({ message: 'Status updated.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'A status with this name already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// DELETE status (only non-default)
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT is_default FROM ticket_statuses WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Status not found.' });
    }
    if (rows[0].is_default) {
      return res.status(400).json({ error: 'Default statuses cannot be deleted.' });
    }
    await db.query('DELETE FROM ticket_statuses WHERE id = ?', [req.params.id]);
    res.json({ message: 'Status deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;