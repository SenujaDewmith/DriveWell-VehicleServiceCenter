import { apiClient } from "@/lib/apiClient";
export const servicesService = {
  getPackages: () => apiClient.get("/packages"),
  getPackage: (id) => apiClient.get(`/packages/${id}`),
};
