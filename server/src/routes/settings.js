import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';
import { requireAdmin, requireScreen } from '../middleware/auth.js';
import { buildTransport, getSmtpConfig } from '../mailer.js';
import { mergeHomeContent } from '../homeContent.js';
import { mergeMemberCountries } from '../memberCountries.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRANDING_DIR = path.join(__dirname, '..', '..', 'branding');

const router = express.Router();
router.use(requireAdmin, requireScreen('settings'));

export const REGISTRATION_DEFAULTS = {
  open: true,
  closed_message: 'New Membership Registration Temporarily Closed, Contact Admin',
};
export const ID_FORMAT_DEFAULTS = { mode: 'pattern', pattern: 'REACH-{YEAR}-{SEQ}', digits: 4 };
export const REF_FORMAT_DEFAULTS = { pattern: 'REACH-APP-{YEAR}-{SEQ}', digits: 5 };

async function getSetting(name, defaults) {
  const [rows] = await pool.query('SELECT value FROM settings WHERE name = ?', [name]);
  if (!rows.length) return { ...defaults };
  try { return { ...defaults, ...JSON.parse(rows[0].value) }; } catch { return { ...defaults }; }
}
async function putSetting(name, value) {
  await pool.query(
    'INSERT INTO settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
    [name, JSON.stringify(value)]
  );
}

/* ===== Registration open/close ===== */
router.get('/registration', async (req, res, next) => {
  try { res.json(await getSetting('registration', REGISTRATION_DEFAULTS)); } catch (e) { next(e); }
});

router.put('/registration', async (req, res, next) => {
  try {
    const { open, closed_message } = req.body || {};
    const current = await getSetting('registration', REGISTRATION_DEFAULTS);
    const cfg = {
      open: typeof open === 'boolean' ? open : current.open,
      closed_message: closed_message !== undefined
        ? (String(closed_message).trim().slice(0, 500) || REGISTRATION_DEFAULTS.closed_message)
        : current.closed_message,
    };
    await putSetting('registration', cfg);
    res.json(cfg);
  } catch (e) { next(e); }
});

/* ===== Declarations (shown as a single checkbox on the registration form's final step) ===== */
router.get('/declarations', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM declarations ORDER BY sort_order, id');
    res.json({ declarations: rows });
  } catch (e) { next(e); }
});

router.post('/declarations', async (req, res, next) => {
  try {
    const { text } = req.body || {};
    if (!text?.trim()) return res.status(400).json({ error: 'Text is required' });
    const [[{ maxSort }]] = await pool.query('SELECT COALESCE(MAX(sort_order),0) AS maxSort FROM declarations');
    const [result] = await pool.query('INSERT INTO declarations (text, sort_order) VALUES (?,?)', [text.trim(), maxSort + 1]);
    res.status(201).json({ declaration: { id: result.insertId, text: text.trim(), sort_order: maxSort + 1 } });
  } catch (e) { next(e); }
});

router.put('/declarations/:id', async (req, res, next) => {
  try {
    const { text } = req.body || {};
    if (!text?.trim()) return res.status(400).json({ error: 'Text is required' });
    await pool.query('UPDATE declarations SET text = ? WHERE id = ?', [text.trim(), req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/declarations/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM declarations WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ===== Home page content ===== */
router.get('/home-content', async (req, res, next) => {
  try {
    const stored = await getSetting('home_content', null);
    res.json(mergeHomeContent(stored));
  } catch (e) { next(e); }
});

router.put('/home-content', async (req, res, next) => {
  try {
    const merged = mergeHomeContent(req.body || {});
    await putSetting('home_content', merged);
    res.json(merged);
  } catch (e) { next(e); }
});

/* ===== Member countries marquee ===== */
router.get('/member-countries', async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT value FROM settings WHERE name = 'member_countries'");
    let stored = null;
    if (rows.length) { try { stored = JSON.parse(rows[0].value); } catch { stored = null; } }
    res.json(mergeMemberCountries(stored));
  } catch (e) { next(e); }
});

router.put('/member-countries', async (req, res, next) => {
  try {
    const merged = mergeMemberCountries(req.body || {});
    await putSetting('member_countries', merged);
    res.json(merged);
  } catch (e) { next(e); }
});

/* ===== Logo ===== */
const logoUpload = multer({
  storage: multer.diskStorage({
    destination: BRANDING_DIR,
    filename: (req, file, cb) => {
      const ext = file.mimetype === 'image/png' ? '.png' : '.jpg';
      cb(null, `logo_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png'].includes(file.mimetype)) return cb(new Error('Logo must be a JPG or PNG image'));
    cb(null, true);
  },
});

router.post('/logo', logoUpload.single('logo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Please choose a logo image' });
    const previous = await getSetting('logo', {});
    await putSetting('logo', { file: req.file.filename, mime: req.file.mimetype });
    // Remove the previously uploaded logo file (never the shipped default).
    if (previous.file && previous.file !== 'logo_default.jpeg') {
      try { fs.unlinkSync(path.join(BRANDING_DIR, path.basename(previous.file))); } catch { /* already gone */ }
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/logo', async (req, res, next) => {
  try {
    const previous = await getSetting('logo', {});
    await pool.query("DELETE FROM settings WHERE name = 'logo'");
    if (previous.file && previous.file !== 'logo_default.jpeg') {
      try { fs.unlinkSync(path.join(BRANDING_DIR, path.basename(previous.file))); } catch { /* already gone */ }
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/* ===== Membership ID format ===== */
router.get('/membership-id', async (req, res, next) => {
  try { res.json(await getSetting('membership_id', ID_FORMAT_DEFAULTS)); } catch (e) { next(e); }
});

router.put('/membership-id', async (req, res, next) => {
  try {
    const { mode, pattern, digits } = req.body || {};
    if (!['pattern', 'panchayath'].includes(mode)) return res.status(400).json({ error: 'Invalid format type' });
    const d = Math.min(8, Math.max(2, Number(digits) || 4));
    let p = String(pattern || ID_FORMAT_DEFAULTS.pattern).trim().slice(0, 40);
    if (mode === 'pattern') {
      if (!p) return res.status(400).json({ error: 'Pattern is required' });
      if (!p.includes('{SEQ}')) return res.status(400).json({ error: 'Pattern must contain {SEQ}' });
      if (/[^A-Za-z0-9{}\/\-_.]/.test(p)) return res.status(400).json({ error: 'Pattern may only contain letters, numbers, - _ / . and the placeholders' });
    }
    const cfg = { mode, pattern: p || ID_FORMAT_DEFAULTS.pattern, digits: d };
    await putSetting('membership_id', cfg);
    res.json(cfg);
  } catch (e) { next(e); }
});

/* ===== Members page default view ===== */
router.get('/members-default-view', async (req, res, next) => {
  try { res.json(await getSetting('members_default_view', { view: 'grid' })); } catch (e) { next(e); }
});

router.put('/members-default-view', async (req, res, next) => {
  try {
    const cfg = { view: req.body?.view === 'table' ? 'table' : 'grid' };
    await putSetting('members_default_view', cfg);
    res.json(cfg);
  } catch (e) { next(e); }
});

/* ===== Application reference number format ===== */
router.get('/reference-format', async (req, res, next) => {
  try { res.json(await getSetting('reference_format', REF_FORMAT_DEFAULTS)); } catch (e) { next(e); }
});

router.put('/reference-format', async (req, res, next) => {
  try {
    const { pattern, digits } = req.body || {};
    const d = Math.min(8, Math.max(2, Number(digits) || 5));
    let p = String(pattern || REF_FORMAT_DEFAULTS.pattern).trim().slice(0, 40);
    if (!p) return res.status(400).json({ error: 'Pattern is required' });
    if (!p.includes('{SEQ}')) return res.status(400).json({ error: 'Pattern must contain {SEQ}' });
    if (/[^A-Za-z0-9{}\/\-_.]/.test(p)) return res.status(400).json({ error: 'Pattern may only contain letters, numbers, - _ / . and the placeholders' });
    const cfg = { pattern: p, digits: d };
    await putSetting('reference_format', cfg);
    res.json(cfg);
  } catch (e) { next(e); }
});

router.get('/smtp', async (req, res, next) => {
  try {
    const cfg = (await getSmtpConfig()) || {};
    res.json({
      enabled: Boolean(cfg.enabled),
      host: cfg.host || '',
      port: cfg.port || 587,
      username: cfg.username || '',
      has_password: Boolean(cfg.password),
      from_name: cfg.from_name || 'REACH Pravasi Welfare Society',
      from_email: cfg.from_email || '',
    });
  } catch (e) { next(e); }
});

router.put('/smtp', async (req, res, next) => {
  try {
    const { enabled, host, port, username, password, from_name, from_email } = req.body || {};
    const existing = (await getSmtpConfig()) || {};
    const cfg = {
      enabled: Boolean(enabled),
      host: (host || '').trim(),
      port: Number(port) || 587,
      username: (username || '').trim(),
      // Empty password field keeps the stored one.
      password: password ? password : existing.password || '',
      from_name: (from_name || '').trim(),
      from_email: (from_email || '').trim(),
    };
    if (cfg.enabled && (!cfg.host || !cfg.from_email)) {
      return res.status(400).json({ error: 'Host and from-address are required to enable email sending' });
    }
    await pool.query(
      "INSERT INTO settings (name, value) VALUES ('smtp', ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
      [JSON.stringify(cfg)]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/smtp/test', async (req, res, next) => {
  try {
    const { to } = req.body || {};
    if (!to) return res.status(400).json({ error: 'Recipient email is required' });
    const cfg = await getSmtpConfig();
    if (!cfg?.host) return res.status(400).json({ error: 'Save the SMTP settings first' });
    try {
      const transport = buildTransport(cfg);
      await transport.sendMail({
        from: cfg.from_name ? `"${cfg.from_name}" <${cfg.from_email}>` : cfg.from_email,
        to,
        subject: 'REACH SMTP test',
        text: 'Your REACH Membership Management SMTP settings are working correctly.',
      });
      res.json({ ok: true, message: `Test email sent to ${to}` });
    } catch (e) {
      res.status(400).json({ error: `Sending failed: ${e.message}` });
    }
  } catch (e) { next(e); }
});

export default router;
