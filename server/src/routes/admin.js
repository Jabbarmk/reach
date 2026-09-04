import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';
import { requireAdmin, requireScreen, requireAnyScreen, screensForUser } from '../middleware/auth.js';
import { sendMail, templates } from '../mailer.js';
import { buildReceiptPdf } from '../receiptPdf.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

const maskAadhaar = (n) => {
  if (!n) return 'XXXX XXXX XXXX';
  const s = String(n);
  return s.length <= 4 ? 'X'.repeat(s.length) : 'X'.repeat(s.length - 4) + s.slice(-4);
};
const maskId = (n) => {
  if (!n) return null;
  const s = String(n);
  return s.length <= 4 ? 'X'.repeat(s.length) : 'X'.repeat(s.length - 4) + s.slice(-4);
};

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
    const [rows] = await pool.query('SELECT * FROM admins WHERE username = ?', [username]);
    const admin = rows[0];
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    if (!admin.is_active) return res.status(401).json({ error: 'This account has been deactivated' });
    const token = jwt.sign({ id: admin.id, username: admin.username, role: admin.role }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({
      token,
      username: admin.username,
      full_name: admin.full_name || admin.username,
      role: admin.role,
      screens: screensForUser(admin),
    });
  } catch (e) { next(e); }
});

router.use(requireAdmin);

router.get('/applications', requireScreen('members'), async (req, res, next) => {
  try {
    const { status, search, deleted } = req.query;
    const showDeleted = deleted === '1';
    if (showDeleted && req.adminUser.role !== 'admin') {
      return res.status(403).json({ error: 'Only administrators can view deleted members' });
    }
    let sql = `SELECT a.id, a.reference_no, a.membership_id, a.membership_type, a.membership_fee, a.name, a.place,
                      a.is_expat, a.status, a.payment_status, a.aadhaar_number, a.created_at, a.deleted_at,
                      (SELECT d.id FROM documents d WHERE d.application_id = a.id AND d.doc_type = 'photo' LIMIT 1) AS photo_doc_id
               FROM applications a WHERE a.deleted_at IS ${showDeleted ? 'NOT NULL' : 'NULL'}`;
    const params = [];
    if (status && status !== 'All') { sql += ' AND status = ?'; params.push(status); }
    if (search) { sql += ' AND (name LIKE ? OR reference_no LIKE ? OR membership_id LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    sql += ' ORDER BY created_at DESC LIMIT 500';
    const [rows] = await pool.query(sql, params);
    res.json(rows.map((r) => ({ ...r, aadhaar_number: maskAadhaar(r.aadhaar_number) })));
  } catch (e) { next(e); }
});

router.get('/applications/stats', requireScreen('overview'), async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT status, COUNT(*) AS count FROM applications WHERE deleted_at IS NULL GROUP BY status');
    const [totals] = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(payment_status = 'Paid') AS paid,
              SUM(created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS recent,
              SUM(status IN ('Pending Verification','Submitted','Correction Requested')) AS pending
       FROM applications WHERE deleted_at IS NULL`
    );
    const t = totals[0];
    res.json({
      byStatus: rows,
      total: t.total,
      paid: Number(t.paid) || 0,
      recent: Number(t.recent) || 0,
      pending: Number(t.pending) || 0,
    });
  } catch (e) { next(e); }
});

router.get('/applications/:id', requireScreen('members'), async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM applications WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Application not found' });
    const app = rows[0];
    const [docs] = await pool.query(
      'SELECT id, doc_type, original_name, mime_type, size_bytes, ocr_status, uploaded_at FROM documents WHERE application_id = ?',
      [app.id]
    );
    const [history] = await pool.query(
      'SELECT action, detail, actor, created_at FROM status_history WHERE application_id = ? ORDER BY created_at ASC, id ASC',
      [app.id]
    );
    const [customFields] = await pool.query('SELECT field_key, label, step FROM form_fields WHERE is_core = 0');
    const [plans] = await pool.query('SELECT code, name FROM membership_plans');
    app.aadhaar_masked = maskAadhaar(app.aadhaar_number);
    app.id_card_number_abroad_masked = maskId(app.id_card_number_abroad);
    app.plan_name = plans.find((p) => p.code === app.membership_type)?.name || app.membership_type;
    let custom = {};
    try { custom = app.custom_data ? JSON.parse(app.custom_data) : {}; } catch { custom = {}; }
    const customList = customFields
      .filter((f) => custom[f.field_key] !== undefined)
      .map((f) => ({ label: f.label, value: custom[f.field_key], step: f.step }));
    const [payments] = await pool.query('SELECT * FROM payments WHERE application_id = ?', [app.id]);
    res.json({ application: app, documents: docs, history, custom: customList, payment: payments[0] || null });
  } catch (e) { next(e); }
});

router.get('/documents/:id/file', requireScreen('members'), async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Document not found' });
    const doc = rows[0];
    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${doc.original_name.replace(/[^\w.\- ]/g, '_')}"`);
    res.sendFile(path.join(UPLOAD_DIR, path.basename(doc.file_name)));
  } catch (e) { next(e); }
});

function requireAdminRole(req, res) {
  if (req.adminUser.role !== 'admin') {
    res.status(403).json({ error: 'Only administrators can do this' });
    return false;
  }
  return true;
}

// Admin-role only: soft delete — moves the member to Deleted Members.
router.delete('/applications/:id', requireScreen('members'), async (req, res, next) => {
  try {
    if (!requireAdminRole(req, res)) return;
    const [rows] = await pool.query('SELECT id, reference_no FROM applications WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Application not found' });
    await pool.query('UPDATE applications SET deleted_at = NOW() WHERE id = ?', [rows[0].id]);
    await pool.query('INSERT INTO status_history (application_id, action, detail, actor) VALUES (?,?,?,?)',
      [rows[0].id, 'Deleted', 'Moved to Deleted Members', req.admin.username]);
    res.json({ ok: true, deleted: rows[0].reference_no });
  } catch (e) { next(e); }
});

// Admin-role only: restore a soft-deleted member.
router.post('/applications/:id/restore', requireScreen('members'), async (req, res, next) => {
  try {
    if (!requireAdminRole(req, res)) return;
    const [rows] = await pool.query('SELECT id FROM applications WHERE id = ? AND deleted_at IS NOT NULL', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Deleted application not found' });
    await pool.query('UPDATE applications SET deleted_at = NULL WHERE id = ?', [rows[0].id]);
    await pool.query('INSERT INTO status_history (application_id, action, detail, actor) VALUES (?,?,?,?)',
      [rows[0].id, 'Restored', 'Restored from Deleted Members', req.admin.username]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Admin-role only: permanent removal (only from Deleted Members) — record, documents and files.
router.delete('/applications/:id/purge', requireScreen('members'), async (req, res, next) => {
  try {
    if (!requireAdminRole(req, res)) return;
    const [rows] = await pool.query('SELECT id, reference_no FROM applications WHERE id = ? AND deleted_at IS NOT NULL', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Only members in Deleted Members can be permanently removed' });
    const app = rows[0];
    const [docs] = await pool.query('SELECT file_name FROM documents WHERE application_id = ?', [app.id]);
    await pool.query('DELETE FROM applications WHERE id = ?', [app.id]); // documents/history cascade
    for (const doc of docs) {
      try { fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(doc.file_name))); } catch { /* file already gone */ }
    }
    res.json({ ok: true, purged: app.reference_no });
  } catch (e) { next(e); }
});

const EDITABLE_FIELDS = [
  'name', 'father_name', 'house_name', 'place', 'post_office', 'panchayath', 'blood_group',
  'date_of_birth', 'aadhaar_number', 'qualification', 'phone_abroad', 'home_contact_number', 'id_card_number_abroad',
  'working_country', 'city', 'retired_year', 'phone_india', 'whatsapp_number', 'email',
  'current_job', 'years_abroad', 'emergency_name', 'emergency_phone',
];

// Admin-role only: edit member details.
router.put('/applications/:id', requireScreen('members'), async (req, res, next) => {
  try {
    if (!requireAdminRole(req, res)) return;
    const [rows] = await pool.query('SELECT * FROM applications WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Application not found' });
    const app = rows[0];
    const b = req.body || {};

    const updates = {};
    for (const key of EDITABLE_FIELDS) {
      if (b[key] === undefined) continue;
      if (key === 'years_abroad') { updates[key] = b[key] === '' ? 0 : Math.round(Number(b[key])) || 0; continue; }
      updates[key] = b[key] === '' ? null : b[key];
    }
    if (updates.name !== undefined && !String(updates.name || '').trim()) {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }
    if (updates.aadhaar_number !== undefined && updates.aadhaar_number !== null) {
      updates.aadhaar_number = String(updates.aadhaar_number).trim();
    }
    if (updates.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
      return res.status(400).json({ error: 'E-mail is invalid' });
    }
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update' });

    const changed = Object.keys(updates).filter((k) => String(updates[k] ?? '') !== String(app[k] ?? ''));
    const keys = Object.keys(updates);
    await pool.query(`UPDATE applications SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...Object.values(updates), app.id]);
    if (changed.length) {
      await pool.query('INSERT INTO status_history (application_id, action, detail, actor) VALUES (?,?,?,?)',
        [app.id, 'Edited', `Updated: ${changed.join(', ')}`, req.admin.username]);
    }
    const [fresh] = await pool.query('SELECT * FROM applications WHERE id = ?', [app.id]);
    const result = fresh[0];
    result.aadhaar_masked = maskAadhaar(result.aadhaar_number);
    res.json({ application: result });
  } catch (e) { next(e); }
});

// Lightweight lookup for the "Cash Collected By" dropdown — any logged-in dashboard user
// needs this (not gated by the 'users' screen, which is admin-only).
router.get('/users/collectors', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.username, a.full_name, a.role, r.label AS role_label
       FROM admins a LEFT JOIN roles r ON r.name = a.role
       WHERE a.is_active = 1 ORDER BY COALESCE(a.full_name, a.username)`
    );
    res.json(rows.map((r) => ({
      username: r.username,
      name: r.full_name || r.username,
      role: r.role,
      roleLabel: r.role_label || r.role,
    })));
  } catch (e) { next(e); }
});

/* ===================== Payments ===================== */

const receiptUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.bin';
      cb(null, `receipt_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.mimetype)) {
      return cb(new Error('Receipt must be a PDF, JPG or PNG'));
    }
    cb(null, true);
  },
});

async function insertReceiptDoc(conn, appId, file) {
  const [result] = await conn.query(
    'INSERT INTO documents (application_id, doc_type, file_name, original_name, mime_type, size_bytes, ocr_status) VALUES (?,?,?,?,?,?,?)',
    [appId, 'payment_receipt', file.filename, file.originalname, file.mimetype, file.size, 'not_applicable']
  );
  return result.insertId;
}

async function removeReceiptDoc(conn, docId) {
  if (!docId) return;
  const [docs] = await conn.query('SELECT file_name FROM documents WHERE id = ?', [docId]);
  await conn.query('DELETE FROM documents WHERE id = ?', [docId]);
  for (const doc of docs) {
    try { fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(doc.file_name))); } catch { /* already gone */ }
  }
}

// Unified "Payment due" list: new applications awaiting their first payment, active
// two-year members approaching/past their 2-year renewal mark (computed from their
// 'Approved' status_history entry — see project decision: this is independent of the
// plan's own fixed validity_start/end, which stays a shared term for all two-year members),
// and any member whose recorded payment is less than their plan fee (short/partial payment).
const RENEWAL_LOOKAHEAD_DAYS = 30;
router.get('/payments/due', requireScreen('payments'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         a.id, a.reference_no, a.membership_id, a.name, a.place, a.whatsapp_number,
         a.membership_type, a.membership_fee, a.status, a.payment_status, a.created_at,
         p.id AS payment_id, p.amount AS paid_amount, p.method, p.paid_on, p.note, p.collected_by, p.receipt_doc_id,
         appr.approved_on,
         DATE_ADD(appr.approved_on, INTERVAL 2 YEAR) AS renewal_due_on,
         GREATEST(a.membership_fee - COALESCE(p.amount, 0), 0) AS balance_amount,
         (a.status IN ('Pending Verification', 'Submitted')) AS is_new_application,
         (a.membership_type = 'two_year' AND a.status = 'Active' AND appr.approved_on IS NOT NULL
           AND DATE_ADD(appr.approved_on, INTERVAL 2 YEAR) <= DATE_ADD(CURDATE(), INTERVAL ${RENEWAL_LOOKAHEAD_DAYS} DAY)) AS is_renewal_due,
         (p.amount IS NOT NULL AND p.amount < a.membership_fee) AS is_balance_due
       FROM applications a
       LEFT JOIN payments p ON p.application_id = a.id
       LEFT JOIN (
         SELECT application_id, MAX(created_at) AS approved_on FROM status_history WHERE action = 'Approved' GROUP BY application_id
       ) appr ON appr.application_id = a.id
       WHERE a.deleted_at IS NULL
       HAVING is_new_application = 1 OR is_renewal_due = 1 OR is_balance_due = 1
       ORDER BY is_new_application DESC, is_renewal_due DESC, is_balance_due DESC, a.created_at DESC
       LIMIT 500`
    );
    res.json(rows.map((r) => ({
      ...r,
      is_new_application: !!r.is_new_application,
      is_renewal_due: !!r.is_renewal_due,
      is_balance_due: !!r.is_balance_due,
    })));
  } catch (e) { next(e); }
});

router.get('/payments', requireScreen('payments'), async (req, res, next) => {
  try {
    const { search, method, collected_by, recorded_by } = req.query;
    let sql = `SELECT p.*, a.name, a.reference_no, a.membership_id, a.membership_type, a.status AS member_status
               FROM payments p JOIN applications a ON a.id = p.application_id
               WHERE a.deleted_at IS NULL`;
    const params = [];
    if (search) {
      sql += ' AND (a.name LIKE ? OR a.reference_no LIKE ? OR a.membership_id LIKE ? OR p.receipt_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (method) { sql += ' AND p.method = ?'; params.push(method); }
    if (collected_by) { sql += ' AND p.collected_by = ?'; params.push(collected_by); }
    if (recorded_by) { sql += ' AND p.recorded_by = ?'; params.push(recorded_by); }
    sql += ' ORDER BY p.paid_on DESC, p.id DESC LIMIT 500';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) { next(e); }
});

// Records a payment. This is the "verify payment" step — it never approves or issues a
// membership ID on its own; those are separate, later, admin-only steps.
router.post(
  '/payments',
  receiptUpload.single('receipt'),
  requireAnyScreen('payments', 'approvals'),
  async (req, res, next) => {
    const { application_id, amount, method, paid_on, note } = req.body || {};
    const collected_by = req.adminUser.role === 'admin' ? req.body?.collected_by : req.admin.username;
    const amt = Number(amount);
    if (!application_id || !(amt > 0)) return res.status(400).json({ error: 'A valid amount is required' });
    if (!method?.trim()) return res.status(400).json({ error: 'Payment method is required' });
    if (!paid_on || isNaN(Date.parse(paid_on))) return res.status(400).json({ error: 'Payment date is invalid' });
    if (!collected_by?.trim()) return res.status(400).json({ error: 'Cash Collected By is required' });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [apps] = await conn.query('SELECT * FROM applications WHERE id = ? AND deleted_at IS NULL FOR UPDATE', [application_id]);
      if (!apps.length) { await conn.rollback(); return res.status(404).json({ error: 'Application not found' }); }
      const app = apps[0];
      const [existing] = await conn.query('SELECT id FROM payments WHERE application_id = ?', [app.id]);
      if (existing.length) { await conn.rollback(); return res.status(400).json({ error: 'A payment is already recorded for this member — edit it instead' }); }

      const receiptDocId = req.file ? await insertReceiptDoc(conn, app.id, req.file) : null;
      const receiptNumber = await generateReceiptNumber(conn);
      await conn.query(
        'INSERT INTO payments (application_id, amount, method, paid_on, note, receipt_doc_id, recorded_by, receipt_number, collected_by) VALUES (?,?,?,?,?,?,?,?,?)',
        [app.id, amt, method.trim(), paid_on, note?.trim() || null, receiptDocId, req.admin.username, receiptNumber, collected_by.trim()]
      );

      const newStatus = ['Pending Verification', 'Submitted'].includes(app.status) ? 'Payment Verified' : app.status;
      await conn.query(
        'UPDATE applications SET payment_status = ?, payment_note = ?, status = ? WHERE id = ?',
        ['Paid', note?.trim() || null, newStatus, app.id]
      );
      await conn.query('INSERT INTO status_history (application_id, action, detail, actor) VALUES (?,?,?,?)',
        [app.id, 'Payment Verified', `₹${amt.toLocaleString('en-IN')} via ${method.trim()}${req.file ? ' (receipt attached)' : ''}`, req.admin.username]);

      await conn.commit();

      const [fresh] = await pool.query('SELECT * FROM applications WHERE id = ?', [app.id]);
      const result = fresh[0];
      if (result.email) {
        const [[planRow]] = await pool.query('SELECT name FROM membership_plans WHERE code = ?', [result.membership_type]);
        try {
          const pdf = await buildReceiptPdf({
            payment: { receipt_number: receiptNumber, amount: amt, method: method.trim(), paid_on, note: note?.trim() || null, collected_by: collected_by.trim() },
            application: result,
            planName: planRow?.name || result.membership_type,
            societyName: 'REACH Pravasi Welfare Society',
          });
          const [s2, t2, b2] = templates.paid(result, receiptNumber);
          sendMail(result.email, s2, t2, b2, [{ filename: `${receiptNumber}.pdf`, content: pdf }]);
        } catch (e) {
          console.error('Receipt PDF generation failed:', e.message);
          const [s2, t2, b2] = templates.paid(result);
          sendMail(result.email, s2, t2, b2);
        }
      }
      result.aadhaar_masked = maskAadhaar(result.aadhaar_number);
      res.status(201).json({ application: result });
    } catch (e) {
      await conn.rollback();
      next(e);
    } finally {
      conn.release();
    }
  }
);

router.put('/payments/:id', receiptUpload.single('receipt'), requireScreen('payments'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    if (req.adminUser.role !== 'admin') { conn.release(); return res.status(403).json({ error: 'Only administrators can edit payments' }); }
    const { amount, method, paid_on, note, collected_by } = req.body || {};
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM payments WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!rows.length) { await conn.rollback(); return res.status(404).json({ error: 'Payment not found' }); }
    const p = rows[0];
    const amt = amount !== undefined ? Number(amount) : Number(p.amount);
    if (!(amt > 0)) { await conn.rollback(); return res.status(400).json({ error: 'A valid amount is required' }); }
    if (collected_by !== undefined && !collected_by.trim()) { await conn.rollback(); return res.status(400).json({ error: 'Cash Collected By is required' }); }

    let receiptDocId = p.receipt_doc_id;
    if (req.file) {
      await removeReceiptDoc(conn, p.receipt_doc_id);
      receiptDocId = await insertReceiptDoc(conn, p.application_id, req.file);
    }
    await conn.query(
      'UPDATE payments SET amount = ?, method = ?, paid_on = ?, note = ?, receipt_doc_id = ?, collected_by = ? WHERE id = ?',
      [amt, (method ?? p.method).trim(), paid_on || p.paid_on, note !== undefined ? (note.trim() || null) : p.note, receiptDocId,
       collected_by !== undefined ? collected_by.trim() : p.collected_by, p.id]
    );
    await conn.query('INSERT INTO status_history (application_id, action, detail, actor) VALUES (?,?,?,?)',
      [p.application_id, 'Payment Edited', `₹${amt.toLocaleString('en-IN')} via ${(method ?? p.method).trim()}`, req.admin.username]);
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

router.delete('/payments/:id', requireScreen('payments'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    if (req.adminUser.role !== 'admin') { conn.release(); return res.status(403).json({ error: 'Only administrators can delete payments' }); }
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM payments WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!rows.length) { await conn.rollback(); return res.status(404).json({ error: 'Payment not found' }); }
    const p = rows[0];
    await removeReceiptDoc(conn, p.receipt_doc_id);
    await conn.query('DELETE FROM payments WHERE id = ?', [p.id]);
    const [apps] = await conn.query('SELECT * FROM applications WHERE id = ? FOR UPDATE', [p.application_id]);
    if (apps.length) {
      const app = apps[0];
      const newStatus = app.status === 'Active' && app.membership_id ? 'Payment Pending' : app.status;
      await conn.query('UPDATE applications SET payment_status = ?, payment_note = NULL, status = ? WHERE id = ?',
        ['Unpaid', newStatus, app.id]);
      await conn.query('INSERT INTO status_history (application_id, action, detail, actor) VALUES (?,?,?,?)',
        [app.id, 'Payment Deleted', `Removed ₹${Number(p.amount).toLocaleString('en-IN')} (${p.method})`, req.admin.username]);
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    next(e);
  } finally {
    conn.release();
  }
});

/* ===================== Receipts ===================== */

router.get('/receipts', requireScreen('payments'), async (req, res, next) => {
  try {
    const { search } = req.query;
    let sql = `SELECT p.id, p.receipt_number, p.amount, p.method, p.paid_on, p.recorded_by, p.collected_by, p.created_at,
                      a.id AS application_id, a.name, a.reference_no, a.membership_id, a.membership_type, a.email
               FROM payments p JOIN applications a ON a.id = p.application_id
               WHERE a.deleted_at IS NULL AND p.receipt_number IS NOT NULL`;
    const params = [];
    if (search) {
      sql += ' AND (a.name LIKE ? OR a.reference_no LIKE ? OR a.membership_id LIKE ? OR p.receipt_number LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY p.paid_on DESC, p.id DESC LIMIT 500';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/receipts/:paymentId/pdf', requireAnyScreen('payments', 'approvals'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, a.name, a.reference_no, a.membership_id, a.membership_type
       FROM payments p JOIN applications a ON a.id = p.application_id
       WHERE p.id = ? AND p.receipt_number IS NOT NULL`,
      [req.params.paymentId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Receipt not found' });
    const p = rows[0];
    const [[plan]] = await pool.query('SELECT name FROM membership_plans WHERE code = ?', [p.membership_type]);
    const pdf = await buildReceiptPdf({
      payment: p,
      application: p,
      planName: plan?.name || p.membership_type,
      societyName: 'REACH Pravasi Welfare Society',
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${p.receipt_number}.pdf"`);
    res.send(pdf);
  } catch (e) { next(e); }
});

// Society-wide member counter kept in the settings table (row-locked inside the approve transaction).
async function nextMemberSeq(conn) {
  const [rows] = await conn.query("SELECT value FROM settings WHERE name = 'member_seq' FOR UPDATE");
  let next;
  if (rows.length) {
    try { next = Number(JSON.parse(rows[0].value).next) || 1; } catch { next = 1; }
    await conn.query("UPDATE settings SET value = ? WHERE name = 'member_seq'", [JSON.stringify({ next: next + 1 })]);
  } else {
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM applications WHERE membership_id IS NOT NULL');
    next = n + 1;
    await conn.query("INSERT INTO settings (name, value) VALUES ('member_seq', ?)", [JSON.stringify({ next: next + 1 })]);
  }
  return next;
}

async function generateMembershipId(conn, app) {
  const [cfgRows] = await conn.query("SELECT value FROM settings WHERE name = 'membership_id'");
  let cfg = { mode: 'pattern', pattern: 'REACH-{YEAR}-{SEQ}', digits: 4 };
  if (cfgRows.length) {
    try { cfg = { ...cfg, ...JSON.parse(cfgRows[0].value) }; } catch { /* keep defaults */ }
  }
  const digits = Math.min(8, Math.max(2, Number(cfg.digits) || 4));

  for (let attempt = 0; attempt < 100; attempt++) {
    const seq = await nextMemberSeq(conn);
    const pad = String(seq).padStart(digits, '0');
    let id;
    if (cfg.mode === 'panchayath') {
      const letters = String(app.panchayath || '').replace(/[^A-Za-z]/g, '').toUpperCase();
      const prefix = (letters.slice(0, 4) || 'MEMB').padEnd(4, 'X');
      id = `${prefix}${pad}`;
    } else {
      let pattern = cfg.pattern || 'REACH-{YEAR}-{SEQ}';
      if (!pattern.includes('{SEQ}')) pattern += '{SEQ}';
      id = pattern
        .replaceAll('{YEAR}', String(new Date().getFullYear()))
        .replaceAll('{SEQ}', pad);
    }
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM applications WHERE membership_id = ?', [id]);
    if (!n) return id;
  }
  throw new Error('Could not generate a unique membership ID');
}

// Society-wide receipt counter, same bootstrap pattern as nextMemberSeq.
async function nextReceiptSeq(conn) {
  const [rows] = await conn.query("SELECT value FROM settings WHERE name = 'receipt_seq' FOR UPDATE");
  let next;
  if (rows.length) {
    try { next = Number(JSON.parse(rows[0].value).next) || 1; } catch { next = 1; }
    await conn.query("UPDATE settings SET value = ? WHERE name = 'receipt_seq'", [JSON.stringify({ next: next + 1 })]);
  } else {
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM payments WHERE receipt_number IS NOT NULL');
    next = n + 1;
    await conn.query("INSERT INTO settings (name, value) VALUES ('receipt_seq', ?)", [JSON.stringify({ next: next + 1 })]);
  }
  return next;
}

async function generateReceiptNumber(conn) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const seq = await nextReceiptSeq(conn);
    const id = `RCPT-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM payments WHERE receipt_number = ?', [id]);
    if (!n) return id;
  }
  throw new Error('Could not generate a unique receipt number');
}

const ACTION_SCREEN = {
  approve: 'approvals',
  generate_id_card: 'approvals',
  reject: 'approvals',
  mark_paid: 'payments',
  deactivate: 'members',
  reactivate: 'members',
};
const ADMIN_ONLY_ACTIONS = ['approve', 'generate_id_card', 'deactivate', 'reactivate'];

router.post('/applications/:id/action', async (req, res, next) => {
  const { action, note } = req.body || {};
  const screen = ACTION_SCREEN[action];
  if (!screen) return res.status(400).json({ error: 'Unknown action' });
  // Enforce screen access for this specific action type.
  requireScreen(screen)(req, res, async () => {
    if (ADMIN_ONLY_ACTIONS.includes(action) && !requireAdminRole(req, res)) return;
    const actor = req.admin.username;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query('SELECT * FROM applications WHERE id = ? FOR UPDATE', [req.params.id]);
      if (!rows.length) { await conn.rollback(); return res.status(404).json({ error: 'Application not found' }); }
      const app = rows[0];
      const [[plan]] = await conn.query('SELECT * FROM membership_plans WHERE code = ?', [app.membership_type]);

      let update = {};
      let historyAction = action;
      let detail = note || null;
      let mailKey = null;

      switch (action) {
        case 'approve': {
          if (app.status !== 'Payment Verified') {
            await conn.rollback();
            return res.status(400).json({ error: 'Payment must be verified before approving' });
          }
          update = { status: 'Approved', admin_note: note || app.admin_note };
          historyAction = 'Approved';
          detail = note ? `Approved. Note: ${note}` : 'Approved — awaiting ID card generation.';
          mailKey = 'approved';
          break;
        }
        case 'generate_id_card': {
          if (app.status !== 'Approved') {
            await conn.rollback();
            return res.status(400).json({ error: 'Application must be approved before generating the ID card' });
          }
          if (app.membership_id) {
            await conn.rollback();
            return res.status(400).json({ error: 'Membership ID has already been generated for this member' });
          }
          const membershipId = await generateMembershipId(conn, app);
          let validityStart, validityEnd;
          if (plan && plan.validity_type === 'range') {
            validityStart = plan.validity_start;
            validityEnd = plan.validity_end;
          } else {
            validityStart = new Date().toISOString().slice(0, 10);
            validityEnd = null;
          }
          update = { status: 'Active', membership_id: membershipId, validity_start: validityStart, validity_end: validityEnd };
          historyAction = 'ID Card Generated';
          detail = `Membership ID ${membershipId} generated. Status: Active.`;
          mailKey = 'approved';
          break;
        }
        case 'reject':
          if (!['Pending Verification', 'Submitted', 'Payment Verified'].includes(app.status)) {
            await conn.rollback();
            return res.status(400).json({ error: 'This application can no longer be rejected' });
          }
          update = { status: 'Rejected', admin_note: note || app.admin_note };
          historyAction = 'Rejected';
          mailKey = 'rejected';
          break;
        case 'mark_paid': {
          const status = ['Payment Pending', 'Approved'].includes(app.status) && app.membership_id ? 'Active' : app.status;
          update = { payment_status: 'Paid', payment_note: note || null, status };
          historyAction = 'Payment Recorded';
          detail = note ? `Payment recorded: ${note}` : 'Payment recorded';
          mailKey = 'paid';
          break;
        }
        case 'deactivate': {
          if (app.status !== 'Active') {
            await conn.rollback();
            return res.status(400).json({ error: 'Only Active members can be deactivated' });
          }
          update = { status: 'Deactivated', admin_note: note || app.admin_note };
          historyAction = 'Deactivated';
          break;
        }
        case 'reactivate': {
          if (app.status !== 'Deactivated') {
            await conn.rollback();
            return res.status(400).json({ error: 'Only deactivated members can be reactivated' });
          }
          update = { status: 'Active', admin_note: note || app.admin_note };
          historyAction = 'Reactivated';
          break;
        }
      }

      const fields = Object.keys(update).map((k) => `${k} = ?`).join(', ');
      await conn.query(`UPDATE applications SET ${fields} WHERE id = ?`, [...Object.values(update), app.id]);
      await conn.query(
        'INSERT INTO status_history (application_id, action, detail, actor) VALUES (?,?,?,?)',
        [app.id, historyAction, detail, actor]
      );
      await conn.commit();

      const [updated] = await pool.query('SELECT * FROM applications WHERE id = ?', [app.id]);
      const result = updated[0];
      result.aadhaar_masked = maskAadhaar(result.aadhaar_number);
      result.id_card_number_abroad_masked = maskId(result.id_card_number_abroad);

      if (mailKey && result.email) {
        const [subject, title, body] = templates[mailKey](result, note);
        sendMail(result.email, subject, title, body); // fire and forget
      }

      res.json({ application: result });
    } catch (e) {
      await conn.rollback();
      next(e);
    } finally {
      conn.release();
    }
  });
});

export default router;
