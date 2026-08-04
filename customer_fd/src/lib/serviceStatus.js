// The note that fills the gap between "Supervisor marked the service Completed" and
// "vehicle actually handed back". "Ready for Pickup" is no longer a stored status — the
// reservation stays "Completed" throughout, so this reads payment_status directly instead
// of relying on a status transition to know whether the customer still needs to pay.
export function getCustomerStatusNote(booking) {
  if (booking.status === "Completed") {
    if (!booking.invoice) return "Payment has to be done — we're preparing your invoice.";
    return booking.invoice.payment_status === "Paid"
      ? "Payment received. Please collect your vehicle from our staff."
      : "Payment has to be done — please visit the service center to pay and collect your vehicle.";
  }
  if (booking.status === "Collected") {
    return "Vehicle collected. Thank you for choosing DriveWell! Feel free to leave us a comment about your service experience.";
  }
  return null;
}
