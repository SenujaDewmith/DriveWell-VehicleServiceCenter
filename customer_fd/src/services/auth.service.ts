import { apiClient } from "@/lib/apiClient";

export interface LoginResponse {
  user: { id: number; email: string };
}

export interface ProfileResponse {
  user: { user_id: number; email: string; role_id: number; account_status: string };
  profile: { full_name: string; phone: string | null; address: string | null } | null;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export const authService = {
  login: (email: string, password: string, rememberMe = false) =>
    apiClient.post<LoginResponse>("/auth/login", { email, password, rememberMe }),

  register: (data: RegisterPayload) =>
    apiClient.post<LoginResponse>("/auth/register", data),

  logout: () => apiClient.post<void>("/auth/logout", {}),

  getProfile: () => apiClient.get<ProfileResponse>("/auth/profile"),
};
