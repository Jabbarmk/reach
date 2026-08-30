import PDFDocument from 'pdfkit';
import fs from 'fs';
import { getLogoPath } from './branding.js';

const BLUE = '#0d2a6b';
const TEAL = '#0d9488';
const MUTED = '#5b6779';
const LINE = '#dde4ef';

function amountInWords(n) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const twoDigit = (num) => (num < 20 ? ones[num] : `${tens[Math.floor(num / 10)]}${num % 10 ? ' ' + ones[num % 10] : ''}`);
  const threeDigit = (num) => (num >= 100 ? `${ones[Math.floor(num / 100)]} Hundred${num % 100 ? ' ' + twoDigit(num % 100) : ''}` : twoDigit(num));

  let num = Math.round(n);
  if (num === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(num / 10000000); num %= 10000000;
  const lakh = Math.floor(num / 100000); num %= 100000;
  const thousand = Math.floor(num / 1000); num %= 1000;
  if (crore) parts.push(`${threeDigit(crore)} Crore`);
  if (lakh) parts.push(`${threeDigit(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigit(thousand)} Thousand`);
  if (num) parts.push(threeDigit(num));
  return parts.join(' ');
}

/**
 * Builds a one-page PDF receipt. Returns a Buffer.
 * @param {{payment: object, application: object, planName: string, societyName: string}} data
 */
export function buildReceiptPdf({ payment, application, planName, societyName }) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ===== Header =====
      let logoBottom = 50;
      try {
        const logoPath = await getLogoPath();
        const buf = fs.readFileSync(logoPath);
        doc.image(buf, 50, 45, { height: 50 });
        logoBottom = 45 + 50;
      } catch { /* logo optional */ }

      doc.fillColor(BLUE).fontSize(18).font('Helvetica-Bold')
        .text(societyName, 50, 45, { align: 'right' });
      doc.fillColor(MUTED).fontSize(10).font('Helvetica')
        .text('Membership Payment Receipt', 50, 68, { align: 'right' });

      const headerBottom = Math.max(logoBottom, 90);
      doc.moveTo(50, headerBottom + 12).lineTo(545, headerBottom + 12).strokeColor(LINE).lineWidth(1).stroke();

      // ===== Receipt meta =====
      let y = headerBottom + 30;
      doc.fillColor(TEAL).fontSize(11).font('Helvetica-Bold').text(`Receipt No: ${payment.receipt_number}`, 50, y);
      doc.fillColor(MUTED).fontSize(11).font('Helvetica').text(`Date: ${payment.paid_on}`, 0, y, { align: 'right', width: 545 });

      // ===== Received from block =====
      y += 40;
      doc.fillColor(BLUE).fontSize(13).font('Helvetica-Bold').text('Received with thanks from', 50, y);
      y += 20;
      doc.fillColor('#1a2333').fontSize(15).font('Helvetica-Bold').text(application.name, 50, y);
      y += 24;

      const row = (label, value) => {
        doc.fillColor(MUTED).fontSize(10).font('Helvetica').text(label, 50, y, { width: 160 });
        doc.fillColor('#1a2333').fontSize(11).font('Helvetica-Bold').text(value || '—', 210, y, { width: 335 });
        y += 20;
      };
      row('Membership ID', application.membership_id || 'Pending');
      row('Reference No.', application.reference_no);
      row('Membership Plan', planName);
      row('Payment Method', payment.method);
      if (payment.collected_by) row('Collected By', payment.collected_by);
      if (payment.note) row('Note', payment.note);

      // ===== Amount box =====
      y += 12;
      doc.roundedRect(50, y, 495, 60, 8).fillAndStroke('#eef3fc', LINE);
      doc.fillColor(MUTED).fontSize(10).font('Helvetica').text('Amount Received', 68, y + 12);
      doc.fillColor(BLUE).fontSize(22).font('Helvetica-Bold').text(`Rs. ${Number(payment.amount).toLocaleString('en-IN')}`, 68, y + 28);
      doc.fillColor(MUTED).fontSize(9).font('Helvetica-Oblique')
        .text(`Rupees ${amountInWords(payment.amount)} Only`, 250, y + 34, { width: 275, align: 'right' });
      y += 90;

      // ===== Footer =====
      doc.fillColor(MUTED).fontSize(9).font('Helvetica')
        .text('This is a system-generated receipt and does not require a physical signature.', 50, 740, { width: 495, align: 'center' });
      doc.text(`${societyName} — Membership Management System`, 50, 754, { width: 495, align: 'center' });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
