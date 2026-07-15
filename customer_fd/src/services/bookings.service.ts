import { apiClient } from "@/lib/apiClient";

export interface Booking {
  reservation_id: number;
  booking_ref: string;
  service_date: string;
  status: "Booked" | "Started" | "In Progress" | "Completed" | "Ready for Pickup" | "Cancelled" | "No-show";
  created_at: string;
  vehicle_id: number;
  package_id: number;
  slot_id: number | null;
  make?: string;
  model?: string;
  plate_no?: string;
  vehicle_type?: string;
  package_name?: string;
  package_price?: string;
  estimated_duration?: number;
  slot_time?: string | null;
}

export interface CreateBookingPayload {
  vehicle_id: number;
  package_id: number;
  service_date: string;
  slot_id: number;
}

export interface AvailableSlot {
  slot_id: number;
  slot_time: string;
  is_active: boolean;
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
  daily_capacity: number;
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

  getAvailableSlots: (date: string) =>
    apiClient.get<AvailableSlotsResponse>(`/bookings/available-slots?date=${date}`),

  getMonthAvailability: (year: number, month: number) =>
    apiClient.get<MonthAvailabilityResponse>(`/bookings/calendar?year=${year}&month=${month}`),
};
