import { apiClient } from "@/lib/apiClient";

export interface Vehicle {
  vehicle_id: number;
  customer_id: number | null;
  make_id: number;
  make: string;
  model_id: number;
  model: string;
  vehicle_type_id: number;
  vehicle_type: string;
  year: number | null;
  plate_no: string;
  created_at: string;
  detached_at: string | null;
}

export type PlateLookupResult =
  | { found: false }
  | { found: true; status: "own" | "claimable"; vehicle: Vehicle }
  | { found: true; status: "active_elsewhere" };

export interface VehicleMake {
  make_id: number;
  name: string;
}

export interface VehicleModel {
  model_id: number;
  name: string;
  make_id: number;
  vehicle_type_id: number | null;
}

export interface VehicleTypeOption {
  type_id: number;
  name: string;
}

export type CreateVehiclePayload = {
  make_id: number;
  model_id: number;
  vehicle_type_id: number;
  year?: number;
  plate_no: string;
};

export const vehiclesService = {
  getVehicles: () => apiClient.get<{ vehicles: Vehicle[] }>("/vehicles"),

  createVehicle: (data: CreateVehiclePayload) =>
    apiClient.post<{ message: string; vehicle: Vehicle }>("/vehicles", data),

  updateVehicle: (id: number, data: CreateVehiclePayload) =>
    apiClient.put<{ message: string; vehicle: Vehicle }>(`/vehicles/${id}`, data),

  deleteVehicle: (id: number) => apiClient.delete<{ message: string }>(`/vehicles/${id}`),

  lookupPlate: (plate: string) =>
    apiClient.get<PlateLookupResult>(`/vehicles/lookup/${encodeURIComponent(plate.trim().toUpperCase())}`),

  claimVehicle: (plate_no: string) =>
    apiClient.post<{ message: string; vehicle: Vehicle }>("/vehicles/claim", { plate_no }),

  getDetachedVehicles: () => apiClient.get<{ vehicles: Vehicle[] }>("/vehicles/detached"),

  restoreVehicle: (id: number) =>
    apiClient.post<{ message: string; vehicle: Vehicle }>(`/vehicles/${id}/restore`, {}),

  getMakes: () => apiClient.get<{ makes: VehicleMake[] }>("/vehicles/makes"),

  getModels: (makeId: number) =>
    apiClient.get<{ models: VehicleModel[] }>(`/vehicles/models?make_id=${makeId}`),

  getVehicleTypes: () => apiClient.get<{ types: VehicleTypeOption[] }>("/vehicles/types"),
};
