import { apiClient } from "@/lib/apiClient";
export const authService = {
    login: (email, password, rememberMe = false) => apiClient.post("/auth/login", { email, password, rememberMe }),
    register: (data) => apiClient.post("/auth/register", data),
    logout: () => apiClient.post("/auth/logout", {}),
    getProfile: () => apiClient.get("/auth/profile"),
    changePassword: (currentPassword, newPassword) => apiClient.put("/profile/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
    }),
};
