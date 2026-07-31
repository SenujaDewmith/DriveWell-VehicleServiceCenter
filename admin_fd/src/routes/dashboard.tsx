import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";

export function DashboardRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  // Wait for the session check against the backend to finish before deciding
  // — otherwise a logged-in user doing a hard refresh gets bounced to /login
  // for a frame while the cookie is still being verified.
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" />;

  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}
