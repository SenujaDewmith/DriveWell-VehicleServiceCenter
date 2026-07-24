import { createContext, useContext, useState, useEffect } from "react";
import { authService, ProfileResponse } from "@/services/auth.service";

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => void;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// The JWT lives in an httpOnly cookie, so the server is the only source of truth
// for whether a session is still valid — this maps its response into our User shape.
function mapProfileResponse({ user: u, profile }: ProfileResponse): User {
  return {
    id: String(u.user_id),
    name: profile?.full_name ?? "",
    email: u.email,
    phone: profile?.phone ?? "",
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Verify the session with the backend on load instead of trusting cached client
  // state — a stale cache would otherwise show a "logged in" UI for a session that
  // the server has since expired, revoked, or never issued in this browser.
  useEffect(() => {
    let cancelled = false;

    authService
      .getProfile()
      .then((data) => {
        if (!cancelled) setUser(mapProfileResponse(data));
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string, rememberMe = false) => {
    await authService.login(email, password, rememberMe);
    const profile = await authService.getProfile();
    setUser(mapProfileResponse(profile));
  };

  const register = async (data: RegisterData) => {
    await authService.register(data);
    await login(data.email, data.password);
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
    }
  };

  const updateProfile = (data: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...data });
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, updateProfile }}>
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
