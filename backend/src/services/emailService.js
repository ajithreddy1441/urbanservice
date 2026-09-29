import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { pool } from '../config/db.js';

async function smtpConfig() {
  const [rows] = await pool.query(
    "SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('smtp_host','smtp_port','smtp_user','smtp_password','smtp_from_name','smtp_from_email','business_name')",
  );
  const map = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
  return {
    host: env.smtp.host || map.smtp_host || '',
    port: Number(env.smtp.port || map.smtp_port || 587),
    user: env.smtp.user || map.smtp_user || '',
    password: env.smtp.password || map.smtp_password || '',
    fromName: map.smtp_from_name || env.smtp.fromName || map.business_name || 'Urban Services',
    fromEmail: map.smtp_from_email || env.smtp.fromEmail,
  };
}

function layout(title, body) {
  return `<!doctype html>
<html>
<body style="margin:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#0f172a;padding:22px 28px;color:#ffffff;font-size:18px;font-weight:700;">Urban Services</td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">${title}</h1>
          ${body}
        </td></tr>
        <tr><td style="padding:16px 28px 24px;color:#64748b;font-size:12px;">This is a service update from Urban Services. Please do not reply if this mailbox is unmonitored.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function row(label, value) {
  return `<tr><td style="padding:8px 0;color:#64748b;width:140px;">${label}</td><td style="padding:8px 0;font-weight:600;">${value || '-'}</td></tr>`;
}

function details(pairs) {
  return `<table role="presentation" width="100%" style="margin:16px 0 8px;border-top:1px solid #e2e8f0;">${pairs.map(([l, v]) => row(l, v)).join('')}</table>`;
}

function button(href, label) {
  if (!href) return '';
  return `<p style="margin:20px 0 0;"><a href="${href}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">${label}</a></p>`;
}

export async function sendMail({ to, subject, html }) {
  if (!to) return { skipped: true };
  const cfg = await smtpConfig();
  if (!cfg.host || !cfg.user) {
    console.log(`[email] SMTP not configured. Would send "${subject}" to ${to}`);
    return { skipped: true };
  }
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.password },
  });
  await transporter.sendMail({
    from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
    to,
    subject,
    html,
  });
  return { sent: true };
}

export function bookingConfirmationEmail(order) {
  return {
    subject: `Booking confirmed · ${order.order_number}`,
    html: layout('Your booking is confirmed', `
      <p>Hello ${order.customer_name}, your service request has been received.</p>
      ${details([
        ['Order ID', order.order_number],
        ['Service', order.service_name],
        ['Date', order.scheduled_date],
        ['Time', String(order.scheduled_time).slice(0, 5)],
        ['Address', order.address_line],
        ['Amount', `₹${Number(order.total_amount).toLocaleString('en-IN')}`],
        ['Status', 'Confirmed'],
      ])}
      <p>We will assign a technician and email you their details.</p>
    `),
  };
}

export function technicianAssignedEmail(order) {
  const track = `${env.clientUrl}/customer/track/${order.id}`;
  return {
    subject: `Technician assigned · ${order.order_number}`,
    html: layout('Your technician has been assigned', `
      <p>Hello ${order.customer_name}, a professional has been assigned to your booking.</p>
      ${details([
        ['Technician', order.technician_name],
        ['Phone', order.technician_phone],
        ['Service', order.service_name],
        ['Date', order.scheduled_date],
        ['Time', String(order.scheduled_time).slice(0, 5)],
        ['Service location', order.address_line],
        ['Order ID', order.order_number],
      ])}
      ${button(track, 'Track your technician')}
    `),
  };
}

export function technicianOnTheWayEmail(order) {
  return {
    subject: `Technician is on the way · ${order.order_number}`,
    html: layout('Your technician is travelling to you', `
      <p>Hello ${order.customer_name}, ${order.technician_name || 'your technician'} has started travelling to your location.</p>
      ${details([
        ['Order ID', order.order_number],
        ['Service', order.service_name],
        ['Technician', order.technician_name],
        ['Phone', order.technician_phone],
      ])}
      ${button(`${env.clientUrl}/customer/track/${order.id}`, 'Track live location')}
    `),
  };
}

export function serviceStartedEmail(order) {
  return {
    subject: `Service started · ${order.order_number}`,
    html: layout('Service has started', `
      <p>Hello ${order.customer_name}, work on your ${order.service_name} booking has started.</p>
      ${details([['Order ID', order.order_number], ['Technician', order.technician_name]])}
    `),
  };
}

export function serviceCompletedEmail(order) {
  return {
    subject: `Service completed · ${order.order_number}`,
    html: layout('Your service is complete', `
      <p>Hello ${order.customer_name}, ${order.service_name} has been marked complete. You can review the technician from your dashboard.</p>
      ${details([
        ['Order ID', order.order_number],
        ['Amount', `₹${Number(order.total_amount).toLocaleString('en-IN')}`],
      ])}
      ${button(`${env.clientUrl}/customer/orders/${order.id}`, 'View order and review')}
    `),
  };
}

export function paymentReceiptEmail(order, payment) {
  return {
    subject: `Payment receipt · ${order.order_number}`,
    html: layout('Payment received', `
      <p>Hello ${order.customer_name}, we received your payment.</p>
      ${details([
        ['Order ID', order.order_number],
        ['Service', order.service_name],
        ['Amount', `₹${Number(payment.amount).toLocaleString('en-IN')}`],
        ['Method', payment.method],
        ['Transaction', payment.transaction_id],
        ['Status', 'Paid'],
      ])}
    `),
  };
}

export async function sendBookingConfirmation(order) {
  const mail = bookingConfirmationEmail(order);
  return sendMail({ to: order.customer_email, ...mail });
}
export async function sendTechnicianAssignedEmail(order) {
  const mail = technicianAssignedEmail(order);
  return sendMail({ to: order.customer_email, ...mail });
}
export async function sendTechnicianOnTheWayEmail(order) {
  const mail = technicianOnTheWayEmail(order);
  return sendMail({ to: order.customer_email, ...mail });
}
export async function sendServiceStartedEmail(order) {
  const mail = serviceStartedEmail(order);
  return sendMail({ to: order.customer_email, ...mail });
}
export async function sendServiceCompletedEmail(order) {
  const mail = serviceCompletedEmail(order);
  return sendMail({ to: order.customer_email, ...mail });
}
export async function sendPaymentReceipt(order, payment) {
  const mail = paymentReceiptEmail(order, payment);
  return sendMail({ to: order.customer_email, ...mail });
}
