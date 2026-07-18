const prisma = require("../lib/prisma");
const logger = require("../utils/logger");
const { fmtDate } = require("../lib/format");
const { logActivity } = require("../lib/activityLogger");
const { VEHICLE_SELECT, flattenVehicleRef } = require("../lib/vehicleFlatten");

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
  ...flattenVehicleRef(i.reservation?.vehicle),
  package_name: i.reservation?.package?.name,
  cashier_name: i.cashier?.staff?.full_name ?? null,
  items: (i.items ?? []).map((it) => ({
    invoice_item_id: it.invoice_item_id,
    catalog_item_id: it.catalog_item_id,
    description: it.description,
    unit_price: it.unit_price,
    quantity: it.quantity,
    line_total: it.line_total,
  })),
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
      vehicle: VEHICLE_SELECT,
      package: { select: { name: true } },
    },
  },
  cashier: { select: { staff: { select: { full_name: true } } } },
  items: true,
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

// Everything a cashier needs to build an itemized invoice for a booking: the package's
// base ("upwards") price, and the supervisor's structured notes on additional work found,
// each paired with its manager-catalog suggested price so the cashier isn't pricing blind.
const getInvoiceDraft = async (req, res) => {
  const { booking_id } = req.params;
  try {
    const booking = await prisma.reservation.findUnique({
      where: { reservation_id: parseInt(booking_id) },
      include: {
        customer_user: { select: { email: true, customer: { select: { full_name: true } } } },
        vehicle: VEHICLE_SELECT,
        package: { select: { name: true, price: true } },
        service_record: {
          include: { items: { include: { catalog_item: true }, orderBy: { created_at: "asc" } } },
        },
      },
    });
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    res.status(200).json({
      reservation_id: booking.reservation_id,
      booking_ref: booking.booking_ref,
      customer_name: booking.customer_user?.customer?.full_name,
      ...flattenVehicleRef(booking.vehicle),
      package_name: booking.package?.name,
      package_price: booking.package?.price,
      remarks: booking.service_record?.remarks ?? null,
      suggested_items: (booking.service_record?.items ?? []).map((it) => ({
        catalog_item_id: it.catalog_item_id,
        description: it.description,
        quantity: it.quantity,
        suggested_price: it.catalog_item?.default_price ?? null,
      })),
    });
  } catch (error) {
    logger.error(`getInvoiceDraft failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const createInvoice = async (req, res) => {
  const { user_id } = req.user;
  const { reservation_id, base_amount, items, discount, payment_method, notes } = req.body;

  if (!reservation_id || base_amount === undefined)
    return res.status(400).json({ message: "reservation_id and base_amount are required" });

  const lineItems = Array.isArray(items) ? items : [];
  for (const it of lineItems) {
    if (!it.description || it.unit_price === undefined)
      return res.status(400).json({ message: "Each item requires a description and unit_price" });
  }

  const dis = parseFloat(discount) || 0;
  const computedItems = lineItems.map((it) => {
    const qty = parseInt(it.quantity) || 1;
    const unitPrice = parseFloat(it.unit_price);
    return {
      catalog_item_id: it.catalog_item_id ? parseInt(it.catalog_item_id) : null,
      description: it.description,
      unit_price: unitPrice,
      quantity: qty,
      line_total: unitPrice * qty,
    };
  });
  const additionalCharges = computedItems.reduce((sum, it) => sum + it.line_total, 0);
  const total = parseFloat(base_amount) + additionalCharges - dis;

  try {
    const booking = await prisma.reservation.findUnique({
      where: { reservation_id: parseInt(reservation_id) },
      select: { status: true },
    });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (!["Completed", "Ready for Pickup"].includes(booking.status))
      return res.status(400).json({ message: "Can only generate invoice for Completed or Ready for Pickup bookings" });

    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          reservation_id: parseInt(reservation_id),
          cashier_id: user_id,
          base_amount,
          additional_charges: additionalCharges,
          discount: dis,
          total_amount: total,
          payment_method: payment_method || null,
          notes: notes || null,
          items: { create: computedItems },
        },
        include: { items: true },
      });
      return created;
    });

    logger.info(`Invoice created — invoice_id: ${invoice.invoice_id}, reservation_id: ${reservation_id}`);
    logActivity(prisma, { user_id, action: "INVOICE_GENERATED", entity_type: "invoice", entity_id: invoice.invoice_id });
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
    if (payment_status === "Paid") {
      logActivity(prisma, { user_id: req.user.user_id, action: "PAYMENT_RECEIVED", entity_type: "invoice", entity_id: parseInt(id) });
    }
    res.status(200).json({ message: "Payment status updated", invoice });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Invoice not found" });
    logger.error(`updatePaymentStatus failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { listInvoices, getInvoice, getInvoiceDraft, createInvoice, updatePaymentStatus };
