import { createContext, useContext, useEffect, useState } from "react";
import { api, SESSION_EXPIRED_EVENT } from "@/lib/api";

const ROLE_MAP = {
  1: "manager",
  2: "supervisor",
  3: "cashier",
  4: "staff",
};

const LOGGED_OUT = {
  isAuthenticated: false,
  username: "",
  email: "",
  userId: null,
  role: "manager",
};

function toAuthState(user) {
  return {
    isAuthenticated: true,
    username: user.email.split("@")[0],
    email: user.email,
    userId: user.user_id,
    role: ROLE_MAP[user.role_id] ?? "staff",
  };
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(LOGGED_OUT);
  const [isLoading, setIsLoading] = useState(true);

  // The JWT lives in an httpOnly cookie, so the server is the only source of
  // truth for whether a staff session is still valid — verify against it on
  // load instead of trusting a cached flag (which could outlive an expired
  // or cleared cookie and show a "logged in" dashboard shell for no session).
  useEffect(() => {
    let cancelled = false;

    api
      .get("/api/auth/profile")
      .then((data) => {
        if (!cancelled) setAuth(toAuthState(data.user));
      })
      .catch(() => {
        if (!cancelled) setAuth(LOGGED_OUT);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // A 401 mid-session means the server no longer considers this session
  // valid — drop local state so the dashboard route guard redirects to /login.
  useEffect(() => {
    const handleSessionExpired = () => setAuth(LOGGED_OUT);
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  const login = async (email, password) => {
    const data = await api.post("/api/auth/staff/login", { email, password });
    setAuth(
      toAuthState({ user_id: data.user.id, email: data.user.email, role_id: data.user.role_id }),
    );
  };

  const logout = async () => {
    try {
      await api.post("/api/auth/staff/logout", {});
    } finally {
      setAuth(LOGGED_OUT);
    }
  };

  return (
    <AuthContext.Provider value={{ ...auth, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
