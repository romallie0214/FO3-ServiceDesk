const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const db = require('../db');
const auth = require('../middleware/auth');
const { canManageArea, requireAreaAdmin } = require('../services/serviceAreaAccess');
const { uploadServiceTemplate, getPresignedDownloadUrl } = require('../services/objectStorage');

const uploadDir = path.join(__dirname, '../uploads/service_templates');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, done) => done(null, allowedMimeTypes.has(file.mimetype)),
});

function safeOriginalFilename(name) {
  return String(name || 'template').replace(/[\\/:*?"<>|\x00-\x1F]/g, '_').slice(0, 255);
}

router.get('/', auth, async (req, res) => {
  try {
    const params = [];
    let where = 'WHERE st.is_active = 1';
    if (req.query.service_area_id) {
      where += ' AND st.service_area_id = ?';
      params.push(Number(req.query.service_area_id));
    }
    const [rows] = await db.query(
      `SELECT st.id, st.service_area_id, sa.code AS service_area_code, sa.name AS service_area_name,
              st.category, st.title, st.description, st.original_filename, st.mime_type, st.is_active, st.created_at, st.updated_at
       FROM service_templates st
       JOIN service_areas sa ON sa.id = st.service_area_id
       ${where}
       ORDER BY sa.code, st.title`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('Service templates list error:', err.message);
    res.status(500).json({ error: 'Unable to load service templates.' });
  }
});

router.get('/:id/download', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT storage_bucket, object_key, original_filename, mime_type FROM service_templates WHERE id = ? AND is_active = 1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Template not found.' });
    if (!rows[0].storage_bucket || !rows[0].object_key) return res.status(404).json({ error: 'Template must be re-uploaded to object storage.' });
    const url = await getPresignedDownloadUrl(rows[0].storage_bucket, rows[0].object_key);
    const file = await axios.get(url, { responseType: 'stream', timeout: 60000 });
    res.setHeader('Content-Type', rows[0].mime_type || file.headers['content-type'] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${rows[0].original_filename.replace(/"/g, '')}"`);
    file.data.pipe(res);
  } catch (err) {
    console.error('Service template download error:', err.message);
    res.status(500).json({ error: 'Unable to download template.' });
  }
});

router.post('/', auth, requireAreaAdmin, upload.single('file'), async (req, res) => {
  try {
    const serviceAreaId = Number(req.body.service_area_id);
    const title = String(req.body.title || '').trim();
    if (!Number.isInteger(serviceAreaId) || serviceAreaId < 1 || !title || !req.file) {
      return res.status(400).json({ error: 'Service area, template title, and file are required.' });
    }
    if (!await canManageArea(req.user, serviceAreaId)) return res.status(403).json({ error: 'You can manage templates only in your designated service area.' });
    const uploaded = await uploadServiceTemplate(req.file, title);
    const [result] = await db.query(
      `INSERT INTO service_templates
       (service_area_id, category, title, description, stored_filename, storage_bucket, object_key, original_filename, mime_type, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [serviceAreaId, String(req.body.category || 'General').trim() || 'General', title, String(req.body.description || '').trim(), uploaded.original_filename, uploaded.bucket, uploaded.key, uploaded.original_filename, req.file.mimetype, req.user.id || null]
    );
    res.status(201).json({ id: result.insertId, message: 'Template published.' });
  } catch (err) {
    console.error('Service template create error:', err.message);
    res.status(500).json({ error: 'Unable to publish template.' });
  }
});

router.patch('/:id', auth, requireAreaAdmin, upload.single('file'), async (req, res) => {
  try {
    const [rows] = await db.query('SELECT service_area_id, stored_filename, storage_bucket, object_key FROM service_templates WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Template not found.' });
    const serviceAreaId = Number(req.body.service_area_id);
    const title = String(req.body.title || '').trim();
    if (!Number.isInteger(serviceAreaId) || serviceAreaId < 1 || !title) return res.status(400).json({ error: 'Service area and template title are required.' });
    if (!await canManageArea(req.user, rows[0].service_area_id) || !await canManageArea(req.user, serviceAreaId)) {
      return res.status(403).json({ error: 'You can manage templates only in your designated service area.' });
    }
    let storedFilename = rows[0].stored_filename;
    let originalFilename;
    let mimeType;
    let storageBucket = rows[0].storage_bucket;
    let objectKey = rows[0].object_key;
    if (req.file) {
      const uploaded = await uploadServiceTemplate(req.file, title);
      storedFilename = uploaded.original_filename;
      originalFilename = uploaded.original_filename;
      mimeType = req.file.mimetype;
      storageBucket = uploaded.bucket;
      objectKey = uploaded.key;
    }
    await db.query(
      `UPDATE service_templates
       SET service_area_id = ?, category = ?, title = ?, description = ?, stored_filename = ?, storage_bucket = ?, object_key = ?,
           original_filename = COALESCE(?, original_filename), mime_type = COALESCE(?, mime_type)
       WHERE id = ?`,
      [serviceAreaId, String(req.body.category || 'General').trim() || 'General', title, String(req.body.description || '').trim(), storedFilename, storageBucket, objectKey, originalFilename, mimeType, req.params.id]
    );
    res.json({ message: 'Template updated.' });
  } catch (err) {
    console.error('Service template update error:', err.message);
    res.status(500).json({ error: 'Unable to update template.' });
  }
});

router.delete('/:id', auth, requireAreaAdmin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT service_area_id, stored_filename FROM service_templates WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Template not found.' });
    if (!await canManageArea(req.user, rows[0].service_area_id)) return res.status(403).json({ error: 'You can manage templates only in your designated service area.' });
    await db.query('DELETE FROM service_templates WHERE id = ?', [req.params.id]);
    res.json({ message: 'Template removed.' });
  } catch (err) {
    console.error('Service template delete error:', err.message);
    res.status(500).json({ error: 'Unable to remove template.' });
  }
});

module.exports = router;
