const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, html) => {
  const { EMAIL_USER, EMAIL_PASS } = process.env;

  if (!EMAIL_USER || !EMAIL_PASS) {
    console.error('❌ EMAIL_USER or EMAIL_PASS is missing in environment variables');
    throw new Error('Missing email credentials');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: `"Auth App" <${EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`📧 Email sent to ${to}`);
  } catch (err) {
    console.error('❌ Error sending email:', err.message);
    throw err;
  }
};

module.exports = sendEmail;
