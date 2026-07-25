import { apiClient } from "@/lib/apiClient";

export interface ProfileData {
  user_id: number;
  full_name: string;
  phone: string | null;
  secondary_phone: string | null;
  address: string | null;
  avatar_url: string | null;
}

export interface UpdateProfileResponse {
  message: string;
  profile: ProfileData;
}

export type UpdateProfilePayload = Partial<{
  full_name: string;
  phone: string;
  secondary_phone: string;
  address: string;
}>;

export interface AvatarResponse {
  message: string;
  profile: { avatar_url: string | null };
}

export const profileService = {
  updateProfile: (data: UpdateProfilePayload) =>
    apiClient.put<UpdateProfileResponse>("/profile", data),

  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append("avatar", file);
    return apiClient.upload<AvatarResponse>("/profile/avatar", formData);
  },

  removeAvatar: () => apiClient.delete<AvatarResponse>("/profile/avatar"),
};
