// Must match CANCELLATION_CUTOFF_MINUTES in backend/src/controllers/bookings.controller.js —
// this only drives the UI's disabled state; the backend independently enforces the real rule.
export const CANCELLATION_CUTOFF_HOURS = 24;
// slot_time is "HH:MM:SS"; combined with service_date ("YYYY-MM-DD") this parses as local time,
// matching how the rest of the app treats booking dates/times as local wall-clock values.
export function hoursUntilAppointment(booking) {
    if (!booking.slot_time)
        return null;
    const scheduledAt = new Date(`${booking.service_date}T${booking.slot_time}`);
    return (scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60);
}
export function canSelfCancel(booking) {
    if (booking.status !== "Booked")
        return false;
    const hoursUntil = hoursUntilAppointment(booking);
    return hoursUntil === null || hoursUntil >= CANCELLATION_CUTOFF_HOURS;
}
// Statuses meaning the vehicle is physically at the shop right now, or the customer still
// has something to do (pay the invoice) before it's truly resolved — distinct from a
// scheduled-but-not-yet-started "Booked" appointment or a fully resolved "Collected" one.
export const ACTIVE_SERVICE_STATUSES = ["Started", "Completed", "Ready for Pickup"];
// True only for a still-scheduled "Booked" appointment whose time hasn't passed yet — a
// "Booked" appointment nobody's updated yet stops counting as upcoming once its time passes,
// instead of silently staying "upcoming" forever until a human intervenes.
export function isUpcomingBooking(booking) {
    if (booking.status !== "Booked")
        return false;
    const hoursUntil = hoursUntilAppointment(booking);
    return hoursUntil === null || hoursUntil >= 0;
}
// Single source of truth for which of the three booking-list tabs (Active Service / Upcoming
// / Past) a booking belongs in — shared with BookingDetails so "Back to Bookings" can return
// to the tab that actually contains this booking, instead of always landing on Upcoming.
// Anything neither active nor upcoming (Collected, Cancelled, No-show, or a "Booked"
// appointment whose time already passed) falls through to Past.
export function bookingListTab(booking) {
    if (ACTIVE_SERVICE_STATUSES.includes(booking.status))
        return "active";
    if (isUpcomingBooking(booking))
        return "upcoming";
    return "past";
}
