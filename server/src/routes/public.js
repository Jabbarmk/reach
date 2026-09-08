import express from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';
import { sendMail, templates } from '../mailer.js';
import { mergeHomeContent } from '../homeContent.js';
import { mergeMemberCountries, attachLiveCounts } from '../memberCountries.js';
import { getLogoPath } from '../branding.js';
import { NEWS_DIR } from './news.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

const ALLOWED = {
  photo: ['image/jpeg', 'image/png'],
  aadhaar: ['image/jpeg', 'image/png', 'application/pdf'],
  id_card: ['image/jpeg', 'image/png', 'application/pdf'],
};

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.bin';
    cb(null, `${file.fieldname}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ALLOWED[file.fieldname];
    if (!allowed) return cb(new Error('Unexpected file field'));
    if (!allowed.includes(file.mimetype)) return cb(new Error(`Invalid file type for ${file.fieldname}`));
    cb(null, true);
  },
});

// Public: current society logo (uploaded via Settings, falling back to the default).
router.get('/logo', async (req, res) => {
  const logoPath = await getLogoPath();
  res.setHeader('Content-Type', logoPath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(logoPath);
});

// Public: home page content (hero, about, activities, contact details, footer) from the settings table.
router.get('/home-content', async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT value FROM settings WHERE name = 'home_content'");
    let stored = null;
    if (rows.length) { try { stored = JSON.parse(rows[0].value); } catch { stored = null; } }
    res.json(mergeHomeContent(stored));
  } catch (e) { next(e); }
});

// Public: homepage "Our Members Country" marquee list.
router.get('/member-countries', async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT value FROM settings WHERE name = 'member_countries'");
    let stored = null;
    if (rows.length) { try { stored = JSON.parse(rows[0].value); } catch { stored = null; } }
    res.json(await attachLiveCounts(mergeMemberCountries(stored)));
  } catch (e) { next(e); }
});

// Public: News & Announcements / Events list (published items only).
router.get('/news', async (req, res, next) => {
  try {
    const limitNum = Number(req.query.limit);
    let sql = 'SELECT id, kind, tag, title, body, image_file, published_on FROM news_items WHERE is_published = 1 ORDER BY published_on DESC, id DESC';
    if (Number.isFinite(limitNum) && limitNum > 0) {
      sql += ` LIMIT ${Math.min(Math.floor(limitNum), 100)}`;
    }
    const [rows] = await pool.query(sql);
    if (!rows.length) return res.json(rows);
    const [images] = await pool.query(
      'SELECT id, news_item_id FROM news_item_images WHERE news_item_id IN (?) ORDER BY sort_order, id',
      [rows.map((r) => r.id)]
    );
    const byItem = new Map();
    for (const img of images) {
      if (!byItem.has(img.news_item_id)) byItem.set(img.news_item_id, []);
      byItem.get(img.news_item_id).push({ id: img.id });
    }
    res.json(rows.map((r) => ({ ...r, images: byItem.get(r.id) || [] })));
  } catch (e) { next(e); }
});

router.get('/news/:id/image', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT image_file, image_mime FROM news_items WHERE id = ? AND is_published = 1', [req.params.id]);
    if (!rows.length || !rows[0].image_file) return res.status(404).end();
    res.setHeader('Content-Type', rows[0].image_mime || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(path.join(NEWS_DIR, path.basename(rows[0].image_file)));
  } catch (e) { next(e); }
});

router.get('/news/:id/gallery/:imageId', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT gi.image_file, gi.image_mime FROM news_item_images gi
       JOIN news_items ni ON ni.id = gi.news_item_id
       WHERE gi.id = ? AND gi.news_item_id = ? AND ni.is_published = 1`,
      [req.params.imageId, req.params.id]
    );
    if (!rows.length) return res.status(404).end();
    res.setHeader('Content-Type', rows[0].image_mime || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(path.join(NEWS_DIR, path.basename(rows[0].image_file)));
  } catch (e) { next(e); }
});

const REGISTRATION_DEFAULTS = {
  open: true,
  closed_message: 'New Membership Registration Temporarily Closed, Contact Admin',
};

async function getRegistrationStatus() {
  const [rows] = await pool.query("SELECT value FROM settings WHERE name = 'registration'");
  if (!rows.length) return { ...REGISTRATION_DEFAULTS };
  try { return { ...REGISTRATION_DEFAULTS, ...JSON.parse(rows[0].value) }; } catch { return { ...REGISTRATION_DEFAULTS }; }
}

async function loadFormConfig() {
  const [fields] = await pool.query('SELECT * FROM form_fields ORDER BY step, sort_order, id');
  const [plans] = await pool.query('SELECT * FROM membership_plans WHERE is_active = 1 ORDER BY sort_order, id');
  const [optionRows] = await pool.query('SELECT list_key, value FROM option_lists ORDER BY list_key, sort_order, id');
  const options = {};
  for (const row of optionRows) (options[row.list_key] ||= []).push(row.value);
  const registration = await getRegistrationStatus();
  const [declarations] = await pool.query('SELECT id, text FROM declarations ORDER BY sort_order, id');
  return { fields, plans, options, registration, declarations };
}

// Public: everything the registration form needs to render itself.
router.get('/form-config', async (req, res, next) => {
  try {
    res.json(await loadFormConfig());
  } catch (e) { next(e); }
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Society-wide reference-number counter (same bootstrap pattern as membership IDs/receipts).
async function nextReferenceSeq(conn) {
  const [rows] = await conn.query("SELECT value FROM settings WHERE name = 'reference_seq' FOR UPDATE");
  let next;
  if (rows.length) {
    try { next = Number(JSON.parse(rows[0].value).next) || 1; } catch { next = 1; }
    await conn.query("UPDATE settings SET value = ? WHERE name = 'reference_seq'", [JSON.stringify({ next: next + 1 })]);
  } else {
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM applications');
    next = n + 1;
    await conn.query("INSERT INTO settings (name, value) VALUES ('reference_seq', ?)", [JSON.stringify({ next: next + 1 })]);
  }
  return next;
}

async function generateReferenceNumber(conn) {
  const [cfgRows] = await conn.query("SELECT value FROM settings WHERE name = 'reference_format'");
  let cfg = { pattern: 'REACH-APP-{YEAR}-{SEQ}', digits: 5 };
  if (cfgRows.length) {
    try { cfg = { ...cfg, ...JSON.parse(cfgRows[0].value) }; } catch { /* keep defaults */ }
  }
  const digits = Math.min(8, Math.max(2, Number(cfg.digits) || 5));
  for (let attempt = 0; attempt < 100; attempt++) {
    const seq = await nextReferenceSeq(conn);
    const pad = String(seq).padStart(digits, '0');
    let pattern = cfg.pattern || 'REACH-APP-{YEAR}-{SEQ}';
    if (!pattern.includes('{SEQ}')) pattern += '{SEQ}';
    const refNo = pattern.replaceAll('{YEAR}', String(new Date().getFullYear())).replaceAll('{SEQ}', pad);
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM applications WHERE reference_no = ?', [refNo]);
    if (!n) return refNo;
  }
  throw new Error('Could not generate a unique reference number');
}

router.post(
  '/applications',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'aadhaar', maxCount: 1 },
    { name: 'id_card', maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const registration = await getRegistrationStatus();
      if (!registration.open) {
        return res.status(403).json({ errors: [registration.closed_message] });
      }
      const d = req.body;
      const cfg = await loadFormConfig();
      const fmap = Object.fromEntries(cfg.fields.map((f) => [f.field_key, f]));
      const need = (key) => {
        const f = fmap[key];
        return f ? Boolean(f.required && f.visible) : true;
      };
      const label = (key, fallback) => (fmap[key]?.label || fallback).replace(/^\d+\.\s*/, '');
      const errors = [];

      const plan = cfg.plans.find((p) => p.code === d.membership_type);
      if (!plan) errors.push('Please select a valid membership plan');

      const isExpat = d.is_expat === '1' || d.is_expat === 'true';

      if (need('photo') && !req.files?.photo?.length) errors.push(`${label('photo', 'Photo')} is required`);
      if (need('aadhaar_upload') && !req.files?.aadhaar?.length) errors.push(`${label('aadhaar_upload', 'Aadhaar card upload')} is required`);
      if (isExpat && need('id_card_upload') && !req.files?.id_card?.length) errors.push(`${label('id_card_upload', 'ID card upload')} is required`);

      const reqText = (key, value, fallback) => {
        if (need(key) && !String(value || '').trim()) errors.push(`${label(key, fallback)} is required`);
      };

      reqText('name', d.name, 'Name');
      reqText('father_name', d.father_name, "Father's name");
      reqText('house_name', d.house_name, 'House name');
      reqText('place', d.place, 'Place');
      reqText('post_office', d.post_office, 'Post office');
      reqText('panchayath', d.panchayath, 'Panchayath/Municipality');
      reqText('blood_group', d.blood_group, 'Blood group');
      reqText('qualification', d.qualification, 'Qualification');

      if (need('date_of_birth') && !d.date_of_birth) errors.push(`${label('date_of_birth', 'Date of birth')} is required`);
      if (d.date_of_birth) {
        if (isNaN(Date.parse(d.date_of_birth))) errors.push('Date of birth is invalid');
        else if (new Date(d.date_of_birth) > new Date()) errors.push('Date of birth cannot be in the future');
      }

      const aadhaar = String(d.aadhaar_number || '').trim();
      if (need('aadhaar_number') && !aadhaar) errors.push(`${label('aadhaar_number', 'ID card number')} is required`);

      if (isExpat) {
        reqText('phone_abroad', d.phone_abroad, 'Phone number (abroad)');
        reqText('home_contact_number', d.home_contact_number, 'Home contact number');
        reqText('id_card_number_abroad', d.id_card_number_abroad, 'ID card number (abroad)');
        reqText('working_country', d.working_country, 'Working country');
        reqText('city', d.city, 'City');
      } else {
        if (need('retired_year')) {
          const y = Number(d.retired_year);
          if (!y || y < 1900 || y > new Date().getFullYear()) errors.push('Retired year is invalid');
        }
        reqText('phone_india', d.phone_india, 'Phone number (India)');
      }

      reqText('whatsapp_number', d.whatsapp_number, 'WhatsApp number');
      if (need('email') && !d.email) errors.push(`${label('email', 'E-mail')} is required`);
      if (d.email && !EMAIL_RE.test(d.email)) errors.push('E-mail is invalid');
      reqText('current_job', d.current_job, 'Current job');
      if (need('years_abroad') && d.years_abroad === undefined) errors.push(`${label('years_abroad', 'Total years abroad')} is required`);
      if (d.years_abroad !== undefined && d.years_abroad !== '' && Number(d.years_abroad) < 0) errors.push('Total years abroad must be 0 or more');
      reqText('emergency_name', d.emergency_name, 'Friend/family name');
      reqText('emergency_phone', d.emergency_phone, 'Friend/family phone number');

      // Custom fields
      let customIn = {};
      try { customIn = d.custom ? JSON.parse(d.custom) : {}; } catch { customIn = {}; }
      const customData = {};
      for (const f of cfg.fields) {
        if (f.is_core || !f.visible) continue;
        if (f.step === 'expat' && !isExpat) continue;
        if (f.step === 'retired' && isExpat) continue;
        const value = customIn[f.field_key];
        const empty = value === undefined || value === null || String(value).trim() === '';
        if (f.required && empty) errors.push(`${f.label} is required`);
        if (!empty) customData[f.field_key] = String(value).trim().slice(0, 500);
      }

      if (d.consent_accepted !== '1' && d.consent_accepted !== 'true') errors.push('You must accept the terms and privacy policy');
      if (d.declaration_accepted !== '1' && d.declaration_accepted !== 'true') errors.push('You must accept the declaration to submit');

      if (errors.length) return res.status(400).json({ errors });

      const fee = plan.fee;

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const referenceNo = await generateReferenceNumber(conn);
        const [result] = await conn.query(
          `INSERT INTO applications
            (reference_no, membership_type, membership_fee, name, father_name, house_name, place, post_office,
             panchayath, blood_group, date_of_birth, aadhaar_number, qualification, is_expat,
             phone_abroad, home_contact_number, id_card_number_abroad, working_country, city, retired_year, phone_india,
             whatsapp_number, email, current_job, years_abroad, emergency_name, emergency_phone,
             custom_data, status, payment_status, consent_accepted, declaration_accepted)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'Pending Verification', 'Unpaid', 1, 1)`,
          [
            referenceNo, plan.code, fee,
            (d.name || '').trim(), (d.father_name || '').trim(), (d.house_name || '').trim(),
            (d.place || '').trim(), (d.post_office || '').trim(), (d.panchayath || '').trim(),
            d.blood_group || '', d.date_of_birth || null,
            aadhaar, (d.qualification || '').trim(), isExpat ? 1 : 0,
            isExpat ? d.phone_abroad || null : null,
            isExpat ? d.home_contact_number || null : null,
            isExpat ? d.id_card_number_abroad || null : null,
            isExpat ? d.working_country || null : null,
            isExpat ? d.city || null : null,
            isExpat ? null : (Number(d.retired_year) || null),
            isExpat ? null : d.phone_india || null,
            d.whatsapp_number || '', (d.email || '').trim(), (d.current_job || '').trim(),
            Math.round(Number(d.years_abroad)) || 0,
            (d.emergency_name || '').trim(), d.emergency_phone || '',
            Object.keys(customData).length ? JSON.stringify(customData) : null,
          ]
        );
        const appId = result.insertId;

        const docRows = [];
        const typeMap = { photo: 'photo', aadhaar: 'aadhaar', id_card: 'id_card_abroad' };
        for (const [field, dbType] of Object.entries(typeMap)) {
          const f = req.files?.[field]?.[0];
          if (!f) continue;
          let ocrStatus = 'not_applicable';
          if (field === 'aadhaar') ocrStatus = d.aadhaar_ocr_status || 'skipped';
          if (field === 'id_card') ocrStatus = d.id_card_ocr_status || 'skipped';
          docRows.push([appId, dbType, f.filename, f.originalname, f.mimetype, f.size, ocrStatus]);
        }
        if (docRows.length) {
          await conn.query(
            'INSERT INTO documents (application_id, doc_type, file_name, original_name, mime_type, size_bytes, ocr_status) VALUES ?',
            [docRows]
          );
        }

        await conn.query(
          'INSERT INTO status_history (application_id, action, detail, actor) VALUES (?,?,?,?)',
          [appId, 'Submitted', `Application submitted (${docRows.length} document(s) uploaded)`, 'applicant']
        );

        await conn.commit();

        if (d.email) {
          const [subject, title, body] = templates.submitted({
            name: d.name, reference_no: referenceNo, plan_name: plan.name, membership_fee: fee,
          });
          sendMail(d.email, subject, title, body); // fire and forget
        }

        res.status(201).json({
          reference_no: referenceNo,
          status: 'Pending Verification',
          membership_type: plan.code,
          plan_name: plan.name,
          membership_fee: fee,
        });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    } catch (e) {
      next(e);
    }
  }
);

export default router;
