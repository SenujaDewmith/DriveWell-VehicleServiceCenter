const prisma = require("../lib/prisma");
const logger = require("../utils/logger");
const { fmtDate } = require("../lib/format");
const { VEHICLE_SELECT, flattenVehicleRef } = require("../lib/vehicleFlatten");
const { isFullyDone } = require("../constants/status");

const CUSTOMER_ROLE = 5;
// Matches MAX_FEATURED_FEEDBACK in admin_fd/feedback.jsx — the landing page's
// testimonials section only ever displays up to 4 manager-picked feedback entries.
const MAX_FEATURED_FEEDBACK = 4;

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
            vehicle: VEHICLE_SELECT,
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
      is_featured: f.is_featured,
      booking_ref: f.reservation.booking_ref,
      service_date: fmtDate(f.reservation.service_date),
      ...flattenVehicleRef(f.reservation.vehicle),
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
    if (!isFullyDone(booking.status))
      return res.status(400).json({ message: "Feedback can only be submitted once the vehicle has been collected" });

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

// Public — no auth. Only manager-featured feedback is fit for marketing display,
// and only the customer's first name + last initial is exposed (full name is PII).
const listPublicTestimonials = async (req, res) => {
  try {
    const rows = await prisma.feedback.findMany({
      where: { is_featured: true },
      select: {
        feedback_id: true,
        rating: true,
        comment: true,
        customer: {
          select: { customer: { select: { full_name: true } } },
        },
      },
      orderBy: { submitted_at: "desc" },
      take: MAX_FEATURED_FEEDBACK,
    });

    const testimonials = rows
      .filter((f) => f.comment?.trim().length > 0 && f.customer.customer?.full_name)
      .map((f) => {
        const [first, ...rest] = f.customer.customer.full_name.trim().split(/\s+/);
        const lastInitial = rest.length ? `${rest[rest.length - 1][0]}.` : "";
        return {
          feedback_id: f.feedback_id,
          rating: f.rating,
          comment: f.comment,
          display_name: [first, lastInitial].filter(Boolean).join(" "),
        };
      });

    res.status(200).json({ testimonials });
  } catch (error) {
    logger.error(`listPublicTestimonials failed — ${error.message}`);
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

const featureFeedback = async (req, res) => {
  try {
    const feedbackId = parseInt(req.params.id);
    const existing = await prisma.feedback.findUnique({
      where: { feedback_id: feedbackId },
      select: { is_featured: true, comment: true },
    });
    if (!existing) return res.status(404).json({ message: "Feedback not found" });

    if (!existing.is_featured) {
      if (!existing.comment?.trim()) {
        return res.status(400).json({ message: "Feedback with no comment can't be featured" });
      }
      const featuredCount = await prisma.feedback.count({ where: { is_featured: true } });
      if (featuredCount >= MAX_FEATURED_FEEDBACK) {
        return res.status(400).json({
          message: `Already have ${MAX_FEATURED_FEEDBACK} testimonials selected. Unfeature one before adding another.`,
        });
      }
    }

    const feedback = await prisma.feedback.update({
      where: { feedback_id: feedbackId },
      data: { is_featured: true },
      select: { feedback_id: true, is_featured: true },
    });
    res.status(200).json({ message: "Feedback featured", feedback });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Feedback not found" });
    logger.error(`featureFeedback failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const unfeatureFeedback = async (req, res) => {
  try {
    const feedback = await prisma.feedback.update({
      where: { feedback_id: parseInt(req.params.id) },
      data: { is_featured: false },
      select: { feedback_id: true, is_featured: true },
    });
    res.status(200).json({ message: "Feedback unfeatured", feedback });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Feedback not found" });
    logger.error(`unfeatureFeedback failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  listFeedback,
  submitFeedback,
  getFeedbackByBooking,
  listPublicTestimonials,
  featureFeedback,
  unfeatureFeedback,
};
