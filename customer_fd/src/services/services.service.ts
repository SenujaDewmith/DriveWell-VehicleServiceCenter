import { apiClient } from "@/lib/apiClient";

export interface ServicePackage {
  package_id: number;
  name: string;
  description: string | null;
  estimated_duration: number;
  price: string;
  image_url: string | null;
  max_capacity: number;
  is_active: boolean;
  created_at: string;
}

export const servicesService = {
  getPackages: () => apiClient.get<{ packages: ServicePackage[] }>("/packages"),

  getPackage: (id: number) => apiClient.get<{ package: ServicePackage }>(`/packages/${id}`),
};
