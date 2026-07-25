import { apiClient } from "@/lib/apiClient";

export interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
}

export interface AvatarResponse {
  message: string;
  profile: { avatar_url: string | null };
}

export const profileService = {
  getProfile: () => apiClient.get<Profile>("/profile"),

  updateProfile: (data: Partial<Profile>) =>
    apiClient.put<Profile>("/profile", data),

  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append("avatar", file);
    return apiClient.upload<AvatarResponse>("/profile/avatar", formData);
  },

  removeAvatar: () => apiClient.delete<AvatarResponse>("/profile/avatar"),
};
