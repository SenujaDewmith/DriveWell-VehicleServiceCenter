// Payment has to be done — the note that fills the gap between "Supervisor marked the
// service Completed" and "vehicle actually handed back", so the customer knows an
// unpaid Completed booking still needs action from them, not that it's finished.
export function getCustomerStatusNote(booking) {
  if (booking.status === "Completed") {
    return booking.invoice
      ? "Payment has to be done — please visit the service center to pay and collect your vehicle."
      : "Payment has to be done — we're preparing your invoice.";
  }
  if (booking.status === "Ready for Pickup") {
    // Payment only happens in person at the service center (cash/card at the counter), so by
    // the time this status is set the customer has already paid on-site — don't tell them to
    // "visit", just that the car is ready to be handed over.
    return "Payment received. Please collect your vehicle from our staff.";
  }
  if (booking.status === "Collected") {
    return "Vehicle collected. Thank you for choosing DriveWell!";
  }
  return null;
}
