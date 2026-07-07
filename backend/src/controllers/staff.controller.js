const prisma = require("../lib/prisma");
const logger = require("../utils/logger");
const { fmtDate } = require("../lib/format");

const myServices = async (req, res) => {
  const { user_id } = req.user;
  const { from, to } = req.query;

  try {
    const dateFilter = {};
    if (from || to) {
      dateFilter.service_date = {};
      if (from) dateFilter.service_date.gte = new Date(from);
      if (to)   dateFilter.service_date.lte = new Date(to);
    }

    const rows = await prisma.serviceStaffAssignment.findMany({
      where: { staff_id: user_id },
      include: {
        record: {
          include: {
            reservation: {
              where: dateFilter,
              include: {
                customer_user: { select: { customer: { select: { full_name: true } } } },
                vehicle: { select: { make: true, model: true, plate_no: true } },
                package: { select: { name: true } },
                feedback: { select: { rating: true, comment: true } },
              },
            },
          },
        },
      },
    });

    const services = rows
      .filter((a) => a.record?.reservation)
      .map((a) => {
        const r = a.record.reservation;
        const sr = a.record;
        return {
          reservation_id: r.reservation_id,
          booking_ref: r.booking_ref,
          service_date: fmtDate(r.service_date),
          status: r.status,
          customer_name: r.customer_user?.customer?.full_name ?? null,
          make: r.vehicle?.make,
          model: r.vehicle?.model,
          plate_no: r.vehicle?.plate_no,
          package_name: r.package?.name,
          task_type: a.task_type,
          remarks: sr.remarks,
          additional_work: sr.additional_work,
          rating: r.feedback?.rating ?? null,
          feedback_comment: r.feedback?.comment ?? null,
        };
      });

    res.status(200).json({ services });
  } catch (error) {
    logger.error(`myServices failed for user_id: ${user_id} — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const myPerformance = async (req, res) => {
  const { user_id } = req.user;
  const { from, to } = req.query;

  try {
    const dateFilter = {};
    if (from || to) {
      dateFilter.service_date = {};
      if (from) dateFilter.service_date.gte = new Date(from);
      if (to)   dateFilter.service_date.lte = new Date(to);
    }

    const assignments = await prisma.serviceStaffAssignment.findMany({
      where: { staff_id: user_id },
      include: {
        record: {
          include: {
            reservation: {
              where: dateFilter,
              include: { feedback: { select: { rating: true, feedback_id: true } } },
            },
          },
        },
      },
    });

    const validRecords = assignments.filter((a) => a.record?.reservation);
    const uniqueRecords = [...new Set(validRecords.map((a) => a.record_id))].length;
    const feedbacks = validRecords
      .map((a) => a.record.reservation.feedback)
      .filter(Boolean);
    const ratings = feedbacks.map((f) => f.rating);
    const avg_rating = ratings.length
      ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 100) / 100
      : null;

    const serviceDates = validRecords.map((a) => a.record.reservation.service_date).filter(Boolean);

    const performance = {
      jobs_completed: uniqueRecords,
      avg_rating,
      feedback_count: feedbacks.length,
      first_service: serviceDates.length ? fmtDate(new Date(Math.min(...serviceDates))) : null,
      last_service:  serviceDates.length ? fmtDate(new Date(Math.max(...serviceDates))) : null,
    };

    const ratingMap = {};
    ratings.forEach((r) => { ratingMap[r] = (ratingMap[r] || 0) + 1; });
    const rating_breakdown = Object.entries(ratingMap)
      .map(([rating, count]) => ({ rating: parseInt(rating), count }))
      .sort((a, b) => b.rating - a.rating);

    res.status(200).json({ performance, rating_breakdown });
  } catch (error) {
    logger.error(`myPerformance failed for user_id: ${user_id} — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { myServices, myPerformance };
