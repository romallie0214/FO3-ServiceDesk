const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { canManageArea, requireAreaAdmin } = require('../services/serviceAreaAccess');

// ─── CATEGORIES ───

// GET all categories with sub-category count
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        c.*, sa.name AS service_area_name, sa.code AS service_area_code,
        COUNT(DISTINCT sc.id) AS sub_category_count,
        s.priority            AS sla_priority,
        s.impact_level        AS sla_impact,
        s.response_time_hours,
        s.resolution_time_hours
      FROM categories c
      LEFT JOIN service_areas sa ON sa.id = c.service_area_id
      LEFT JOIN sub_categories sc ON sc.category_id = c.id
      LEFT JOIN sla_rules s       ON s.id = c.sla_rule_id
      GROUP BY c.id
      ORDER BY sa.name ASC, c.id ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single category with full tree
router.get('/:id/tree', async (req, res) => {
  try {
    const [cats] = await db.query(
      'SELECT * FROM categories WHERE id = ?',
      [req.params.id]
    );
    if (cats.length === 0) return res.status(404).json({ error: 'Not found' });

    const [subs] = await db.query(
      'SELECT * FROM sub_categories WHERE category_id = ? ORDER BY sort_order',
      [req.params.id]
    );

    for (const sub of subs) {
      const [items] = await db.query(
        'SELECT * FROM sub_items WHERE sub_category_id = ? ORDER BY sort_order',
        [sub.id]
      );
      sub.items = items;
    }

    cats[0].sub_categories = subs;
    res.json(cats[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create category
router.post('/', auth, requireAreaAdmin, async (req, res) => {
  try {
    const { name, description, sla_rule_id, default_priority, service_area_id } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required.' });
    if (!service_area_id) return res.status(400).json({ error: 'A responsible service area is required.' });
    if (!await canManageArea(req.user, service_area_id)) return res.status(403).json({ error: 'You can only manage categories in your designated service area.' });
    const [areas] = await db.query('SELECT id FROM service_areas WHERE id = ? AND is_active = 1', [service_area_id]);
    if (!areas.length) return res.status(400).json({ error: 'Select an active service area.' });
    const [result] = await db.query(
      `INSERT INTO categories 
        (name, description, sla_rule_id, default_priority, service_area_id) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        name.trim(),
        description ?? '',
        sla_rule_id || null,
        default_priority ?? 'Medium', service_area_id || null,
      ]
    );
    res.status(201).json({ message: 'Category created.', id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// PUT update category
router.put('/:id', auth, requireAreaAdmin, async (req, res) => {
  try {
    const { name, description, sla_rule_id, default_priority, service_area_id } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required.' });
    if (!service_area_id) return res.status(400).json({ error: 'A responsible service area is required.' });
    const [existing] = await db.query('SELECT service_area_id FROM categories WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Category not found.' });
    if (!await canManageArea(req.user, existing[0].service_area_id) || !await canManageArea(req.user, service_area_id)) return res.status(403).json({ error: 'You can only manage categories in your designated service area.' });
    const [areas] = await db.query('SELECT id FROM service_areas WHERE id = ? AND is_active = 1', [service_area_id]);
    if (!areas.length) return res.status(400).json({ error: 'Select an active service area.' });
    await db.query(
      `UPDATE categories 
       SET name=?, description=?, sla_rule_id=?, default_priority=?, service_area_id=? 
       WHERE id=?`,
      [
        name.trim(),
        description ?? '',
        sla_rule_id || null,
        default_priority ?? 'Medium', service_area_id || null,
        req.params.id,
      ]
    );
    res.json({ message: 'Category updated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE category
router.delete('/:id', auth, requireAreaAdmin, async (req, res) => {
  try {
    const [existing] = await db.query('SELECT service_area_id FROM categories WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Category not found.' });
    if (!await canManageArea(req.user, existing[0].service_area_id)) return res.status(403).json({ error: 'You can only manage categories in your designated service area.' });
    await db.query('DELETE FROM categories WHERE id=?', [req.params.id]);
    res.json({ message: 'Category deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SUB-CATEGORIES ───

// GET sub-categories by category — include SLA info
router.get('/:categoryId/subs', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        sc.*,
        COUNT(si.id) as item_count,
        s.priority as sla_priority,
        s.impact_level as sla_impact,
        s.response_time_hours,
        s.resolution_time_hours,
        s.escalation_time_hours
      FROM sub_categories sc
      LEFT JOIN sub_items si ON si.sub_category_id = sc.id
      LEFT JOIN sla_rules s ON s.id = sc.sla_rule_id
      WHERE sc.category_id = ?
      GROUP BY sc.id
      ORDER BY sc.sort_order ASC
    `, [req.params.categoryId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create sub-category — include SLA
router.post('/:categoryId/subs', auth, requireAreaAdmin, async (req, res) => {
  try {
    const [category] = await db.query('SELECT service_area_id FROM categories WHERE id = ?', [req.params.categoryId]);
    if (!category.length) return res.status(404).json({ error: 'Category not found.' });
    if (!await canManageArea(req.user, category[0].service_area_id)) return res.status(403).json({ error: 'You can only manage categories in your designated service area.' });
    const { name, description, sla_rule_id, default_priority } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required.' });
    const [last] = await db.query(
      'SELECT MAX(sort_order) as mo FROM sub_categories WHERE category_id=?',
      [req.params.categoryId]
    );
    const [result] = await db.query(
      `INSERT INTO sub_categories 
        (category_id, name, description, sla_rule_id, default_priority, sort_order) 
       VALUES (?,?,?,?,?,?)`,
      [
        req.params.categoryId, name.trim(), description ?? '',
        sla_rule_id || null, default_priority ?? 'Medium',
        (last[0].mo ?? 0) + 1,
      ]
    );
    res.status(201).json({ message: 'Sub-category created.', id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update sub-category — include SLA
router.put('/subs/:id', auth, requireAreaAdmin, async (req, res) => {
  try {
    const [sub] = await db.query('SELECT c.service_area_id FROM sub_categories sc JOIN categories c ON c.id = sc.category_id WHERE sc.id = ?', [req.params.id]);
    if (!sub.length) return res.status(404).json({ error: 'Sub-category not found.' });
    if (!await canManageArea(req.user, sub[0].service_area_id)) return res.status(403).json({ error: 'You can only manage categories in your designated service area.' });
    const { name, description, sla_rule_id, default_priority } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required.' });
    await db.query(
      `UPDATE sub_categories 
       SET name=?, description=?, sla_rule_id=?, default_priority=? 
       WHERE id=?`,
      [name.trim(), description ?? '', sla_rule_id || null, default_priority ?? 'Medium', req.params.id]
    );
    res.json({ message: 'Sub-category updated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE sub-category
router.delete('/subs/:id', auth, requireAreaAdmin, async (req, res) => {
  try {
    const [sub] = await db.query('SELECT c.service_area_id FROM sub_categories sc JOIN categories c ON c.id = sc.category_id WHERE sc.id = ?', [req.params.id]);
    if (!sub.length) return res.status(404).json({ error: 'Sub-category not found.' });
    if (!await canManageArea(req.user, sub[0].service_area_id)) return res.status(403).json({ error: 'You can only manage categories in your designated service area.' });
    await db.query('DELETE FROM sub_categories WHERE id=?', [req.params.id]);
    res.json({ message: 'Sub-category deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SUB-ITEMS ───

// GET sub-items — include SLA info
router.get('/subs/:subCategoryId/items', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        si.*,
        s.priority as sla_priority,
        s.impact_level as sla_impact,
        s.response_time_hours,
        s.resolution_time_hours,
        s.escalation_time_hours
      FROM sub_items si
      LEFT JOIN sla_rules s ON s.id = si.sla_rule_id
      WHERE si.sub_category_id = ?
      ORDER BY si.sort_order ASC
    `, [req.params.subCategoryId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create sub-item — include SLA
router.post('/subs/:subCategoryId/items', auth, requireAreaAdmin, async (req, res) => {
  try {
    const [sub] = await db.query('SELECT c.service_area_id FROM sub_categories sc JOIN categories c ON c.id = sc.category_id WHERE sc.id = ?', [req.params.subCategoryId]);
    if (!sub.length) return res.status(404).json({ error: 'Sub-category not found.' });
    if (!await canManageArea(req.user, sub[0].service_area_id)) return res.status(403).json({ error: 'You can only manage categories in your designated service area.' });
    const { name, description, sla_rule_id, default_priority } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required.' });
    const [last] = await db.query(
      'SELECT MAX(sort_order) as mo FROM sub_items WHERE sub_category_id=?',
      [req.params.subCategoryId]
    );
    const [result] = await db.query(
      `INSERT INTO sub_items 
        (sub_category_id, name, description, sla_rule_id, default_priority, sort_order)
       VALUES (?,?,?,?,?,?)`,
      [
        req.params.subCategoryId, name.trim(), description ?? '',
        sla_rule_id || null, default_priority ?? 'Medium',
        (last[0].mo ?? 0) + 1,
      ]
    );
    res.status(201).json({ message: 'Sub-item created.', id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update sub-item — include SLA
router.put('/items/:id', auth, requireAreaAdmin, async (req, res) => {
  try {
    const [item] = await db.query('SELECT c.service_area_id FROM sub_items si JOIN sub_categories sc ON sc.id = si.sub_category_id JOIN categories c ON c.id = sc.category_id WHERE si.id = ?', [req.params.id]);
    if (!item.length) return res.status(404).json({ error: 'Sub-item not found.' });
    if (!await canManageArea(req.user, item[0].service_area_id)) return res.status(403).json({ error: 'You can only manage categories in your designated service area.' });
    const { name, description, sla_rule_id, default_priority } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required.' });
    await db.query(
      `UPDATE sub_items 
       SET name=?, description=?, sla_rule_id=?, default_priority=?
       WHERE id=?`,
      [name.trim(), description ?? '', sla_rule_id || null, default_priority ?? 'Medium', req.params.id]
    );
    res.json({ message: 'Sub-item updated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE sub-item
router.delete('/items/:id', auth, requireAreaAdmin, async (req, res) => {
  try {
    const [item] = await db.query('SELECT c.service_area_id FROM sub_items si JOIN sub_categories sc ON sc.id = si.sub_category_id JOIN categories c ON c.id = sc.category_id WHERE si.id = ?', [req.params.id]);
    if (!item.length) return res.status(404).json({ error: 'Sub-item not found.' });
    if (!await canManageArea(req.user, item[0].service_area_id)) return res.status(403).json({ error: 'You can only manage categories in your designated service area.' });
    await db.query('DELETE FROM sub_items WHERE id=?', [req.params.id]);
    res.json({ message: 'Sub-item deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
