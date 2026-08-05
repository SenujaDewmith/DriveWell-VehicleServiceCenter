import { apiClient } from "@/lib/apiClient";
export const bookingsService = {
    getBookings: () => apiClient.get("/bookings"),
    getBooking: (id) => apiClient.get(`/bookings/${id}`),
    // Full history for a vehicle you currently own, including bookings made by a previous
    // owner (redacted server-side) — powers the per-vehicle "Service History" page.
    getVehicleHistory: (vehicleId) => apiClient.get(`/bookings?vehicle_id=${vehicleId}`),
    createBooking: (data) => apiClient.post("/bookings", data),
    cancelBooking: (id) => apiClient.patch(`/bookings/${id}/cancel`, {}),
    getAvailableSlots: (date, packageId, vehicleId) => apiClient.get(`/bookings/available-slots?date=${date}&package_id=${packageId}${vehicleId ? `&vehicle_id=${vehicleId}` : ""}`),
    getMonthAvailability: (year, month, packageId) => apiClient.get(`/bookings/calendar?year=${year}&month=${month}&package_id=${packageId}`),
};
