const prisma = require("../lib/prisma");
const logger = require("../utils/logger");
const { fmtDate } = require("../lib/format");

const CUSTOMER_ROLE = 5;

const flattenInvoice = (i) => ({
  invoice_id: i.invoice_id,
  reservation_id: i.reservation_id,
  cashier_id: i.cashier_id,
  base_amount: i.base_amount,
  additional_charges: i.additional_charges,
  discount: i.discount,
  total_amount: i.total_amount,
  payment_status: i.payment_status,
  payment_method: i.payment_method,
  notes: i.notes,
  generated_at: i.generated_at,
  booking_ref: i.reservation?.booking_ref,
  service_date: i.reservation ? fmtDate(i.reservation.service_date) : null,
  booking_status: i.reservation?.status,
  customer_name: i.reservation?.customer_user?.customer?.full_name,
  customer_email: i.reservation?.customer_user?.email,
  make: i.reservation?.vehicle?.make,
  model: i.reservation?.vehicle?.model,
  plate_no: i.reservation?.vehicle?.plate_no,
  package_name: i.reservation?.package?.name,
  cashier_name: i.cashier?.staff?.full_name ?? null,
});

const INVOICE_INCLUDE = {
  reservation: {
    select: {
      booking_ref: true,
      service_date: true,
      status: true,
      customer_user: {
        select: {
          email: true,
          customer: { select: { full_name: true } },
        },
      },
      vehicle: { select: { make: true, model: true, plate_no: true } },
      package: { select: { name: true } },
    },
  },
  cashier: { select: { staff: { select: { full_name: true } } } },
};

const listInvoices = async (req, res) => {
  const { user_id, role_id } = req.user;
  const { from, to, payment_status } = req.query;

  try {
    const where = {};
    if (role_id === CUSTOMER_ROLE) {
      where.reservation = { customer_id: user_id };
    }
    if (payment_status) where.payment_status = payment_status;
    if (from || to) {
      where.reservation = {
        ...(where.reservation || {}),
        service_date: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      };
    }

    const rows = await prisma.invoice.findMany({
      where,
      include: INVOICE_INCLUDE,
      orderBy: { generated_at: "desc" },
    });

    res.status(200).json({ invoices: rows.map(flattenInvoice) });
  } catch (error) {
    logger.error(`listInvoices failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const getInvoice = async (req, res) => {
  const { user_id, role_id } = req.user;
  try {
    const row = await prisma.invoice.findUnique({
      where: { invoice_id: parseInt(req.params.id) },
      include: INVOICE_INCLUDE,
    });
    if (!row) return res.status(404).json({ message: "Invoice not found" });

    if (role_id === CUSTOMER_ROLE) {
      const booking = await prisma.reservation.findUnique({
        where: { reservation_id: row.reservation_id },
        select: { customer_id: true },
      });
      if (booking?.customer_id !== user_id)
        return res.status(403).json({ message: "Access denied" });
    }

    res.status(200).json({ invoice: flattenInvoice(row) });
  } catch (error) {
    logger.error(`getInvoice failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const createInvoice = async (req, res) => {
  const { user_id } = req.user;
  const { reservation_id, base_amount, additional_charges, discount, payment_method, notes } = req.body;

  if (!reservation_id || base_amount === undefined)
    return res.status(400).json({ message: "reservation_id and base_amount are required" });

  const add = parseFloat(additional_charges) || 0;
  const dis = parseFloat(discount) || 0;
  const total = parseFloat(base_amount) + add - dis;

  try {
    const booking = await prisma.reservation.findUnique({
      where: { reservation_id: parseInt(reservation_id) },
      select: { status: true },
    });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (!["Completed", "Ready for Pickup"].includes(booking.status))
      return res.status(400).json({ message: "Can only generate invoice for Completed or Ready for Pickup bookings" });

    const invoice = await prisma.invoice.create({
      data: {
        reservation_id: parseInt(reservation_id),
        cashier_id: user_id,
        base_amount,
        additional_charges: add,
        discount: dis,
        total_amount: total,
        payment_method: payment_method || null,
        notes: notes || null,
      },
    });

    logger.info(`Invoice created — invoice_id: ${invoice.invoice_id}, reservation_id: ${reservation_id}`);
    res.status(201).json({ message: "Invoice created", invoice });
  } catch (error) {
    if (error.code === "P2002")
      return res.status(400).json({ message: "Invoice already exists for this booking" });
    logger.error(`createInvoice failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const updatePaymentStatus = async (req, res) => {
  const { id } = req.params;
  const { payment_status, payment_method } = req.body;

  if (!payment_status || !["Paid", "Unpaid"].includes(payment_status))
    return res.status(400).json({ message: "payment_status must be 'Paid' or 'Unpaid'" });

  try {
    const invoice = await prisma.invoice.update({
      where: { invoice_id: parseInt(id) },
      data: { payment_status, payment_method: payment_method || null },
    });
    logger.info(`Invoice ${id} payment status set to ${payment_status}`);
    res.status(200).json({ message: "Payment status updated", invoice });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Invoice not found" });
    logger.error(`updatePaymentStatus failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { listInvoices, getInvoice, createInvoice, updatePaymentStatus };
