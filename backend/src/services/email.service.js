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

const sendVehicleTransferredEmail = (to, { customerName, plateNo, reason }) =>
  sendEmail(to, "Your Vehicle Has Changed Hands – DriveWell", `
    <h2>Vehicle Ownership Update</h2>
    <p>Hi ${customerName},</p>
    <p>Your vehicle <strong>${plateNo}</strong> ${reason === "claimed"
      ? "has been claimed and linked to a new owner's DriveWell account."
      : "has been transferred to a new owner by DriveWell staff."}</p>
    <p>If you did not expect this change, please contact DriveWell support.</p>
  `);

const sendTransferRequestNoticeEmail = (to, { customerName, plateNo }) =>
  sendEmail(to, "Someone Requested Your Vehicle – DriveWell", `
    <h2>Vehicle Transfer Request</h2>
    <p>Hi ${customerName},</p>
    <p>Someone has submitted a request to claim your vehicle <strong>${plateNo}</strong> on DriveWell, along with
    verification documents (logbook and NIC photos).</p>
    <p>Nothing has changed yet — a DriveWell manager will review the documents before any transfer happens.
    If you did not sell or give away this vehicle, please contact DriveWell support immediately.</p>
  `);

const sendTransferRequestDecisionEmail = (to, { customerName, plateNo, approved, reason }) =>
  sendEmail(to, `Transfer Request ${approved ? "Approved" : "Rejected"} – DriveWell`, `
    <h2>Transfer Request ${approved ? "Approved" : "Rejected"}</h2>
    <p>Hi ${customerName},</p>
    ${approved
      ? `<p>Your request to claim <strong>${plateNo}</strong> has been approved. It now appears in your DriveWell account along with its service history.</p>`
      : `<p>Your request to claim <strong>${plateNo}</strong> was not approved.</p>${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}`
    }
  `);

module.exports = {
  sendWelcomeEmail, sendBookingConfirmation, sendBookingCancellation, sendStatusUpdate,
  sendVehicleTransferredEmail,
  sendTransferRequestNoticeEmail, sendTransferRequestDecisionEmail,
};
