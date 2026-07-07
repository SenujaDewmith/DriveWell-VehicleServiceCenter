const prisma = require("../lib/prisma");
const logger = require("../utils/logger");

const CUSTOMER_ROLE = 5;

const listFeedback = async (req, res) => {
  const { user_id, role_id } = req.user;
  const { from, to } = req.query;

  try {
    const where = {};
    if (role_id === CUSTOMER_ROLE) where.customer_id = user_id;
    if (from || to) {
      where.submitted_at = {};
      if (from) where.submitted_at.gte = new Date(from);
      if (to) where.submitted_at.lte = new Date(to);
    }

    const rows = await prisma.feedback.findMany({
      where,
      include: {
        reservation: {
          select: {
            booking_ref: true,
            service_date: true,
            package: { select: { name: true } },
          },
        },
        customer: {
          select: { customer: { select: { full_name: true } } },
        },
      },
      orderBy: { submitted_at: "desc" },
    });

    const feedback = rows.map((f) => ({
      feedback_id: f.feedback_id,
      reservation_id: f.reservation_id,
      customer_id: f.customer_id,
      rating: f.rating,
      comment: f.comment,
      submitted_at: f.submitted_at,
      booking_ref: f.reservation.booking_ref,
      service_date: f.reservation.service_date,
      package_name: f.reservation.package.name,
      customer_name: f.customer.customer?.full_name,
    }));

    res.status(200).json({ feedback });
  } catch (error) {
    logger.error(`listFeedback failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const submitFeedback = async (req, res) => {
  const { user_id } = req.user;
  const { reservation_id, rating, comment } = req.body;

  if (!reservation_id || !rating)
    return res.status(400).json({ message: "reservation_id and rating are required" });
  if (rating < 1 || rating > 5)
    return res.status(400).json({ message: "Rating must be between 1 and 5" });

  try {
    const booking = await prisma.reservation.findUnique({
      where: { reservation_id: parseInt(reservation_id) },
      select: { status: true, customer_id: true },
    });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.customer_id !== user_id) return res.status(403).json({ message: "Access denied" });
    if (!["Completed", "Ready for Pickup"].includes(booking.status))
      return res.status(400).json({ message: "Feedback can only be submitted for completed services" });

    const feedback = await prisma.feedback.create({
      data: { reservation_id: parseInt(reservation_id), customer_id: user_id, rating, comment: comment || null },
    });
    logger.info(`Feedback submitted — feedback_id: ${feedback.feedback_id}`);
    res.status(201).json({ message: "Feedback submitted", feedback });
  } catch (error) {
    if (error.code === "P2002")
      return res.status(400).json({ message: "Feedback already submitted for this booking" });
    logger.error(`submitFeedback failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const getFeedbackByBooking = async (req, res) => {
  const { booking_id } = req.params;
  try {
    const row = await prisma.feedback.findUnique({
      where: { reservation_id: parseInt(booking_id) },
      include: {
        customer: { select: { customer: { select: { full_name: true } } } },
      },
    });
    if (!row) return res.status(404).json({ message: "No feedback for this booking" });

    const feedback = { ...row, customer_name: row.customer.customer?.full_name, customer: undefined };
    res.status(200).json({ feedback });
  } catch (error) {
    logger.error(`getFeedbackByBooking failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { listFeedback, submitFeedback, getFeedbackByBooking };
