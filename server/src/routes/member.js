import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

const maskAadhaar = (n) => {
  if (!n) return 'XXXX XXXX XXXX';
  const s = String(n);
  return s.length <= 4 ? 'X'.repeat(s.length) : 'X'.repeat(s.length - 4) + s.slice(-4);
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Fields a member may propose changes to, same set the admin can edit directly, minus
// membership_type (plan changes stay admin-only).
const EDITABLE_FIELDS = [
  'name', 'father_name', 'house_name', 'place', 'post_office', 'panchayath', 'blood_group',
  'date_of_birth', 'aadhaar_number', 'qualification', 'phone_abroad', 'home_contact_number', 'id_card_number_abroad',
  'working_country', 'city', 'retired_year', 'phone_india', 'whatsapp_number', 'email',
  'current_job', 'years_abroad', 'emergency_name', 'emergency_phone',
];

// Member enters their registered e-mail, Member ID (membership_id) and date of birth.
// All three must match the same application, and the membership must be Active.
router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim();
    const memberId = String(req.body?.member_id || '').trim();
    const dateOfBirth = String(req.body?.date_of_birth || '').trim();
    if (!email || !memberId || !dateOfBirth) {
      return res.status(400).json({ error: 'E-mail, Member ID and Date of Birth are required' });
    }

    const [rows] = await pool.query(
      'SELECT id, name, status FROM applications WHERE email = ? AND membership_id = ? AND date_of_birth = ? AND deleted_at IS NULL LIMIT 1',
      [email, memberId, dateOfBirth]
    );
    if (!rows.length) return res.status(401).json({ error: 'E-mail, Member ID and Date of Birth do not match our records' });
    const app = rows[0];
    if (app.status !== 'Active') {
      return res.status(403).json({ error: 'Your membership is not active yet. Please contact the society office.' });
    }

    const token = jwt.sign({ applicationId: app.id, type: 'member' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, name: app.name });
  } catch (e) { next(e); }
});

export function requireMember(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type !== 'member') return res.status(401).json({ error: 'Invalid session' });
    req.memberApplicationId = payload.applicationId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

// Member's own application detail (read-only).
router.get('/me', requireMember, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM applications WHERE id = ? AND deleted_at IS NULL', [req.memberApplicationId]);
    if (!rows.length) return res.status(404).json({ error: 'Application not found' });
    const app = rows[0];
    app.aadhaar_number = maskAadhaar(app.aadhaar_number);
    const [plans] = await pool.query('SELECT code, name FROM membership_plans');
    app.plan_name = plans.find((p) => p.code === app.membership_type)?.name || app.membership_type;
    const [payments] = await pool.query('SELECT id, amount, method, paid_on, receipt_number FROM payments WHERE application_id = ? ORDER BY paid_on DESC', [app.id]);
    const [history] = await pool.query(
      "SELECT action, detail, created_at FROM status_history WHERE application_id = ? AND action IN ('Approved','Rejected','Correction Requested') ORDER BY created_at DESC",
      [app.id]
    );
    res.json({ application: app, payments, history });
  } catch (e) { next(e); }
});

// Member's own photo (for previewing in the edit form).
router.get('/photo', requireMember, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM documents WHERE application_id = ? AND doc_type = 'photo' ORDER BY uploaded_at DESC LIMIT 1",
      [req.memberApplicationId]
    );
    if (!rows.length) return res.status(404).json({ error: 'No photo on file' });
    const doc = rows[0];
    res.setHeader('Content-Type', doc.mime_type);
    res.sendFile(path.join(UPLOAD_DIR, path.basename(doc.file_name)));
  } catch (e) { next(e); }
});

const photoUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.jpg';
      cb(null, `photo_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
      return cb(new Error('Photo must be a JPG or PNG'));
    }
    cb(null, true);
  },
});

// Member's latest edit request, so the dashboard can show a pending/rejected banner.
router.get('/edit-request', requireMember, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, changes, status, admin_note, created_at, reviewed_at FROM member_edit_requests WHERE application_id = ? ORDER BY created_at DESC LIMIT 1',
      [req.memberApplicationId]
    );
    res.json({ request: rows[0] || null });
  } catch (e) { next(e); }
});

// Submit a request to change any of the member's own fields (except membership_type).
// Goes into member_edit_requests for an admin to approve/reject — nothing on the
// applications row changes until then.
router.post('/edit-request', requireMember, photoUpload.single('photo'), async (req, res, next) => {
  const cleanupUpload = () => {
    if (req.file) { try { fs.unlinkSync(path.join(UPLOAD_DIR, req.file.filename)); } catch { /* ignore */ } }
  };
  try {
    const [pending] = await pool.query(
      "SELECT id FROM member_edit_requests WHERE application_id = ? AND status = 'Pending' LIMIT 1",
      [req.memberApplicationId]
    );
    if (pending.length) { cleanupUpload(); return res.status(409).json({ error: 'You already have an edit request awaiting review.' }); }

    const [rows] = await pool.query('SELECT * FROM applications WHERE id = ? AND deleted_at IS NULL', [req.memberApplicationId]);
    if (!rows.length) { cleanupUpload(); return res.status(404).json({ error: 'Application not found' }); }
    const app = rows[0];

    const b = req.body || {};
    const changes = {};
    for (const key of EDITABLE_FIELDS) {
      if (b[key] === undefined) continue;
      const value = key === 'years_abroad'
        ? (b[key] === '' ? 0 : Math.round(Number(b[key])) || 0)
        : (b[key] === '' ? null : String(b[key]).trim());
      if (String(value ?? '') !== String(app[key] ?? '')) changes[key] = value;
    }

    if (changes.name !== undefined && !String(changes.name || '').trim()) {
      cleanupUpload();
      return res.status(400).json({ error: 'Name cannot be empty' });
    }
    if (changes.email !== undefined) {
      if (!EMAIL_RE.test(changes.email || '')) { cleanupUpload(); return res.status(400).json({ error: 'E-mail is invalid' }); }
      const [dup] = await pool.query(
        "SELECT id FROM applications WHERE email = ? AND id != ? AND deleted_at IS NULL AND status != 'Rejected' LIMIT 1",
        [changes.email, app.id]
      );
      if (dup.length) { cleanupUpload(); return res.status(400).json({ error: 'This e-mail is already registered to another member.' }); }
    }
    if (changes.aadhaar_number !== undefined) {
      const key = String(changes.aadhaar_number || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
      if (key) {
        const [dup] = await pool.query(
          `SELECT id FROM applications WHERE UPPER(REGEXP_REPLACE(aadhaar_number, '[^0-9A-Za-z]', '')) = ? AND id != ? AND deleted_at IS NULL AND status != 'Rejected' LIMIT 1`,
          [key, app.id]
        );
        if (dup.length) { cleanupUpload(); return res.status(400).json({ error: 'This ID card number is already registered to another member.' }); }
      }
    }
    if (changes.whatsapp_number !== undefined) {
      const key = String(changes.whatsapp_number || '').replace(/\D/g, '');
      if (key) {
        const [dup] = await pool.query(
          `SELECT id FROM applications WHERE REGEXP_REPLACE(whatsapp_number, '[^0-9]', '') = ? AND id != ? AND deleted_at IS NULL AND status != 'Rejected' LIMIT 1`,
          [key, app.id]
        );
        if (dup.length) { cleanupUpload(); return res.status(400).json({ error: 'This WhatsApp number is already registered to another member.' }); }
      }
    }
    if (changes.panchayath) {
      const [validPanchayaths] = await pool.query("SELECT value FROM option_lists WHERE list_key = 'panchayath'");
      if (!validPanchayaths.some((r) => r.value === changes.panchayath)) {
        cleanupUpload();
        return res.status(400).json({ error: 'Panchayath/Municipality must be selected from the list' });
      }
    }

    if (!Object.keys(changes).length && !req.file) {
      cleanupUpload();
      return res.status(400).json({ error: 'No changes to submit' });
    }

    const [result] = await pool.query(
      'INSERT INTO member_edit_requests (application_id, changes, photo_file_name, photo_original_name, photo_mime_type) VALUES (?, ?, ?, ?, ?)',
      [app.id, JSON.stringify(changes), req.file ? req.file.filename : null, req.file ? req.file.originalname : null, req.file ? req.file.mimetype : null]
    );
    res.json({ ok: true, id: result.insertId });
  } catch (e) { cleanupUpload(); next(e); }
});

export default router;
