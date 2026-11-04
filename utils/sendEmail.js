
const nodemailer = require('nodemailer');

module.exports = async ({ email, subject, message }) => {
  // Dev fallback: print the email instead of sending it
  if (!process.env.EMAIL_HOST && process.env.NODE_ENV !== 'production') {
    console.log(
      `\n--- EMAIL (dev) ---\nTo: ${email}\nSubject: ${subject}\n${message}\n-------------------\n`
    );
    return;
  }

  const port = Number(process.env.EMAIL_PORT) || 587;

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  try {
    await transporter.verify();
    console.log('SMTP connection verified successfully');

    await transporter.sendMail({
      from: `Furniture Store <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      text: message,
    });

    console.log('Password reset email sent successfully');
  } catch (err) {
    console.error('SMTP diagnostic error:', {
      message: err.message,
      code: err.code,
      responseCode: err.responseCode,
      command: err.command,
    });

    throw err;
  }
};
