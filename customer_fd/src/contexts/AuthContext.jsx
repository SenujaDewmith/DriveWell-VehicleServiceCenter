import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authService } from "@/services/auth.service";
import { ASSET_BASE_URL, SESSION_EXPIRED_EVENT } from "@/lib/apiClient";
const AuthContext = createContext(undefined);
// The JWT lives in an httpOnly cookie, so the server is the only source of truth
// for whether a session is still valid — this maps its response into our User shape.
function mapProfileResponse({ user: u, profile }) {
    return {
        id: String(u.user_id),
        name: profile?.full_name ?? "",
        email: u.email,
        phone: profile?.phone ?? "",
        secondaryPhone: profile?.secondary_phone ?? "",
        avatar: profile?.avatar_url ? `${ASSET_BASE_URL}${profile.avatar_url}` : undefined,
    };
}
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const clearUser = useCallback(() => {
        setUser(null);
    }, []);
    // Verify the session with the backend on load instead of trusting cached client
    // state — a stale cache would otherwise show a "logged in" UI for a session that
    // the server has since expired, revoked, or never issued in this browser.
    useEffect(() => {
        let cancelled = false;
        authService
            .getProfile()
            .then((data) => {
            if (!cancelled)
                setUser(mapProfileResponse(data));
        })
            .catch(() => {
            if (!cancelled)
                setUser(null);
        })
            .finally(() => {
            if (!cancelled)
                setIsLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    // A 401 mid-session (expired/invalid cookie) means the server no longer
    // considers us logged in — drop the stale user state so ProtectedRoute
    // redirects to /login instead of leaving a broken "logged in" UI up.
    useEffect(() => {
        window.addEventListener(SESSION_EXPIRED_EVENT, clearUser);
        return () => window.removeEventListener(SESSION_EXPIRED_EVENT, clearUser);
    }, [clearUser]);
    const login = async (email, password, rememberMe = false) => {
        await authService.login(email, password, rememberMe);
        const profile = await authService.getProfile();
        setUser(mapProfileResponse(profile));
    };
    const register = async (data) => {
        await authService.register(data);
        await login(data.email, data.password);
    };
    const logout = async () => {
        try {
            await authService.logout();
        }
        finally {
            clearUser();
        }
    };
    const updateProfile = (data) => {
        if (user) {
            setUser({ ...user, ...data });
        }
    };
    return (<AuthContext.Provider value={{ user, isLoading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>);
}
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return context;
}
