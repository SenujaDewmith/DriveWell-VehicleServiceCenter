import { apiClient } from "@/lib/apiClient";

export interface Vehicle {
  vehicle_id: number;
  customer_id: number | null;
  make_id: number | null;
  make: string;
  model_id: number | null;
  model: string;
  custom_make: string | null;
  custom_model: string | null;
  pending_catalog_review: boolean;
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
  make_id?: number;
  custom_make?: string;
  model_id?: number;
  custom_model?: string;
  vehicle_type_id: number;
  year?: number;
  plate_no: string;
};

export type TransferRequestStatus = "Pending" | "Approved" | "Rejected";

export interface TransferRequestSummary {
  request_id: number;
  status: TransferRequestStatus;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  plate_no: string;
  make: string;
  model: string;
}

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

  submitTransferRequest: (plate_no: string, logbookPhoto: File, nicPhoto: File, contactPhone: string) => {
    const formData = new FormData();
    formData.append("plate_no", plate_no);
    formData.append("contact_phone", contactPhone);
    formData.append("logbook_photo", logbookPhoto);
    formData.append("nic_photo", nicPhoto);
    return apiClient.upload<{
      message: string;
      request: { request_id: number; status: string };
      profile_updated: boolean;
    }>("/vehicles/transfer-requests", formData);
  },

  getMyTransferRequests: () =>
    apiClient.get<{ requests: TransferRequestSummary[] }>("/vehicles/transfer-requests/mine"),

  getMakes: () => apiClient.get<{ makes: VehicleMake[] }>("/vehicles/makes"),

  getModels: (makeId: number) =>
    apiClient.get<{ models: VehicleModel[] }>(`/vehicles/models?make_id=${makeId}`),

  getVehicleTypes: () => apiClient.get<{ types: VehicleTypeOption[] }>("/vehicles/types"),
};
