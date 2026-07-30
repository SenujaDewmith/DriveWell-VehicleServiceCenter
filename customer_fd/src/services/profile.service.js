import { apiClient } from "@/lib/apiClient";
export const profileService = {
    updateProfile: (data) => apiClient.put("/profile", data),
    uploadAvatar: (file) => {
        const formData = new FormData();
        formData.append("avatar", file);
        return apiClient.upload("/profile/avatar", formData);
    },
    removeAvatar: () => apiClient.delete("/profile/avatar"),
};
