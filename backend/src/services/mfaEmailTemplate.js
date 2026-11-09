const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function mfaEmailTemplate(fullName, otp, isResend = false) {
  const code = String(otp);
  if (!/^[0-9]{6}$/.test(code)) throw new Error('Verification email requires a six-digit code.');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#F1F5FA;color:#374151;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#F1F5FA"><tr><td align="center" style="padding:36px 16px;">
      <table role="presentation" width="480" cellspacing="0" cellpadding="0" bgcolor="#FFFFFF" style="width:100%;max-width:480px;border:1px solid #DCE5EF;border-radius:12px;box-shadow:0 8px 28px #0D3B6E12;">
        <tr><td style="padding:24px 28px;background:#0D3B6E;border-radius:11px 11px 0 0;font:600 12px Arial,sans-serif;color:#FFFFFF;">FO3 Service Desk<span style="color:#C4D9EE;font-weight:400;"> &nbsp; / &nbsp; Account security</span></td></tr>
        <tr><td style="padding:26px 28px;font:13px Arial,sans-serif;line-height:1.65;">
          <h1 style="margin:0 0 18px;font:600 23px Arial,sans-serif;line-height:1.3;color:#0D3B6E;">Confirm your sign-in</h1>
          <p style="margin:0 0 14px;">Hi ${escapeHtml(fullName || 'there')},</p>
          <p style="margin:0 0 16px;">${isResend ? 'Here is your new verification code:' : 'Your verification code is:'}</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border:1px solid #C9DCEF;border-radius:8px;background:#E8F1FA;"><tr><td align="center" style="padding:20px 12px;"><p style="margin:0 0 10px;font:600 10px Arial,sans-serif;letter-spacing:1px;color:#526E90;">VERIFICATION CODE</p><span style="display:inline-block;font:600 30px Arial,sans-serif;letter-spacing:5px;line-height:1.3;color:#0D3B6E;white-space:nowrap;user-select:all;-webkit-user-select:all;">${code}</span></td></tr></table>
          <p style="margin:0 0 14px;">Enter this code in the Service Desk to continue. It expires in <strong>10 minutes</strong>.</p>
          ${isResend ? '<p style="margin:0 0 14px;color:#52657A;">Your previous email code no longer works. Use the new code above.</p>' : ''}
          <p style="margin:0 0 20px;color:#52657A;">Please don&rsquo;t share this code with anyone.</p>
          <p style="margin:0;color:#68778A;font-size:12px;">Didn&rsquo;t request this? Contact the ICT Helpdesk.</p>
        </td></tr>
        <tr><td style="padding:18px 28px;background:#F8FAFD;border-top:1px solid #E6EDF5;font:11px Arial,sans-serif;line-height:1.7;color:#7A899B;">DSWD Field Office III<br>Automated message &middot; Please do not reply.</td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}

module.exports = mfaEmailTemplate;
