// Single source of truth for the reservation/payment lifecycle. Every controller that
// needs to validate or reason about a status should import from here instead of
// re-declaring its own array — that drift (e.g. the feedback gate forgetting a status
// the invoice gate recognized) is what caused the original bug this module fixes.

const RESERVATION_STATUS = {
  BOOKED: "Booked",
  STARTED: "Started",
  COMPLETED: "Completed",
  COLLECTED: "Collected",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

const PAYMENT_STATUS = {
  UNPAID: "Unpaid",
  PAID: "Paid",
};

// Linear workflow only — Cancelled/No-show are terminal exits from Booked, not points
// on this line, so they're deliberately left out of the ordered progression.
const RESERVATION_STATUS_ORDER = [
  RESERVATION_STATUS.BOOKED,
  RESERVATION_STATUS.STARTED,
  RESERVATION_STATUS.COMPLETED,
  RESERVATION_STATUS.COLLECTED,
];

const TRANSITIONS = {
  [RESERVATION_STATUS.BOOKED]: [RESERVATION_STATUS.STARTED, RESERVATION_STATUS.CANCELLED, RESERVATION_STATUS.NO_SHOW],
  [RESERVATION_STATUS.STARTED]: [RESERVATION_STATUS.COMPLETED],
  [RESERVATION_STATUS.COMPLETED]: [RESERVATION_STATUS.COLLECTED],
  [RESERVATION_STATUS.COLLECTED]: [],
  [RESERVATION_STATUS.CANCELLED]: [],
  [RESERVATION_STATUS.NO_SHOW]: [],
};

// The one canonical answer to "is this service fully done" — replaces every hand-rolled
// ["Completed", "Ready for Pickup"]-style array that previously had to be kept in sync
// by hand across feedback/invoice/detachment/KPI code.
const isFullyDone = (status) => status === RESERVATION_STATUS.COLLECTED;

module.exports = {
  RESERVATION_STATUS,
  PAYMENT_STATUS,
  RESERVATION_STATUS_ORDER,
  TRANSITIONS,
  isFullyDone,
};
