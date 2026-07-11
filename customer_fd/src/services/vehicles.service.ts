import { apiClient } from "@/lib/apiClient";

export interface Vehicle {
  vehicle_id: number;
  customer_id: number;
  make: string;
  model: string;
  year: number | null;
  plate_no: string;
  color: string | null;
  created_at: string;
}

export type CreateVehiclePayload = {
  make: string;
  model: string;
  year?: number;
  plate_no: string;
  color?: string;
};

export const vehiclesService = {
  getVehicles: () => apiClient.get<{ vehicles: Vehicle[] }>("/vehicles"),

  getVehicle: (id: number) => apiClient.get<{ vehicle: Vehicle }>(`/vehicles/${id}`),

  createVehicle: (data: CreateVehiclePayload) =>
    apiClient.post<{ message: string; vehicle: Vehicle }>("/vehicles", data),

  updateVehicle: (id: number, data: CreateVehiclePayload) =>
    apiClient.put<{ message: string; vehicle: Vehicle }>(`/vehicles/${id}`, data),

  deleteVehicle: (id: number) => apiClient.delete<{ message: string }>(`/vehicles/${id}`),
};
