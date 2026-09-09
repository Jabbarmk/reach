import PDFDocument from 'pdfkit';
import fs from 'fs';
import { getLogoPath } from './branding.js';

const BLUE = '#0d2a6b';
const TEAL = '#0d9488';
const INK = '#1a2333';
const MUTED = '#5b6779';
const LINE = '#dde4ef';
const HEAD_BG = '#eef3fc';
const ZEBRA = '#f7f9fd';

// A4 landscape so the member list's ten columns stay readable.
const PAGE = { size: 'A4', layout: 'landscape', margin: 40 };
const PAGE_W = 841.89;
const PAGE_H = 595.28;
const LEFT = PAGE.margin;
const RIGHT = PAGE_W - PAGE.margin;
const BOTTOM = PAGE_H - PAGE.margin - 18; // leave room for the footer line
const CONTENT_W = RIGHT - LEFT;

const rupees = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d).slice(0, 10);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Draws a table with a repeating header row and automatic page breaks. Column widths are
 * relative weights scaled to the content width. Returns the y position after the table.
 */
function drawTable(doc, { columns, rows, y, title, totals }) {
  const weightSum = columns.reduce((s, c) => s + (c.w || 1), 0);
  const cols = columns.map((c) => ({ ...c, px: ((c.w || 1) / weightSum) * CONTENT_W }));
  const PAD = 5;
  const HEAD_H = 20;

  const drawHeader = () => {
    doc.rect(LEFT, y, CONTENT_W, HEAD_H).fill(HEAD_BG);
    let x = LEFT;
    doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(7.5);
    for (const c of cols) {
      doc.text(c.label.toUpperCase(), x + PAD, y + 6.5, { width: c.px - PAD * 2, align: c.align || 'left', lineBreak: false });
      x += c.px;
    }
    y += HEAD_H;
  };

  const rowHeight = (cells, size) => {
    doc.fontSize(size);
    let h = 0;
    cells.forEach((v, i) => {
      h = Math.max(h, doc.heightOfString(String(v ?? ''), { width: cols[i].px - PAD * 2 }));
    });
    return Math.max(h + PAD * 2, 18);
  };

  const drawRow = (cells, { bold = false, bg = null } = {}) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
    const h = rowHeight(cells, 8.5);
    if (y + h > BOTTOM) {
      doc.addPage();
      y = LEFT;
      if (title) { doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(11).text(`${title} (continued)`, LEFT, y); y += 18; }
      drawHeader();
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
    }
    if (bg) doc.rect(LEFT, y, CONTENT_W, h).fill(bg);
    doc.fillColor(INK).fontSize(8.5);
    let x = LEFT;
    cells.forEach((v, i) => {
      doc.text(String(v ?? ''), x + PAD, y + PAD, { width: cols[i].px - PAD * 2, align: cols[i].align || 'left' });
      x += cols[i].px;
    });
    doc.moveTo(LEFT, y + h).lineTo(RIGHT, y + h).lineWidth(0.5).strokeColor(LINE).stroke();
    y += h;
  };

  if (title) {
    if (y + 60 > BOTTOM) { doc.addPage(); y = LEFT; }
    doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(11).text(title, LEFT, y);
    y += 18;
  }
  drawHeader();
  if (!rows.length) {
    drawRow(['No records match the selected filters.', ...cols.slice(1).map(() => '')]);
  }
  rows.forEach((r, i) => drawRow(cols.map((c) => (typeof c.value === 'function' ? c.value(r) : r[c.value])), { bg: i % 2 ? ZEBRA : null }));
  if (totals) drawRow(totals, { bold: true, bg: HEAD_BG });
  return y + 16;
}

const GROUP_COLUMNS = (firstLabel, firstKey) => [
  { label: firstLabel, value: firstKey, w: 2.2 },
  { label: 'Registrations', value: 'registrations', w: 1.2, align: 'right' },
  { label: 'Active', value: 'active', w: 0.8, align: 'right' },
  { label: 'Expats', value: 'expats', w: 0.8, align: 'right' },
  { label: 'Paid', value: 'paid_count', w: 0.8, align: 'right' },
  { label: 'Unpaid', value: 'unpaid_count', w: 0.8, align: 'right' },
  { label: 'Expected fees', value: (r) => rupees(r.expected_fees), w: 1.2, align: 'right' },
  { label: 'Collected', value: (r) => rupees(r.collected), w: 1.2, align: 'right' },
  { label: 'Outstanding', value: (r) => rupees(r.outstanding), w: 1.2, align: 'right' },
];

const groupTotals = (label, s) => [
  label, s.registrations, s.active, s.expats, s.paid_count, s.unpaid_count,
  rupees(s.expected_fees), rupees(s.collected), rupees(s.outstanding),
];

/**
 * Builds the registration & payments report PDF. Returns a Buffer.
 * @param {{report: object, societyName: string, generatedBy?: string}} data
 */
export function buildReportPdf({ report, societyName, generatedBy }) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ ...PAGE, bufferPages: true, info: { Title: 'Registration & Payments Report', Author: societyName } });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ===== Header =====
      let y = LEFT;
      try {
        const buf = fs.readFileSync(await getLogoPath());
        doc.image(buf, LEFT, y, { height: 42 });
      } catch { /* logo optional */ }
      doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(16).text(societyName, LEFT, y, { align: 'right', width: CONTENT_W });
      doc.fillColor(MUTED).font('Helvetica').fontSize(10).text('Registration & Payments Report', LEFT, y + 21, { align: 'right', width: CONTENT_W });
      y += 52;
      doc.moveTo(LEFT, y).lineTo(RIGHT, y).lineWidth(1).strokeColor(LINE).stroke();
      y += 12;

      const generated = new Date(report.generated_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      doc.fillColor(TEAL).font('Helvetica-Bold').fontSize(9.5).text(`Filters: ${report.filter_text}`, LEFT, y, { width: CONTENT_W * 0.65 });
      doc.fillColor(MUTED).font('Helvetica').fontSize(9)
        .text(`Generated ${generated}${generatedBy ? ` by ${generatedBy}` : ''}`, LEFT, y, { width: CONTENT_W, align: 'right' });
      y += Math.max(doc.heightOfString(`Filters: ${report.filter_text}`, { width: CONTENT_W * 0.65 }), 12) + 14;

      // ===== Summary boxes =====
      const s = report.summary;
      const boxes = [
        ['Registrations', String(s.registrations)],
        ['Active members', String(s.active)],
        ['Paid', String(s.paid_count)],
        ['Unpaid', String(s.unpaid_count)],
        ['Expected fees', rupees(s.expected_fees)],
        ['Fees collected', rupees(s.collected)],
        ['Outstanding', rupees(s.outstanding)],
      ];
      const gap = 8;
      const bw = (CONTENT_W - gap * (boxes.length - 1)) / boxes.length;
      boxes.forEach(([label, value], i) => {
        const x = LEFT + i * (bw + gap);
        doc.roundedRect(x, y, bw, 50, 6).fillAndStroke(HEAD_BG, LINE);
        doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(label, x + 8, y + 9, { width: bw - 16 });
        doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(13).text(value, x + 8, y + 24, { width: bw - 16 });
      });
      y += 68;

      // ===== Breakdown tables =====
      y = drawTable(doc, {
        title: 'Registrations by Country',
        columns: GROUP_COLUMNS('Country', 'country'),
        rows: report.byCountry, y,
        totals: groupTotals('Total', s),
      });
      y = drawTable(doc, {
        title: 'Registrations by Panchayath / Municipality',
        columns: GROUP_COLUMNS('Panchayath / Municipality', 'panchayath'),
        rows: report.byPanchayath, y,
        totals: groupTotals('Total', s),
      });
      y = drawTable(doc, {
        title: 'Registrations by Membership Plan',
        columns: GROUP_COLUMNS('Plan', 'plan_name'),
        rows: report.byPlan, y,
        totals: groupTotals('Total', s),
      });
      y = drawTable(doc, {
        title: 'Registrations by Status',
        columns: [
          { label: 'Status', value: 'status', w: 3 },
          { label: 'Registrations', value: 'count', w: 1, align: 'right' },
          { label: 'Collected', value: (r) => rupees(r.collected), w: 1.5, align: 'right' },
        ],
        rows: report.byStatus, y,
        totals: ['Total', s.registrations, rupees(s.collected)],
      });

      // ===== Member list =====
      doc.addPage();
      y = LEFT;
      y = drawTable(doc, {
        title: `Members (${report.members.length})`,
        columns: [
          { label: '#', value: (r) => r._n, w: 0.35, align: 'right' },
          { label: 'Reference / ID', value: (r) => r.membership_id || r.reference_no, w: 1.45 },
          { label: 'Name', value: 'name', w: 1.8 },
          { label: 'Panchayath', value: 'panchayath', w: 1.4 },
          { label: 'Country', value: 'country', w: 1.1 },
          { label: 'Plan', value: 'plan_name', w: 1.2 },
          { label: 'Status', value: 'status', w: 1.15 },
          { label: 'Payment', value: 'payment_status', w: 0.8 },
          { label: 'Paid', value: (r) => (r.paid_amount === null ? '—' : `${rupees(r.paid_amount)}${r.payment_recorded ? '' : ' *'}`), w: 0.95, align: 'right' },
          { label: 'Paid on', value: (r) => fmtDate(r.paid_on), w: 1 },
          { label: 'Registered', value: (r) => fmtDate(r.created_at), w: 1.1 },
        ],
        rows: report.members.map((m, i) => ({ ...m, _n: i + 1 })),
        y,
      });
      if (s.unrecorded_paid > 0) {
        if (y > BOTTOM - 14) { doc.addPage(); y = LEFT; }
        doc.fillColor(MUTED).font('Helvetica-Oblique').fontSize(8)
          .text(`* ${s.unrecorded_paid} member${s.unrecorded_paid === 1 ? ' is' : 's are'} marked Paid without a payment record; the full plan fee is assumed as received.`, LEFT, y, { width: CONTENT_W });
      }

      // ===== Footer on every page =====
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        // The footer sits inside the bottom margin; pdfkit would otherwise treat it as
        // overflow and silently start a new page for every footer written.
        doc.page.margins.bottom = 0;
        doc.fillColor(MUTED).font('Helvetica').fontSize(8)
          .text(`${societyName} — Membership Management System`, LEFT, PAGE_H - PAGE.margin, { width: CONTENT_W / 2, lineBreak: false })
          .text(`Page ${i - range.start + 1} of ${range.count}`, LEFT + CONTENT_W / 2, PAGE_H - PAGE.margin, { width: CONTENT_W / 2, align: 'right', lineBreak: false });
      }
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
