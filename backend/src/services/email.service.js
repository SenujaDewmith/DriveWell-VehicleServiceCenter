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

const sendBookingRescheduled = (to, { customerName, bookingRef, packageName, serviceDate, slotTime }) =>
  sendEmail(to, "Booking Rescheduled – DriveWell", `
    <h2>Booking Rescheduled</h2>
    <p>Hi ${customerName},</p>
    <p>Your booking has been moved to a new date and time.</p>
    <table>
      <tr><td><strong>Booking Ref:</strong></td><td>${bookingRef}</td></tr>
      <tr><td><strong>Service:</strong></td><td>${packageName}</td></tr>
      <tr><td><strong>New Date:</strong></td><td>${serviceDate}</td></tr>
      <tr><td><strong>New Time:</strong></td><td>${slotTime}</td></tr>
    </table>
    <p>Thank you for choosing DriveWell!</p>
  `);

const sendNoShowNotice = (to, { customerName, bookingRef, serviceDate }) =>
  sendEmail(to, "We Missed You – DriveWell", `
    <h2>Missed Appointment</h2>
    <p>Hi ${customerName},</p>
    <p>You had a booking (Ref: <strong>${bookingRef}</strong>) scheduled for <strong>${serviceDate}</strong>, but our records show it wasn't attended, so we've released the slot.</p>
    <p>No worries — you're welcome to book a new appointment anytime. If this was a mistake, please contact us.</p>
  `);

const sendStatusUpdate = (to, { customerName, bookingRef, status }) =>
  sendEmail(to, `Service Update: ${status} – DriveWell`, `
    <h2>Service Status Update</h2>
    <p>Hi ${customerName},</p>
    <p>Your vehicle service (Ref: <strong>${bookingRef}</strong>) status has been updated to:</p>
    <h3>${status}</h3>
    <p>Thank you for your patience.</p>
  `);

const sendServiceCompleted = (to, { customerName, bookingRef }) =>
  sendEmail(to, "Service Completed – DriveWell", `
    <h2>Service Completed</h2>
    <p>Hi ${customerName},</p>
    <p>Your vehicle service (Ref: <strong>${bookingRef}</strong>) has been completed.</p>
    <p>We're preparing your invoice — you'll be notified once it's ready.</p>
    <p>Thank you for your patience.</p>
  `);

const sendPaymentReceived = (to, { customerName, bookingRef, totalAmount }) =>
  sendEmail(to, "Payment Received – DriveWell", `
    <h2>Payment Received</h2>
    <p>Hi ${customerName},</p>
    <p>We've received your payment of <strong>LKR ${Number(totalAmount).toLocaleString()}</strong> for your service (Ref: <strong>${bookingRef}</strong>).</p>
    <p>Your vehicle is ready — please collect it from our staff at the service center.</p>
  `);

const sendPasswordResetEmail = (to, { customerName, resetUrl }) =>
  sendEmail(to, "Reset Your Password – DriveWell", `
    <h2>Password Reset Request</h2>
    <p>Hi ${customerName},</p>
    <p>We received a request to reset your DriveWell password. Click the link below to choose a new one:</p>
    <p><a href="${resetUrl}">${resetUrl}</a></p>
    <p>This link expires in 30 minutes and can only be used once.</p>
    <p>If you didn't request this, you can safely ignore this email — your password will stay unchanged.</p>
  `);

const sendAccountSetupEmail = (to, { fullName, roleName, setupUrl }) =>
  sendEmail(to, "Your DriveWell Staff Account – Set Your Password", `
    <h2>Welcome to DriveWell, ${fullName}!</h2>
    <p>A manager has created a <strong>${roleName}</strong> account for you on the DriveWell staff portal.</p>
    <p>Click the link below to set your password and activate your account:</p>
    <p><a href="${setupUrl}">${setupUrl}</a></p>
    <p>This link expires in 24 hours and can only be used once. If it expires before you use it, ask your manager to create your account again.</p>
    <p>If you weren't expecting this, you can safely ignore this email.</p>
  `);

const sendCustomerAccountSetupEmail = (to, { fullName, setupUrl }) =>
  sendEmail(to, "Your DriveWell Account – Set Your Password", `
    <h2>Welcome to DriveWell, ${fullName}!</h2>
    <p>Our team has created a customer account for you so you can book vehicle servicing, track your service history, and manage your vehicles online.</p>
    <p>Click the link below to set your password and activate your account:</p>
    <p><a href="${setupUrl}">${setupUrl}</a></p>
    <p>This link expires in 24 hours and can only be used once. If it expires before you use it, ask us to resend your invite.</p>
    <p>If you weren't expecting this, you can safely ignore this email.</p>
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
    verification documents (registration book and NIC photos).</p>
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

const sendInvoiceReady = (to, { customerName, bookingRef, totalAmount }) =>
  sendEmail(to, "Your Invoice Is Ready – DriveWell", `
    <h2>Invoice Ready</h2>
    <p>Hi ${customerName},</p>
    <p>The invoice for your service (Ref: <strong>${bookingRef}</strong>) is ready.</p>
    <h3>Total: LKR ${Number(totalAmount).toLocaleString()}</h3>
    <p>Please visit the service center to complete payment and collect your vehicle.</p>
  `);

const sendVehicleCollected = (to, { customerName, bookingRef }) =>
  sendEmail(to, "Thank You For Choosing DriveWell!", `
    <h2>Vehicle Collected</h2>
    <p>Hi ${customerName},</p>
    <p>Your vehicle (Ref: <strong>${bookingRef}</strong>) has been collected. Thank you for choosing DriveWell!</p>
    <p>We'd love to hear how we did — feel free to log in and leave us a comment about your service experience.</p>
  `);

module.exports = {
  sendWelcomeEmail, sendBookingConfirmation, sendBookingRescheduled, sendBookingCancellation, sendNoShowNotice, sendStatusUpdate,
  sendVehicleTransferredEmail, sendPasswordResetEmail, sendAccountSetupEmail, sendCustomerAccountSetupEmail,
  sendTransferRequestNoticeEmail, sendTransferRequestDecisionEmail,
  sendInvoiceReady, sendVehicleCollected, sendPaymentReceived, sendServiceCompleted,
};
