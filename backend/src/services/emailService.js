const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,

  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendEmail({
  to,
  subject,
  html,
  inReplyTo = null,
  references = null,
}) {

  const mailOptions = {
    from: `"ICT Helpdesk" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  };

  // Email threading
  if (inReplyTo) {
    mailOptions.inReplyTo = inReplyTo;
    mailOptions.references = references || inReplyTo;
  }

  const info = await transporter.sendMail(mailOptions);

  return info;
}


async function sendThreadedTicketEmail({
  ticketId,
  subject,
  html,
  db,
}) {

  // Get thread info
  const [threadRows] = await db.query(`
    SELECT *
    FROM ticket_email_threads
    WHERE ticket_id = ?
    LIMIT 1
  `, [ticketId]);

  if (threadRows.length === 0) {
    console.log('No email thread found.');
    return;
  }

  const thread = threadRows[0];

  await sendEmail({
    to: thread.requester_email,

    subject,

    html,

    inReplyTo: thread.email_message_id,

    references: thread.email_message_id,
  });

  console.log('Threaded email sent.');
}



module.exports = { sendEmail, sendThreadedTicketEmail, };
