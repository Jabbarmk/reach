import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../db.js';
import { sendMail } from '../mailer.js';

const router = express.Router();

const maskAadhaar = (n) => {
  if (!n) return 'XXXX XXXX XXXX';
  const s = String(n);
  return s.length <= 4 ? 'X'.repeat(s.length) : 'X'.repeat(s.length - 4) + s.slice(-4);
};

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex');
const genCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

// Step 1: member enters their registered e-mail, gets a 6-digit code by mail.
router.post('/login/request', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim();
    if (!email) return res.status(400).json({ error: 'E-mail is required' });

    const [rows] = await pool.query(
      "SELECT id, name, reference_no FROM applications WHERE email = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1",
      [email]
    );
    if (!rows.length) return res.status(404).json({ error: 'No application found for this e-mail' });
    const app = rows[0];

    const [recent] = await pool.query(
      "SELECT id FROM member_otps WHERE application_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE) LIMIT 1",
      [app.id]
    );
    if (recent.length) return res.status(429).json({ error: 'Please wait a minute before requesting another code' });

    const code = genCode();
    await pool.query(
      'INSERT INTO member_otps (application_id, code_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))',
      [app.id, hashCode(code), OTP_TTL_MINUTES]
    );

    const { sent } = await sendMail(
      email,
      'Your REACH Login Code',
      'Member Login',
      `<p>Dear <strong>${app.name}</strong>,</p>
       <p>Your one-time login code is:</p>
       <p style="font-size:28px;font-weight:700;letter-spacing:4px;color:#0d2a6b">${code}</p>
       <p>This code expires in ${OTP_TTL_MINUTES} minutes. If you did not request this, you can ignore this e-mail.</p>`
    );
    if (!sent) return res.status(500).json({ error: 'Could not send the login code. Please try again later or contact the society office.' });

    res.json({ ok: true, reference_no: app.reference_no });
  } catch (e) { next(e); }
});

// Step 2: member submits the code, gets a member session token.
router.post('/login/verify', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim();
    const code = String(req.body?.code || '').trim();
    if (!email || !code) return res.status(400).json({ error: 'E-mail and code are required' });

    const [rows] = await pool.query(
      "SELECT id, name FROM applications WHERE email = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1",
      [email]
    );
    if (!rows.length) return res.status(404).json({ error: 'No application found for this e-mail' });
    const app = rows[0];

    const [otps] = await pool.query(
      `SELECT * FROM member_otps WHERE application_id = ? AND consumed_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [app.id]
    );
    const otp = otps[0];
    if (!otp) return res.status(400).json({ error: 'Code expired or not found. Please request a new one.' });
    if (otp.attempts >= MAX_ATTEMPTS) return res.status(400).json({ error: 'Too many attempts. Please request a new code.' });

    if (hashCode(code) !== otp.code_hash) {
      await pool.query('UPDATE member_otps SET attempts = attempts + 1 WHERE id = ?', [otp.id]);
      return res.status(401).json({ error: 'Incorrect code' });
    }

    await pool.query('UPDATE member_otps SET consumed_at = NOW() WHERE id = ?', [otp.id]);
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

export default router;
