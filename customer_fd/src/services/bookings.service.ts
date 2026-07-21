import { apiClient } from "@/lib/apiClient";

// Populated only on the single-booking detail response (getBooking), not on list rows —
// the itemized "additional work found" list stays server-side, hidden from customers.
export interface BookingServiceRecord {
  remarks: string | null;
  quality_checked: boolean;
  started_at: string | null;
  completed_at: string | null;
}

export interface BookingInvoiceItem {
  invoice_item_id: number;
  description: string;
  unit_price: string;
  quantity: number;
  line_total: string;
}

export interface BookingInvoice {
  invoice_id: number;
  base_amount: string;
  additional_charges: string;
  discount: string;
  total_amount: string;
  payment_status: "Paid" | "Unpaid";
  payment_method: string | null;
  notes: string | null;
  generated_at: string;
  items: BookingInvoiceItem[];
}

export interface Booking {
  reservation_id: number;
  booking_ref: string;
  service_date: string;
  status: "Booked" | "Started" | "In Progress" | "Completed" | "Ready for Pickup" | "Cancelled" | "No-show";
  created_at: string;
  vehicle_id: number;
  package_id: number;
  make?: string;
  model?: string;
  plate_no?: string;
  vehicle_type?: string;
  package_name?: string;
  package_price?: string;
  estimated_duration?: number;
  slot_time?: string | null;
  slot_end_time?: string | null;
  service_record?: BookingServiceRecord | null;
  invoice?: BookingInvoice | null;
}

export interface CreateBookingPayload {
  vehicle_id: number;
  package_id: number;
  service_date: string;
  start_time: string;
}

export interface AvailableSlot {
  start_time: string;
  end_time: string;
  capacity: number;
  booked_count: number;
  remaining: number;
}

export interface AvailableSlotsResponse {
  available: boolean;
  reason?: string;
  slots: AvailableSlot[];
}

export type DayAvailabilityStatus = "available" | "limited" | "full" | "closed";

export interface DayAvailability {
  date: string;
  status: DayAvailabilityStatus;
  remaining_capacity: number;
  total_windows: number;
}

export interface MonthAvailabilityResponse {
  days: DayAvailability[];
}

export const bookingsService = {
  getBookings: () => apiClient.get<{ bookings: Booking[] }>("/bookings"),

  getBooking: (id: number) => apiClient.get<{ booking: Booking }>(`/bookings/${id}`),

  createBooking: (data: CreateBookingPayload) =>
    apiClient.post<{ message: string; booking_ref: string; reservation_id: number }>("/bookings", data),

  cancelBooking: (id: number) =>
    apiClient.patch<{ message: string }>(`/bookings/${id}/cancel`, {}),

  getAvailableSlots: (date: string, packageId: number) =>
    apiClient.get<AvailableSlotsResponse>(`/bookings/available-slots?date=${date}&package_id=${packageId}`),

  getMonthAvailability: (year: number, month: number, packageId: number) =>
    apiClient.get<MonthAvailabilityResponse>(`/bookings/calendar?year=${year}&month=${month}&package_id=${packageId}`),
};
