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
  color?: string;
  package_name?: string;
  package_price?: string;
  estimated_duration?: number;
  slot_time?: string | null;
}

export interface CreateBookingPayload {
  vehicle_id: number;
  package_id: number;
  service_date: string;
  slot_id?: number;
}

export interface AvailableSlot {
  slot_id: number;
  slot_time: string;
  is_active: boolean;
}

export interface AvailableSlotsResponse {
  available: boolean;
  reason?: string;
  remaining_capacity?: number;
  slots: AvailableSlot[];
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
};
