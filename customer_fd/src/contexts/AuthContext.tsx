import { createContext, useContext, useState, useEffect } from "react";
import { authService } from "@/services/auth.service";

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("drivewell-user");
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem("drivewell-user", JSON.stringify(user));
    } else {
      localStorage.removeItem("drivewell-user");
    }
  }, [user]);

  const login = async (email: string, password: string) => {
    const data = await authService.login(email, password);
    setUser({
      id: data.user.id.toString(),
      name: "",
      email: data.user.email,
      phone: "",
    });
  };

  const register = async (data: RegisterData) => {
    await authService.register(data);
    await login(data.email, data.password);
  };

  const logout = () => {
    setUser(null);
  };

  const updateProfile = (data: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...data });
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
