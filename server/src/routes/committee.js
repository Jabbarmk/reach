import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';
import { requireAdmin, requireScreen } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEETINGS_DIR = path.join(__dirname, '..', '..', 'uploads', 'meetings');
if (!fs.existsSync(MEETINGS_DIR)) fs.mkdirSync(MEETINGS_DIR, { recursive: true });

const router = express.Router();
router.use(requireAdmin, requireScreen('committee'));

const uploadAttachment = multer({
  storage: multer.diskStorage({
    destination: MEETINGS_DIR,
    filename: (req, file, cb) => cb(null, `mom_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${path.extname(file.originalname) || ''}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype)) {
      return cb(new Error('Attachment must be a PDF, JPG or PNG'));
    }
    cb(null, true);
  },
}).single('attachment');

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

/* ===== Meetings (Minutes of Meeting) ===== */
async function attendanceCounts(meetingIds) {
  if (!meetingIds.length) return new Map();
  const [rows] = await pool.query(
    `SELECT meeting_id, status, COUNT(*) AS n FROM committee_meeting_attendance
     WHERE meeting_id IN (?) GROUP BY meeting_id, status`,
    [meetingIds]
  );
  const map = new Map();
  for (const r of rows) {
    const cur = map.get(r.meeting_id) || { present: 0, absent: 0 };
    cur[r.status] = r.n;
    map.set(r.meeting_id, cur);
  }
  return map;
}

router.get('/meetings', async (req, res, next) => {
  try {
    const { committee_level, wing, from, to, search } = req.query;
    let sql = 'SELECT * FROM committee_meetings WHERE 1=1';
    const params = [];
    if (committee_level) { sql += ' AND committee_level = ?'; params.push(committee_level); }
    if (wing) { sql += ' AND wing = ?'; params.push(wing); }
    if (from) { sql += ' AND meeting_date >= ?'; params.push(from); }
    if (to) { sql += ' AND meeting_date <= ?'; params.push(to); }
    if (search) { sql += ' AND (agenda LIKE ? OR venue LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    sql += ' ORDER BY meeting_date DESC, id DESC';
    const [rows] = await pool.query(sql, params);
    const counts = await attendanceCounts(rows.map((r) => r.id));
    res.json(rows.map((r) => ({ ...r, ...(counts.get(r.id) || { present: 0, absent: 0 }) })));
  } catch (e) { next(e); }
});

router.get('/meetings/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM committee_meetings WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Meeting not found' });
    const [attendance] = await pool.query(
      `SELECT ca.application_id, ca.status, a.name, a.reference_no, a.membership_id
       FROM committee_meeting_attendance ca JOIN applications a ON a.id = ca.application_id
       WHERE ca.meeting_id = ? ORDER BY a.name`,
      [req.params.id]
    );
    res.json({ ...rows[0], attendance });
  } catch (e) { next(e); }
});

function validateMeetingBody(body) {
  const { committee_level, wing, meeting_date } = body || {};
  if (!String(committee_level || '').trim()) return 'Committee level is required';
  if (!String(wing || '').trim()) return 'Executive Committee / Wing is required';
  if (!meeting_date || isNaN(Date.parse(meeting_date))) return 'A valid meeting date is required';
  return null;
}

function parseIds(raw) {
  if (!raw) return [];
  try { const list = JSON.parse(raw); return Array.isArray(list) ? list.map(Number).filter(Boolean) : []; }
  catch { return []; }
}

async function saveAttendance(conn, meetingId, participants, absentees) {
  await conn.query('DELETE FROM committee_meeting_attendance WHERE meeting_id = ?', [meetingId]);
  const rows = [
    ...participants.map((id) => [meetingId, id, 'present']),
    ...absentees.filter((id) => !participants.includes(id)).map((id) => [meetingId, id, 'absent']),
  ];
  if (rows.length) {
    await conn.query('INSERT INTO committee_meeting_attendance (meeting_id, application_id, status) VALUES ?', [rows]);
  }
}

router.post('/meetings', (req, res, next) => {
  uploadAttachment(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ error: uploadErr.message });
    if (!requireAdminRole(req, res)) return;
    const err = validateMeetingBody(req.body);
    if (err) return res.status(400).json({ error: err });
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const {
        committee_level, local_body, wing, meeting_date, meeting_time, venue,
        agenda, discussed_points, last_meeting_updates, new_decisions, prepared_by, approved_by,
      } = req.body;
      const [result] = await conn.query(
        `INSERT INTO committee_meetings
          (committee_level, local_body, wing, meeting_date, meeting_time, venue, agenda, discussed_points,
           last_meeting_updates, new_decisions, prepared_by, approved_by, attachment_file, attachment_mime,
           attachment_original_name, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          committee_level.trim(), local_body?.trim() || null, wing.trim(), meeting_date, meeting_time || null, venue?.trim() || null,
          agenda?.trim() || null, discussed_points?.trim() || null, last_meeting_updates?.trim() || null, new_decisions?.trim() || null,
          prepared_by?.trim() || null, approved_by?.trim() || null,
          req.file?.filename || null, req.file?.mimetype || null, req.file?.originalname || null,
          req.admin.username,
        ]
      );
      await saveAttendance(conn, result.insertId, parseIds(req.body.participants), parseIds(req.body.absentees));
      await conn.commit();
      res.status(201).json({ id: result.insertId });
    } catch (e) {
      await conn.rollback();
      if (req.file) fs.unlink(path.join(MEETINGS_DIR, req.file.filename), () => {});
      next(e);
    } finally { conn.release(); }
  });
});

router.put('/meetings/:id', (req, res, next) => {
  uploadAttachment(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ error: uploadErr.message });
    if (!requireAdminRole(req, res)) return;
    const err = validateMeetingBody(req.body);
    if (err) return res.status(400).json({ error: err });
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query('SELECT * FROM committee_meetings WHERE id = ?', [req.params.id]);
      if (!rows.length) { conn.release(); return res.status(404).json({ error: 'Meeting not found' }); }
      const current = rows[0];

      await conn.beginTransaction();
      const {
        committee_level, local_body, wing, meeting_date, meeting_time, venue,
        agenda, discussed_points, last_meeting_updates, new_decisions, prepared_by, approved_by,
      } = req.body;
      const attachmentFile = req.file?.filename || current.attachment_file;
      const attachmentMime = req.file?.mimetype || current.attachment_mime;
      const attachmentName = req.file?.originalname || current.attachment_original_name;

      await conn.query(
        `UPDATE committee_meetings SET
           committee_level=?, local_body=?, wing=?, meeting_date=?, meeting_time=?, venue=?, agenda=?,
           discussed_points=?, last_meeting_updates=?, new_decisions=?, prepared_by=?, approved_by=?,
           attachment_file=?, attachment_mime=?, attachment_original_name=?
         WHERE id = ?`,
        [
          committee_level.trim(), local_body?.trim() || null, wing.trim(), meeting_date, meeting_time || null, venue?.trim() || null,
          agenda?.trim() || null, discussed_points?.trim() || null, last_meeting_updates?.trim() || null, new_decisions?.trim() || null,
          prepared_by?.trim() || null, approved_by?.trim() || null,
          attachmentFile, attachmentMime, attachmentName,
          req.params.id,
        ]
      );
      await saveAttendance(conn, req.params.id, parseIds(req.body.participants), parseIds(req.body.absentees));
      await conn.commit();

      if (req.file && current.attachment_file) fs.unlink(path.join(MEETINGS_DIR, current.attachment_file), () => {});
      res.json({ ok: true });
    } catch (e) {
      await conn.rollback();
      if (req.file) fs.unlink(path.join(MEETINGS_DIR, req.file.filename), () => {});
      next(e);
    } finally { conn.release(); }
  });
});

router.delete('/meetings/:id', async (req, res, next) => {
  try {
    if (!requireAdminRole(req, res)) return;
    const [rows] = await pool.query('SELECT attachment_file FROM committee_meetings WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Meeting not found' });
    await pool.query('DELETE FROM committee_meetings WHERE id = ?', [req.params.id]);
    if (rows[0].attachment_file) fs.unlink(path.join(MEETINGS_DIR, rows[0].attachment_file), () => {});
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/meetings/:id/attachment', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT attachment_file, attachment_mime, attachment_original_name FROM committee_meetings WHERE id = ?', [req.params.id]);
    const m = rows[0];
    if (!m?.attachment_file) return res.status(404).json({ error: 'No attachment' });
    res.setHeader('Content-Type', m.attachment_mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${(m.attachment_original_name || 'attachment').replace(/[^\w.\- ]/g, '_')}"`);
    res.sendFile(path.join(MEETINGS_DIR, m.attachment_file));
  } catch (e) { next(e); }
});

export default router;
