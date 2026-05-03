import { apiClient } from "@/lib/apiClient";

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  registration: string;
  color: string;
  fuelType: string;
}

export type CreateVehiclePayload = Omit<Vehicle, "id">;

export const vehiclesService = {
  getVehicles: () => apiClient.get<Vehicle[]>("/vehicles"),

  getVehicle: (id: string) => apiClient.get<Vehicle>(`/vehicles/${id}`),

  createVehicle: (data: CreateVehiclePayload) =>
    apiClient.post<Vehicle>("/vehicles", data),

  updateVehicle: (id: string, data: Partial<CreateVehiclePayload>) =>
    apiClient.put<Vehicle>(`/vehicles/${id}`, data),

  deleteVehicle: (id: string) => apiClient.delete<void>(`/vehicles/${id}`),
};
