const nodemailer = require("nodemailer");
const logger = require("../utils/logger");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: parseInt(process.env.SMTP_PORT) || 1025,
  secure: false,
  ignoreTLS: true,
});

const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"DriveWell" <no-reply@drivewell.local>',
      to,
      subject,
      html,
    });
    logger.info(`Email sent to ${to} — subject: ${subject}`);
  } catch (error) {
    logger.error(`Email failed to ${to} — ${error.message}`);
  }
};

const sendWelcomeEmail = (to, { customerName }) =>
  sendEmail(to, "Welcome to DriveWell!", `
    <h2>Welcome to DriveWell, ${customerName}!</h2>
    <p>Your account has been created successfully.</p>
    <p>You can now log in to book vehicle servicing, track your service history, and manage your vehicles all in one place.</p>
    <p>Thank you for choosing DriveWell!</p>
  `);

const sendBookingConfirmation = (to, { customerName, bookingRef, packageName, serviceDate, slotTime }) =>
  sendEmail(to, "Booking Confirmed – DriveWell", `
    <h2>Booking Confirmed</h2>
    <p>Hi ${customerName},</p>
    <p>Your booking has been confirmed.</p>
    <table>
      <tr><td><strong>Booking Ref:</strong></td><td>${bookingRef}</td></tr>
      <tr><td><strong>Service:</strong></td><td>${packageName}</td></tr>
      <tr><td><strong>Date:</strong></td><td>${serviceDate}</td></tr>
      <tr><td><strong>Time:</strong></td><td>${slotTime}</td></tr>
    </table>
    <p>Thank you for choosing DriveWell!</p>
  `);

const sendBookingCancellation = (to, { customerName, bookingRef, serviceDate }) =>
  sendEmail(to, "Booking Cancelled – DriveWell", `
    <h2>Booking Cancelled</h2>
    <p>Hi ${customerName},</p>
    <p>Your booking <strong>${bookingRef}</strong> for <strong>${serviceDate}</strong> has been cancelled.</p>
    <p>If this was a mistake, please contact us to rebook.</p>
  `);

const sendStatusUpdate = (to, { customerName, bookingRef, status }) =>
  sendEmail(to, `Service Update: ${status} – DriveWell`, `
    <h2>Service Status Update</h2>
    <p>Hi ${customerName},</p>
    <p>Your vehicle service (Ref: <strong>${bookingRef}</strong>) status has been updated to:</p>
    <h3>${status}</h3>
    ${status === "Ready for Pickup" ? "<p>Your vehicle is ready. Please come collect it at your earliest convenience.</p>" : ""}
    <p>Thank you for your patience.</p>
  `);

module.exports = { sendWelcomeEmail, sendBookingConfirmation, sendBookingCancellation, sendStatusUpdate };
