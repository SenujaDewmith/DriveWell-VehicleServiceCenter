import { apiClient } from "@/lib/apiClient";
export const vehiclesService = {
    getVehicles: () => apiClient.get("/vehicles"),
    createVehicle: (data) => apiClient.post("/vehicles", data),
    updateVehicle: (id, data) => apiClient.put(`/vehicles/${id}`, data),
    deleteVehicle: (id) => apiClient.delete(`/vehicles/${id}`),
    lookupPlate: (plate) => apiClient.get(`/vehicles/lookup/${encodeURIComponent(plate.trim().toUpperCase())}`),
    claimVehicle: (plate_no) => apiClient.post("/vehicles/claim", { plate_no }),
    getDetachedVehicles: () => apiClient.get("/vehicles/detached"),
    restoreVehicle: (id) => apiClient.post(`/vehicles/${id}/restore`, {}),
    submitTransferRequest: (plate_no, registrationBookPhoto, nicPhoto, contactPhone) => {
        const formData = new FormData();
        formData.append("plate_no", plate_no);
        formData.append("contact_phone", contactPhone);
        formData.append("registration_book_photo", registrationBookPhoto);
        formData.append("nic_photo", nicPhoto);
        return apiClient.upload("/vehicles/transfer-requests", formData);
    },
    getMyTransferRequests: () => apiClient.get("/vehicles/transfer-requests/mine"),
    getMakes: () => apiClient.get("/vehicles/makes"),
    getModels: (makeId) => apiClient.get(`/vehicles/models?make_id=${makeId}`),
    getVehicleTypes: () => apiClient.get("/vehicles/types"),
};
