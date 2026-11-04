const path = require('node:path');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const ICONS = ['open', 'assigned', 'progress', 'resolved', 'closed'];
const STAGES = ['Open', 'Assigned', 'In Progress', 'Resolved', 'Closed'];
const COPY = {
  Open: ['Your request is in.', 'We have received your ticket. The responsible team will review your request and arrange support.'],
  Assigned: ['Your team is on it.', 'Your ticket has an assigned staff member. You will receive updates as work moves forward.'],
  'In Progress': ['Help is underway.', 'Your concern is being worked on. Follow the details below for the latest update.'],
  Resolved: ['Your concern is resolved.', 'Please review the resolution and share your feedback through the service desk to complete your ticket.'],
  Closed: ['Thank you for your feedback.', 'Your ticket is now closed. We appreciate the opportunity to help you.'],
  'On-Hold': ['Your ticket is on hold.', 'Work is temporarily paused. Please review the update below for the reason and any next steps.'],
  Cancelled: ['Your ticket is cancelled.', 'This request will not proceed further. Please review the cancellation details below.'],
};

function ticketProgressHtml(status) {
  const active = STAGES.indexOf(status);
  const exception = status === 'On-Hold' || status === 'Cancelled';
  const accent = status === 'Cancelled' ? '#a33443' : status === 'On-Hold' ? '#946018' : '#0D3B6E';
  const badge = `<p style="margin:0 0 20px;text-align:center;font:600 12px Arial,sans-serif;color:${accent};">CURRENT STATUS &nbsp; ${escapeHtml(status)}</p>`;
  // These are workflow stages, not an audit history; previous steps may have been skipped.
  const cells = STAGES.map((stage, index) => {
    const current = index === active;
    const done = active >= 0 && (index < active || status === 'Closed');
    const highlighted = current || done;
    const iconName = ICONS[index] + '-' + (highlighted ? 'active' : 'pending');
    const leftColor = index > 0 && index <= active ? accent : '#C8D0DC';
    const rightColor = index < active ? accent : '#C8D0DC';
    return `<td width="20%" valign="top" align="center" style="padding:0;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
        <td width="50%" valign="middle"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="height:0;font-size:0;line-height:0;border-top:2px solid ${index === 0 ? 'transparent' : leftColor};">&nbsp;</td></tr></table></td>
        <td align="center" width="30" height="30" style="width:30px;min-width:30px;height:30px;border:1px solid ${highlighted ? accent : '#C8D0DC'};border-radius:16px;background:${highlighted ? accent : '#FFFFFF'};color:${highlighted ? '#ffffff' : '#62748A'};font:600 12px Arial,sans-serif;">${done ? '&#10003;' : index + 1}</td>
        <td width="50%" valign="middle"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="height:0;font-size:0;line-height:0;border-top:2px solid ${index === STAGES.length - 1 ? 'transparent' : rightColor};">&nbsp;</td></tr></table></td>
      </tr></table>
      <p style="margin:12px 0 8px;"><img src="cid:ticket-step-${iconName}" width="26" height="26" alt="" style="display:block;width:26px;height:26px;border:0;" /></p>
      <p style="margin:9px 0 0;font:600 10px Arial,sans-serif;line-height:15px;color:${highlighted ? accent : '#62748A'};">${escapeHtml(stage)}</p>
      ${current ? '<p style="margin:3px 0 0;font:10px Arial,sans-serif;color:#0D3B6E;">Current</p>' : ''}
    </td>`;
  }).join('');
  return `${badge}${exception ? `<p style="margin:0 0 18px;text-align:center;font:12px Arial,sans-serif;color:#647084;">${status === 'On-Hold' ? 'Progress is paused until work resumes.' : 'This request has ended without proceeding to closure.'}</p>` : ''}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed;"><tr>${cells}</tr></table>`;
}

function ticketEmailTemplate(status, title, color, bodyHtml) {
  const [headline, intro] = COPY[status] || ['An update on your request.', 'Please review the latest ticket details below.'];
  let portal = '';
  try {
    const url = new URL('/my-requests', process.env.FRONTEND_URL);
    if (['https:', 'http:'].includes(url.protocol)) portal = `<table role="presentation" align="center" cellspacing="0" cellpadding="0" style="margin:24px auto 0;"><tr><td bgcolor="#0D3B6E" style="border-radius:5px;"><a href="${escapeHtml(url.href)}" style="display:inline-block;padding:13px 24px;font:600 13px Arial,sans-serif;color:#fff;text-decoration:none;">Open Service Desk &rarr;</a></td></tr></table>`;
  } catch { /* A portal link is optional until a public FRONTEND_URL is configured. */ }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#F3F6FA;color:#233246;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#F3F6FA"><tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" bgcolor="#FFFFFF" style="width:100%;max-width:600px;border:1px solid #D5DFEA;border-radius:10px;">
        <tr><td align="center" style="background:#0D3B6E;padding:24px;font:600 11px Arial,sans-serif;letter-spacing:2px;color:#FFFFFF;">DSWD FIELD OFFICE III<br><span style="display:inline-block;margin-top:8px;color:#E8F1FA;letter-spacing:1px;">ICT SERVICE DESK</span></td></tr>
        <tr><td align="center" style="padding:28px 24px 8px;"><h1 style="margin:0;font:600 30px Arial,sans-serif;line-height:1.15;color:#0D3B6E;">${escapeHtml(headline)}</h1><p style="max-width:440px;margin:16px auto 0;font:14px Arial,sans-serif;line-height:1.7;color:#627084;">${escapeHtml(intro)}</p></td></tr>
        <tr><td style="background:#E8F1FA;padding:26px 18px;border-bottom:1px solid #D5DFEA;">${ticketProgressHtml(status)}</td></tr>
        <tr><td style="padding:24px;font:13px Arial,sans-serif;line-height:1.7;color:#344456;"><h2 style="margin:0 0 18px;font:600 15px Arial,sans-serif;color:#0D3B6E;">${escapeHtml(title.replace(/^[^A-Za-z]+/, ''))}</h2>${bodyHtml}${portal}</td></tr>
        <tr><td align="center" style="padding:20px 24px;border-top:1px solid #D5DFEA;font:11px Arial,sans-serif;line-height:1.7;color:#778291;">Department of Social Welfare and Development<br>This is an automated notification. Please do not reply to this email.</td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}

function csmFeedbackHtml() {
  return `<div style="background:#FEF3DC;border-left:4px solid #CC7700;padding:16px;margin:20px 0;border-radius:4px;font:13px Arial,sans-serif;line-height:1.7;color:#61491F;">
    <strong style="color:#854F0B;">&#9888; Action Required &mdash; CSMF</strong><br>
    Please fill out the <strong>Client Satisfaction Measurement Form (CSMF)</strong>
    to formally close this ticket and help us improve our services.<br><br>
    Log in to the <strong>ICTMS Portal</strong> and go to
    <strong>Ticket List &amp; Tracking</strong> to access the CSMF button.
  </div>`;
}

function ticketEmailAttachments(html) {
  const names = [...new Set([...String(html || '').matchAll(/cid:ticket-step-([a-z]+-(?:active|pending))/g)].map(match => match[1]))];
  const attachments = names.filter(name => ICONS.some(icon => name === `${icon}-active` || name === `${icon}-pending`)).map(name => ({
    filename: `${name}.png`, path: path.join(__dirname, '../assets/email', `${name}.png`),
    cid: `ticket-step-${name}`, contentType: 'image/png', contentDisposition: 'inline',
  }));
  return attachments;
}
module.exports = { ticketEmailTemplate, ticketProgressHtml, ticketEmailAttachments, csmFeedbackHtml, escapeHtml };