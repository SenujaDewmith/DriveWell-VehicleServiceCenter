import { apiClient } from "@/lib/apiClient";

export interface Booking {
  id: string;
  vehicleId: string;
  packageId: string;
  scheduledDate: string;
  status: "pending" | "confirmed" | "in-progress" | "completed" | "cancelled";
  notes?: string;
  createdAt: string;
}

export interface CreateBookingPayload {
  vehicleId: string;
  packageId: string;
  scheduledDate: string;
  notes?: string;
}

export const bookingsService = {
  getBookings: () => apiClient.get<Booking[]>("/bookings"),

  getBooking: (id: string) => apiClient.get<Booking>(`/bookings/${id}`),

  createBooking: (data: CreateBookingPayload) =>
    apiClient.post<Booking>("/bookings", data),

  updateBooking: (id: string, data: Partial<CreateBookingPayload>) =>
    apiClient.put<Booking>(`/bookings/${id}`, data),

  cancelBooking: (id: string) =>
    apiClient.patch<Booking>(`/bookings/${id}/cancel`, {}),
};
