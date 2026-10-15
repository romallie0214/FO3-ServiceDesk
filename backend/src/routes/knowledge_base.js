const express = require('express');
const router  = express.Router();
const db      = require('../db');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const crypto = require('crypto');
const auth = require('../middleware/auth');
const { adminAreaIds, canManageArea, requireAreaAdmin } = require('../services/serviceAreaAccess');

const requireKnowledgeBaseManager = requireAreaAdmin;

// ─── Storage ─────────────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../uploads/knowledge_base');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    //const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const unique = crypto.randomUUID();
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed.'));
  },
});

// ─── SQL setup hint (run once) ────────────────────────────────────────────────
/*
CREATE TABLE IF NOT EXISTS knowledge_base (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  category    VARCHAR(100) NOT NULL,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  pdf_filename VARCHAR(255) DEFAULT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
*/

// ─── GET all articles ─────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { category, search, service_area_id } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    const areaIds = await adminAreaIds(req.user);
    const isServiceAdmin = req.user?.role !== 'super_admin' && areaIds.length > 0;
    const allowAllServices = isServiceAdmin && req.query.all_services === 'true';

    if (isServiceAdmin && !allowAllServices) {
      where += ` AND kb.service_area_id IN (${areaIds.map(() => '?').join(',')})`;
      params.push(...areaIds);
    }

    if (category) {
      where += ' AND category = ?';
      params.push(category);
    }
    if (service_area_id) { where += ' AND kb.service_area_id = ?'; params.push(service_area_id); }
    if (search) {
      where += ' AND (title LIKE ? OR description LIKE ? OR category LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const [rows] = await db.query(
      `SELECT kb.id, kb.service_area_id, sa.code AS service_area_code, sa.name AS service_area_name, kb.category, kb.title, kb.description, kb.pdf_filename, kb.created_at, kb.updated_at
       FROM knowledge_base kb LEFT JOIN service_areas sa ON sa.id = kb.service_area_id ${where} ORDER BY sa.name, kb.category, kb.title`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET single article ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM knowledge_base WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Article not found.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET PDF file ─────────────────────────────────────────────────────────────
router.get('/:id/pdf', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT pdf_filename FROM knowledge_base WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length || !rows[0].pdf_filename) {
      return res.status(404).json({ error: 'No PDF attached to this article.' });
    }
    const filePath = path.join(uploadDir, rows[0].pdf_filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'PDF file not found on server.' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${rows[0].pdf_filename}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST create article ──────────────────────────────────────────────────────
router.post('/', auth, requireKnowledgeBaseManager, upload.single('pdf'), async (req, res) => {
  try {
    const { category, title, description, service_area_id } = req.body;
    if (!category?.trim() || !title?.trim() || !service_area_id) {
      return res.status(400).json({ error: 'Service area, category, and title are required.' });
    }
    if (!await canManageArea(req.user, service_area_id)) return res.status(403).json({ error: 'You can only manage knowledge-base articles in your designated service area.' });
    const pdf_filename = req.file ? req.file.filename : null;

    const [result] = await db.query(
      `INSERT INTO knowledge_base (service_area_id, category, title, description, pdf_filename)
       VALUES (?, ?, ?, ?, ?)`,
      [service_area_id, category.trim(), title.trim(), description?.trim() || '', pdf_filename]
    );
    res.status(201).json({
      message: 'Article created successfully.',
      id: result.insertId,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH update article (replace PDF if new one is uploaded) ────────────────
router.patch('/:id', auth, requireKnowledgeBaseManager, upload.single('pdf'), async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT pdf_filename, service_area_id FROM knowledge_base WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Article not found.' });

    const { category, title, description, service_area_id } = req.body;
    if (!category?.trim() || !title?.trim() || !service_area_id) {
      return res.status(400).json({ error: 'Service area, category, and title are required.' });
    }
    if (!await canManageArea(req.user, rows[0].service_area_id) || !await canManageArea(req.user, service_area_id)) return res.status(403).json({ error: 'You can only manage knowledge-base articles in your designated service area.' });

    let pdf_filename = rows[0].pdf_filename;

    if (req.file) {
      // Delete old PDF if exists
      if (pdf_filename) {
        const oldPath = path.join(uploadDir, pdf_filename);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      pdf_filename = req.file.filename;
    }

    await db.query(
      `UPDATE knowledge_base
       SET service_area_id = ?, category = ?, title = ?, description = ?, pdf_filename = ?
       WHERE id = ?`,
      [service_area_id, category.trim(), title.trim(), description?.trim() || '', pdf_filename, req.params.id]
    );
    res.json({ message: 'Article updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE article ───────────────────────────────────────────────────────────
router.delete('/:id', auth, requireKnowledgeBaseManager, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT pdf_filename, service_area_id FROM knowledge_base WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Article not found.' });
    if (!await canManageArea(req.user, rows[0].service_area_id)) return res.status(403).json({ error: 'You can only manage knowledge-base articles in your designated service area.' });

    // Delete PDF file from disk
    if (rows[0].pdf_filename) {
      const filePath = path.join(uploadDir, rows[0].pdf_filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await db.query('DELETE FROM knowledge_base WHERE id = ?', [req.params.id]);
    res.json({ message: 'Article deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE PDF only (detach without deleting article) ────────────────────────
router.delete('/:id/pdf', auth, requireKnowledgeBaseManager, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT pdf_filename, service_area_id FROM knowledge_base WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Article not found.' });
    if (!await canManageArea(req.user, rows[0].service_area_id)) return res.status(403).json({ error: 'You can only manage knowledge-base articles in your designated service area.' });

    if (rows[0].pdf_filename) {
      const filePath = path.join(uploadDir, rows[0].pdf_filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await db.query(
      'UPDATE knowledge_base SET pdf_filename = NULL WHERE id = ?',
      [req.params.id]
    );
    res.json({ message: 'PDF removed from article.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
