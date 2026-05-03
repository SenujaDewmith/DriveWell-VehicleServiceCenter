import { apiClient } from "@/lib/apiClient";

export interface ServicePackage {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  features: string[];
}

export const servicesService = {
  getPackages: () => apiClient.get<ServicePackage[]>("/packages"),

  getPackage: (id: string) => apiClient.get<ServicePackage>(`/packages/${id}`),
};
