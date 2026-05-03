import { apiClient } from "@/lib/apiClient";

export interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
}

export const profileService = {
  getProfile: () => apiClient.get<Profile>("/profile"),

  updateProfile: (data: Partial<Profile>) =>
    apiClient.put<Profile>("/profile", data),
};
