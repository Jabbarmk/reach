import express from 'express';
import { pool } from '../db.js';
import { requireAdmin, requireScreen } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAdmin, requireScreen('committee'));

const LISTS = {
  levels: 'committee_levels',
  wings: 'committee_wings',
  designations: 'committee_designations',
};
const ASSIGNMENT_COLUMN = { levels: 'committee_level', wings: 'wing', designations: 'designation' };

function requireAdminRole(req, res) {
  if (req.adminUser.role !== 'admin') {
    res.status(403).json({ error: 'Only administrators can do this' });
    return false;
  }
  return true;
}

async function getList(name) {
  const [rows] = await pool.query('SELECT value FROM settings WHERE name = ?', [name]);
  if (!rows.length) return [];
  try { return JSON.parse(rows[0].value); } catch { return []; }
}

/* ===== Option lists (levels / wings / designations) ===== */
router.get('/options', async (req, res, next) => {
  try {
    const [levels, wings, designations] = await Promise.all([
      getList(LISTS.levels), getList(LISTS.wings), getList(LISTS.designations),
    ]);
    res.json({ levels, wings, designations });
  } catch (e) { next(e); }
});

router.put('/options/:list', async (req, res, next) => {
  try {
    if (!requireAdminRole(req, res)) return;
    const { list } = req.params;
    if (!LISTS[list]) return res.status(400).json({ error: 'Unknown option list' });

    const items = Array.isArray(req.body?.items)
      ? [...new Set(req.body.items.map((s) => String(s || '').trim()).filter(Boolean))]
      : null;
    if (!items || !items.length) return res.status(400).json({ error: 'At least one option is required' });

    const before = await getList(LISTS[list]);
    const removed = before.filter((item) => !items.includes(item));
    if (removed.length) {
      const column = ASSIGNMENT_COLUMN[list];
      const [rows] = await pool.query(
        `SELECT ${column} AS value, COUNT(*) AS count FROM committee_assignments WHERE ${column} IN (?) GROUP BY ${column}`,
        [removed]
      );
      if (rows.length) {
        const names = rows.map((r) => `"${r.value}" (${r.count})`).join(', ');
        return res.status(400).json({ error: `Can't remove options still in use by assignments: ${names}. Reassign or delete those first.` });
      }
    }

    await pool.query(
      'INSERT INTO settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
      [LISTS[list], JSON.stringify(items)]
    );
    res.json({ items });
  } catch (e) { next(e); }
});

/* ===== Assignments ===== */
router.get('/assignments', async (req, res, next) => {
  try {
    const { search, committee_level, wing, designation } = req.query;
    let sql = `
      SELECT ca.*, a.name AS member_name, a.reference_no, a.membership_id, a.place,
             (SELECT d.id FROM documents d WHERE d.application_id = a.id AND d.doc_type = 'photo' LIMIT 1) AS photo_doc_id
      FROM committee_assignments ca
      JOIN applications a ON a.id = ca.application_id
      WHERE a.deleted_at IS NULL`;
    const params = [];
    if (committee_level) { sql += ' AND ca.committee_level = ?'; params.push(committee_level); }
    if (wing) { sql += ' AND ca.wing = ?'; params.push(wing); }
    if (designation) { sql += ' AND ca.designation = ?'; params.push(designation); }
    if (search) {
      sql += ' AND (a.name LIKE ? OR a.reference_no LIKE ? OR a.membership_id LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY ca.created_at DESC, ca.id DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) { next(e); }
});

function validateAssignmentBody(body) {
  const { application_id, committee_level, wing, designation } = body || {};
  if (!application_id) return 'A member must be selected';
  if (!String(committee_level || '').trim()) return 'Committee level is required';
  if (!String(wing || '').trim()) return 'Executive Committee / Wing is required';
  if (!String(designation || '').trim()) return 'Designation is required';
  return null;
}

router.post('/assignments', async (req, res, next) => {
  try {
    const err = validateAssignmentBody(req.body);
    if (err) return res.status(400).json({ error: err });
    const { application_id, committee_level, local_body, wing, designation, notes } = req.body;

    const [apps] = await pool.query('SELECT id FROM applications WHERE id = ? AND deleted_at IS NULL', [application_id]);
    if (!apps.length) return res.status(404).json({ error: 'Member not found' });

    const [result] = await pool.query(
      `INSERT INTO committee_assignments (application_id, committee_level, local_body, wing, designation, notes, created_by)
       VALUES (?,?,?,?,?,?,?)`,
      [application_id, committee_level.trim(), local_body?.trim() || null, wing.trim(), designation.trim(), notes?.trim() || null, req.admin.username]
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) { next(e); }
});

router.put('/assignments/:id', async (req, res, next) => {
  try {
    const err = validateAssignmentBody(req.body);
    if (err) return res.status(400).json({ error: err });
    const { application_id, committee_level, local_body, wing, designation, notes } = req.body;

    const [rows] = await pool.query('SELECT id FROM committee_assignments WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Assignment not found' });

    await pool.query(
      `UPDATE committee_assignments
       SET application_id = ?, committee_level = ?, local_body = ?, wing = ?, designation = ?, notes = ?
       WHERE id = ?`,
      [application_id, committee_level.trim(), local_body?.trim() || null, wing.trim(), designation.trim(), notes?.trim() || null, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/assignments/:id', async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM committee_assignments WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Assignment not found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
