import type { Booking } from "@/services/bookings.service";

// Must match CANCELLATION_CUTOFF_MINUTES in backend/src/controllers/bookings.controller.js —
// this only drives the UI's disabled state; the backend independently enforces the real rule.
export const CANCELLATION_CUTOFF_HOURS = 24;

// slot_time is "HH:MM:SS"; combined with service_date ("YYYY-MM-DD") this parses as local time,
// matching how the rest of the app treats booking dates/times as local wall-clock values.
export function hoursUntilAppointment(booking: Booking): number | null {
  if (!booking.slot_time) return null;
  const scheduledAt = new Date(`${booking.service_date}T${booking.slot_time}`);
  return (scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60);
}

export function canSelfCancel(booking: Booking): boolean {
  if (booking.status !== "Booked") return false;
  const hoursUntil = hoursUntilAppointment(booking);
  return hoursUntil === null || hoursUntil >= CANCELLATION_CUTOFF_HOURS;
}

// Single source of truth for which statuses live under the "Upcoming" vs "Past" tab on
// the bookings list — shared with BookingDetails so "Back to Bookings" can return to the
// tab that actually contains this booking, instead of always landing on Upcoming.
export const UPCOMING_STATUSES: Booking["status"][] = ["Booked", "Started", "In Progress", "Ready for Pickup"];
export const PAST_STATUSES: Booking["status"][] = ["Completed", "Cancelled", "No-show"];

export function bookingListTab(status: Booking["status"]): "upcoming" | "past" {
  return UPCOMING_STATUSES.includes(status) ? "upcoming" : "past";
}
