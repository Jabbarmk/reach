import nodemailer from 'nodemailer';
import { pool } from './db.js';

export async function getSmtpConfig() {
  const [rows] = await pool.query("SELECT value FROM settings WHERE name = 'smtp'");
  if (!rows.length) return null;
  try { return JSON.parse(rows[0].value); } catch { return null; }
}

export function buildTransport(cfg) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: Number(cfg.port) || 587,
    secure: Number(cfg.port) === 465,
    auth: cfg.username ? { user: cfg.username, pass: cfg.password } : undefined,
  });
}

function wrap(title, bodyHtml) {
  return `
  <div style="font-family:Segoe UI,Arial,sans-serif;background:#f4f7fb;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #dde4ef">
      <div style="background:linear-gradient(120deg,#0d2a6b,#1747ad 70%,#0d9488);color:#fff;padding:18px 24px">
        <div style="font-size:17px;font-weight:700">REACH Pravasi Welfare Society</div>
        <div style="font-size:12px;opacity:.85">${title}</div>
      </div>
      <div style="padding:24px;color:#1a2333;font-size:14px;line-height:1.6">${bodyHtml}</div>
      <div style="background:#eef3fc;padding:12px 24px;font-size:11.5px;color:#5b6779">
        This is an automated message from the REACH Membership Management System. Please do not reply.
      </div>
    </div>
  </div>`;
}

// Fire-and-forget: email failure must never break the main flow.
// attachments: optional nodemailer-format array, e.g. [{ filename, content: Buffer }]
export async function sendMail(to, subject, title, bodyHtml, attachments) {
  try {
    if (!to) return { sent: false, reason: 'no recipient' };
    const cfg = await getSmtpConfig();
    if (!cfg?.host || !cfg?.enabled) return { sent: false, reason: 'smtp not configured' };
    const transport = buildTransport(cfg);
    await transport.sendMail({
      from: cfg.from_name ? `"${cfg.from_name}" <${cfg.from_email}>` : cfg.from_email,
      to,
      subject,
      html: wrap(title, bodyHtml),
      attachments: attachments?.length ? attachments : undefined,
    });
    return { sent: true };
  } catch (e) {
    console.error('sendMail failed:', e.message);
    return { sent: false, reason: e.message };
  }
}

export const templates = {
  submitted: (app) => [
    `Application Received — ${app.reference_no}`,
    'Application Received',
    `<p>Dear <strong>${app.name}</strong>,</p>
     <p>Your membership application has been received successfully.</p>
     <p><strong>Reference No:</strong> ${app.reference_no}<br>
        <strong>Membership:</strong> ${app.plan_name} (₹${app.membership_fee})<br>
        <strong>Status:</strong> Pending Verification</p>
     <p>Our team will verify your application and contact you soon.</p>`,
  ],
  approved: (app) => [
    `Application Approved — Membership ID ${app.membership_id}`,
    'Application Approved',
    `<p>Dear <strong>${app.name}</strong>,</p>
     <p>Congratulations! Your membership application has been <strong style="color:#16a34a">approved</strong>.</p>
     <p><strong>Membership ID:</strong> ${app.membership_id}<br>
        <strong>Status:</strong> ${app.status}</p>
     ${app.status === 'Payment Pending' ? `<p>Please complete the membership fee payment of <strong>₹${app.membership_fee}</strong> to activate your membership.</p>` : ''}`,
  ],
  rejected: (app, note) => [
    `Application Update — ${app.reference_no}`,
    'Application Not Approved',
    `<p>Dear <strong>${app.name}</strong>,</p>
     <p>We are sorry to inform you that your membership application (${app.reference_no}) was not approved.</p>
     ${note ? `<p><strong>Reason:</strong> ${note}</p>` : ''}
     <p>Please contact the society office for more information.</p>`,
  ],
  correction: (app, note) => [
    `Correction Required — ${app.reference_no}`,
    'Correction Requested',
    `<p>Dear <strong>${app.name}</strong>,</p>
     <p>Your application (${app.reference_no}) needs a correction before it can be approved.</p>
     ${note ? `<p><strong>Details:</strong> ${note}</p>` : ''}
     <p>Please contact the society office to update your details.</p>`,
  ],
  paid: (app, receiptNumber) => [
    `Payment Received — ${app.reference_no}`,
    'Payment Received',
    `<p>Dear <strong>${app.name}</strong>,</p>
     <p>We have received your membership fee payment of <strong>₹${app.membership_fee}</strong>. Thank you!</p>
     ${app.membership_id ? `<p><strong>Membership ID:</strong> ${app.membership_id}<br><strong>Status:</strong> ${app.status}</p>` : ''}
     ${receiptNumber ? `<p>Your receipt (<strong>${receiptNumber}</strong>) is attached to this e-mail.</p>` : ''}`,
  ],
};
