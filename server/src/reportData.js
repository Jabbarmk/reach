import { pool } from './db.js';

// Registration & payments report (Dashboard > Reports). One filter set drives the on-screen
// report, the Excel workbook and the PDF, so all three always agree.
//
// Country convention matches the Overview widget and the homepage marquee: non-expat members
// have no working_country, so they're bucketed as 'India'.
const COUNTRY_EXPR = `COALESCE(NULLIF(a.working_country, ''), 'India')`;
const PANCHAYATH_EXPR = `COALESCE(NULLIF(a.panchayath, ''), 'Not specified')`;

export const REPORT_STATUSES = [
  'Submitted', 'Pending Verification', 'Correction Requested', 'Payment Verified', 'Approved',
  'Payment Pending', 'Active', 'Rejected', 'Expired', 'Deactivated',
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Normalises raw query-string filters into a clean object (unknown/empty values dropped).
export function parseFilters(q = {}) {
  const f = {};
  if (DATE_RE.test(q.from || '')) f.from = q.from;
  if (DATE_RE.test(q.to || '')) f.to = q.to;
  if (q.status && REPORT_STATUSES.includes(q.status)) f.status = q.status;
  if (q.plan) f.plan = String(q.plan).slice(0, 30);
  if (q.country) f.country = String(q.country).slice(0, 80);
  if (q.panchayath) f.panchayath = String(q.panchayath).slice(0, 120);
  if (q.expat === '1' || q.expat === '0') f.expat = q.expat;
  if (q.payment === 'Paid' || q.payment === 'Unpaid') f.payment = q.payment;
  return f;
}

function whereClause(f) {
  const where = ['a.deleted_at IS NULL'];
  const params = [];
  if (f.from) { where.push('DATE(a.created_at) >= ?'); params.push(f.from); }
  if (f.to) { where.push('DATE(a.created_at) <= ?'); params.push(f.to); }
  if (f.status) { where.push('a.status = ?'); params.push(f.status); }
  if (f.plan) { where.push('a.membership_type = ?'); params.push(f.plan); }
  if (f.country) { where.push(`${COUNTRY_EXPR} = ?`); params.push(f.country); }
  if (f.panchayath) { where.push(`${PANCHAYATH_EXPR} = ?`); params.push(f.panchayath); }
  if (f.expat) { where.push('a.is_expat = ?'); params.push(Number(f.expat)); }
  if (f.payment) { where.push('a.payment_status = ?'); params.push(f.payment); }
  return { sql: where.join(' AND '), params };
}

// payments.application_id is UNIQUE, so this join never multiplies application rows.
const FROM_SQL = 'FROM applications a LEFT JOIN payments p ON p.application_id = a.id';

// Amount treated as received for a member. Members marked Paid before the payments table
// existed have no payment row; they're counted as having paid the full plan fee rather than
// showing a bogus outstanding balance. Such rows are flagged (payment_recorded = false /
// unrecorded_paid count) so the report can footnote them.
const PAID_EXPR = `COALESCE(p.amount, CASE WHEN a.payment_status = 'Paid' THEN a.membership_fee ELSE 0 END)`;

const AGG_SQL = `
  COUNT(*) AS registrations,
  SUM(a.status = 'Active') AS active,
  SUM(a.status IN ('Pending Verification','Submitted','Correction Requested')) AS pending,
  SUM(a.is_expat = 1) AS expats,
  SUM(a.payment_status = 'Paid') AS paid_count,
  SUM(a.payment_status <> 'Paid') AS unpaid_count,
  SUM(a.payment_status = 'Paid' AND p.id IS NULL) AS unrecorded_paid,
  COALESCE(SUM(a.membership_fee), 0) AS expected_fees,
  COALESCE(SUM(${PAID_EXPR}), 0) AS collected,
  COALESCE(SUM(GREATEST(a.membership_fee - ${PAID_EXPR}, 0)), 0) AS outstanding`;

const num = (v) => Number(v) || 0;
const aggRow = (r) => ({
  registrations: num(r.registrations),
  active: num(r.active),
  pending: num(r.pending),
  expats: num(r.expats),
  paid_count: num(r.paid_count),
  unpaid_count: num(r.unpaid_count),
  unrecorded_paid: num(r.unrecorded_paid),
  expected_fees: num(r.expected_fees),
  collected: num(r.collected),
  outstanding: num(r.outstanding),
});

// Human-readable description of the active filters, shared by the UI, Excel and PDF.
export function describeFilters(f, planNames = {}) {
  const parts = [];
  if (f.from && f.to) parts.push(`Registered ${f.from} to ${f.to}`);
  else if (f.from) parts.push(`Registered from ${f.from}`);
  else if (f.to) parts.push(`Registered up to ${f.to}`);
  if (f.status) parts.push(`Status: ${f.status}`);
  if (f.plan) parts.push(`Plan: ${planNames[f.plan] || f.plan}`);
  if (f.country) parts.push(`Country: ${f.country}`);
  if (f.panchayath) parts.push(`Panchayath/Municipality: ${f.panchayath}`);
  if (f.expat) parts.push(f.expat === '1' ? 'Expats only' : 'Non-expats only');
  if (f.payment) parts.push(`Payment: ${f.payment}`);
  return parts.length ? parts.join(' · ') : 'All registrations (no filters)';
}

export async function buildRegistrationReport(filters) {
  const { sql: where, params } = whereClause(filters);

  const [[summaryRow]] = await pool.query(`SELECT ${AGG_SQL} ${FROM_SQL} WHERE ${where}`, params);

  const [byCountry] = await pool.query(
    `SELECT ${COUNTRY_EXPR} AS country, ${AGG_SQL} ${FROM_SQL} WHERE ${where}
     GROUP BY ${COUNTRY_EXPR} ORDER BY registrations DESC, country ASC`, params
  );
  const [byPanchayath] = await pool.query(
    `SELECT ${PANCHAYATH_EXPR} AS panchayath, ${AGG_SQL} ${FROM_SQL} WHERE ${where}
     GROUP BY ${PANCHAYATH_EXPR} ORDER BY registrations DESC, panchayath ASC`, params
  );
  const [byStatus] = await pool.query(
    `SELECT a.status, COUNT(*) AS count, COALESCE(SUM(${PAID_EXPR}), 0) AS collected
     ${FROM_SQL} WHERE ${where} GROUP BY a.status ORDER BY count DESC`, params
  );
  const [byPlan] = await pool.query(
    `SELECT a.membership_type AS plan_code, COALESCE(mp.name, a.membership_type) AS plan_name, ${AGG_SQL}
     ${FROM_SQL} LEFT JOIN membership_plans mp ON mp.code = a.membership_type
     WHERE ${where} GROUP BY a.membership_type, mp.name ORDER BY registrations DESC`, params
  );
  const [members] = await pool.query(
    `SELECT a.id, a.reference_no, a.membership_id, a.name, a.place, ${PANCHAYATH_EXPR} AS panchayath,
            ${COUNTRY_EXPR} AS country, a.is_expat, a.membership_type AS plan_code,
            COALESCE(mp.name, a.membership_type) AS plan_name, a.membership_fee, a.status, a.payment_status,
            a.whatsapp_number, a.email, a.created_at,
            CASE WHEN p.id IS NOT NULL THEN p.amount WHEN a.payment_status = 'Paid' THEN a.membership_fee END AS paid_amount,
            (p.id IS NOT NULL) AS payment_recorded,
            p.paid_on, p.method AS payment_method, p.receipt_number,
            GREATEST(a.membership_fee - ${PAID_EXPR}, 0) AS balance
     ${FROM_SQL} LEFT JOIN membership_plans mp ON mp.code = a.membership_type
     WHERE ${where} ORDER BY a.created_at DESC, a.id DESC LIMIT 5000`, params
  );

  // Filter option lists come from the real (unfiltered) data so every value offered actually
  // matches at least one registration.
  const [countryOpts] = await pool.query(
    `SELECT DISTINCT ${COUNTRY_EXPR} AS v FROM applications a WHERE a.deleted_at IS NULL ORDER BY v`
  );
  const [panchayathOpts] = await pool.query(
    `SELECT DISTINCT ${PANCHAYATH_EXPR} AS v FROM applications a WHERE a.deleted_at IS NULL ORDER BY v`
  );
  const [plans] = await pool.query('SELECT code, name FROM membership_plans ORDER BY sort_order, id');
  const planNames = Object.fromEntries(plans.map((p) => [p.code, p.name]));

  return {
    generated_at: new Date().toISOString(),
    filters,
    filter_text: describeFilters(filters, planNames),
    summary: aggRow(summaryRow),
    byCountry: byCountry.map((r) => ({ country: r.country, ...aggRow(r) })),
    byPanchayath: byPanchayath.map((r) => ({ panchayath: r.panchayath, ...aggRow(r) })),
    byStatus: byStatus.map((r) => ({ status: r.status, count: num(r.count), collected: num(r.collected) })),
    byPlan: byPlan.map((r) => ({ plan_code: r.plan_code, plan_name: r.plan_name, ...aggRow(r) })),
    members: members.map((r) => ({
      ...r,
      is_expat: !!r.is_expat,
      payment_recorded: !!r.payment_recorded,
      membership_fee: num(r.membership_fee),
      paid_amount: r.paid_amount === null ? null : num(r.paid_amount),
      balance: num(r.balance),
    })),
    options: {
      countries: countryOpts.map((r) => r.v),
      panchayaths: panchayathOpts.map((r) => r.v),
      plans,
      statuses: REPORT_STATUSES,
    },
  };
}
