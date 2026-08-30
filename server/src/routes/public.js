import express from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';
import { sendMail, templates } from '../mailer.js';
import { mergeHomeContent } from '../homeContent.js';
import { getLogoPath } from '../branding.js';

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
  return { fields, plans, options, registration };
}

// Public: everything the registration form needs to render itself.
router.get('/form-config', async (req, res, next) => {
  try {
    res.json(await loadFormConfig());
  } catch (e) { next(e); }
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

      const aadhaar = String(d.aadhaar_number || '').replace(/\s/g, '');
      if (need('aadhaar_number') && !aadhaar) errors.push(`${label('aadhaar_number', 'Aadhaar number')} is required`);
      if (aadhaar && !/^\d{12}$/.test(aadhaar)) errors.push('Aadhaar number must be exactly 12 digits');

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

      if (errors.length) return res.status(400).json({ errors });

      const fee = plan.fee;
      const referenceNo = `REACH-APP-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [result] = await conn.query(
          `INSERT INTO applications
            (reference_no, membership_type, membership_fee, name, father_name, house_name, place, post_office,
             panchayath, blood_group, date_of_birth, aadhaar_number, qualification, is_expat,
             phone_abroad, home_contact_number, id_card_number_abroad, working_country, city, retired_year, phone_india,
             whatsapp_number, email, current_job, years_abroad, emergency_name, emergency_phone,
             custom_data, status, payment_status, consent_accepted)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'Pending Verification', 'Unpaid', 1)`,
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
            Number(d.years_abroad) || 0,
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
