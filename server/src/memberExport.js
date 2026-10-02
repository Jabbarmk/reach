import XLSX from 'xlsx';
import { pool } from './db.js';

// Every exportable member field. `get(row, ctx)` overrides the raw column value;
// `type: 'date'` values are written as DD/MM/YYYY (sorting still uses the raw value).
const dmy = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '');
const dmyTime = (v) => (v ? `${dmy(v)} ${String(v).slice(11, 16)}`.trim() : '');

export const MEMBER_EXPORT_FIELDS = [
  { key: 'membership_id', label: 'Membership ID', group: 'Identity' },
  { key: 'reference_no', label: 'Reference No', group: 'Identity' },
  { key: 'name', label: 'Name', group: 'Personal' },
  { key: 'father_name', label: "Father's Name", group: 'Personal' },
  { key: 'house_name', label: 'House Name', group: 'Personal' },
  { key: 'place', label: 'Place', group: 'Personal' },
  { key: 'post_office', label: 'Post Office', group: 'Personal' },
  { key: 'panchayath', label: 'Panchayath/Municipality', group: 'Personal' },
  { key: 'blood_group', label: 'Blood Group', group: 'Personal' },
  { key: 'date_of_birth', label: 'Date of Birth', group: 'Personal', fmt: dmy },
  { key: 'qualification', label: 'Qualification', group: 'Personal' },
  { key: 'aadhaar_number', label: 'ID Card Number', group: 'Personal' },
  { key: 'is_expat', label: 'Expat / Retired', group: 'Status', get: (r) => (r.is_expat ? 'Expat' : 'Retired / Returned') },
  { key: 'working_country', label: 'Working Country', group: 'Expat' },
  { key: 'city', label: 'City', group: 'Expat' },
  { key: 'phone_abroad', label: 'Phone (Abroad)', group: 'Expat' },
  { key: 'id_card_number_abroad', label: 'ID Number (Abroad)', group: 'Expat' },
  { key: 'home_contact_number', label: 'Home Contact Number', group: 'Expat' },
  { key: 'retired_year', label: 'Retired Year', group: 'Retired' },
  { key: 'phone_india', label: 'Phone (India)', group: 'Retired' },
  { key: 'whatsapp_number', label: 'WhatsApp Number', group: 'Contact' },
  { key: 'email', label: 'E-mail', group: 'Contact' },
  { key: 'current_job', label: 'Current Job', group: 'Contact' },
  { key: 'years_abroad', label: 'Years Abroad', group: 'Contact' },
  { key: 'emergency_name', label: 'Friend/Family Name', group: 'Contact' },
  { key: 'emergency_phone', label: 'Friend/Family Phone', group: 'Contact' },
  { key: 'membership_type', label: 'Plan', group: 'Membership', get: (r, ctx) => ctx.plans[r.membership_type] || r.membership_type },
  { key: 'membership_fee', label: 'Fee (₹)', group: 'Membership' },
  { key: 'validity_start', label: 'Valid From', group: 'Membership', fmt: dmy },
  { key: 'validity_end', label: 'Valid Until', group: 'Membership', fmt: dmy },
  { key: 'status', label: 'Status', group: 'Membership' },
  { key: 'payment_status', label: 'Payment', group: 'Membership' },
  { key: 'admin_note', label: 'Admin Note', group: 'Membership' },
  { key: 'created_at', label: 'Submitted On', group: 'Membership', fmt: dmyTime },
];

const BY_KEY = Object.fromEntries(MEMBER_EXPORT_FIELDS.map((f) => [f.key, f]));
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

// Core fields plus the admin-defined custom form fields (keys prefixed `custom:`).
export async function listExportFields() {
  const [custom] = await pool.query('SELECT field_key, label FROM form_fields WHERE is_core = 0 ORDER BY sort_order, id');
  return [
    ...MEMBER_EXPORT_FIELDS.map(({ key, label, group }) => ({ key, label, group })),
    ...custom.map((f) => ({ key: `custom:${f.field_key}`, label: f.label, group: 'Custom' })),
  ];
}

export async function buildMemberWorkbook({ ids, fields, sort, dir }) {
  const catalogue = await listExportFields();
  const known = new Map(catalogue.map((f) => [f.key, f]));
  const cols = fields.filter((k) => known.has(k));
  if (!cols.length) throw Object.assign(new Error('Select at least one field to export'), { status: 400 });

  const [plans] = await pool.query('SELECT code, name FROM membership_plans');
  const ctx = { plans: Object.fromEntries(plans.map((p) => [p.code, p.name])) };

  const cleanIds = ids.map(Number).filter(Number.isInteger).slice(0, 10000);
  const [rows] = cleanIds.length
    ? await pool.query('SELECT * FROM applications WHERE id IN (?)', [cleanIds])
    : [[]];
  for (const r of rows) {
    let custom = {};
    try { custom = r.custom_data ? JSON.parse(r.custom_data) : {}; } catch { custom = {}; }
    for (const [k, v] of Object.entries(custom)) r[`custom:${k}`] = v;
  }

  // Sorting uses the raw column value so dates and IDs order correctly; blanks always go last.
  if (sort && known.has(sort)) {
    const sign = dir === 'desc' ? -1 : 1;
    const raw = (r) => {
      const v = r[sort];
      return v === null || v === undefined ? '' : String(v).trim();
    };
    rows.sort((a, b) => {
      const x = raw(a); const y = raw(b);
      if (!x && !y) return a.id - b.id;
      if (!x) return 1;
      if (!y) return -1;
      return sign * collator.compare(x, y) || a.id - b.id;
    });
  }

  const cell = (r, key) => {
    const f = BY_KEY[key];
    let v = f?.get ? f.get(r, ctx) : r[key];
    if (f?.fmt) v = f.fmt(v);
    if (v === null || v === undefined) return '';
    return typeof v === 'object' ? JSON.stringify(v) : v;
  };

  const aoa = [
    cols.map((k) => known.get(k).label),
    ...rows.map((r) => cols.map((k) => cell(r, k))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = cols.map((k, i) => ({ wch: Math.min(40, Math.max(known.get(k).label.length, ...aoa.slice(1, 200).map((row) => String(row[i]).length)) + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Members');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
