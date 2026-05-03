import { createContext, useContext, useState, type ReactNode } from "react";
import type { Role } from "@/data/dummyData";

interface AuthState {
  isAuthenticated: boolean;
  username: string;
  role: Role;
}

interface AuthContextType extends AuthState {
  login: (username: string, role: Role) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    username: "",
    role: "manager",
  });

  const login = (username: string, role: Role) => {
    setAuth({ isAuthenticated: true, username, role });
  };

  const logout = () => {
    setAuth({ isAuthenticated: false, username: "", role: "manager" });
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
