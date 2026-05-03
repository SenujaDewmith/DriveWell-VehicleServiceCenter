import { apiClient } from "@/lib/apiClient";

export interface LoginResponse {
  user: { id: number; email: string };
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export const authService = {
  login: (email: string, password: string) =>
    apiClient.post<LoginResponse>("/auth/login", { email, password }),

  register: (data: RegisterPayload) =>
    apiClient.post<LoginResponse>("/auth/register", data),

  logout: () => apiClient.post<void>("/auth/logout", {}),
};
