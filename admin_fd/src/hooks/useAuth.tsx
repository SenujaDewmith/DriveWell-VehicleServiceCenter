import { createContext, useContext, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

export type Role = "manager" | "supervisor" | "cashier" | "staff";

const ROLE_MAP: Record<number, Role> = {
  1: "manager",
  2: "supervisor",
  3: "cashier",
  4: "staff",
};

interface AuthState {
  isAuthenticated: boolean;
  username: string;
  email: string;
  userId: number | null;
  role: Role;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const STORAGE_KEY = "drivewell_auth";

function loadAuth(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AuthState;
  } catch {
    // ignore corrupt storage
  }
  return { isAuthenticated: false, username: "", email: "", userId: null, role: "manager" };
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(loadAuth);

  const login = async (email: string, password: string) => {
    const data = await api.post<{ user: { id: number; email: string; role_id: number } }>(
      "/api/auth/staff/login",
      { email, password },
    );
    const role = ROLE_MAP[data.user.role_id] ?? "staff";
    const next: AuthState = {
      isAuthenticated: true,
      username: data.user.email.split("@")[0],
      email: data.user.email,
      userId: data.user.id,
      role,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setAuth(next);
  };

  const logout = async () => {
    await api.post("/api/auth/logout", {}).catch(() => {});
    localStorage.removeItem(STORAGE_KEY);
    setAuth({ isAuthenticated: false, username: "", email: "", userId: null, role: "manager" });
  };

  return (
    <AuthContext.Provider value={{ ...auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
