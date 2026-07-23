import { type ReactNode, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  LayoutDashboard,
  Package,
  Calendar,
  Users,
  BookOpen,
  DollarSign,
  BarChart3,
  UserCheck,
  Activity,
  LogOut,
  Menu,
  X,
  Wrench,
  Car,
} from "lucide-react";

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
}

const managerNav: NavItem[] = [
  { label: "Overview", to: "/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "Service Packages", to: "/dashboard/packages", icon: <Package className="h-4 w-4" /> },
  { label: "Charge Catalog", to: "/dashboard/charge-catalog", icon: <Wrench className="h-4 w-4" /> },
  { label: "Schedule Config", to: "/dashboard/schedule", icon: <Calendar className="h-4 w-4" /> },
  { label: "Staff Management", to: "/dashboard/users", icon: <Users className="h-4 w-4" /> },
  { label: "All Bookings", to: "/dashboard/bookings", icon: <BookOpen className="h-4 w-4" /> },
  { label: "Revenue Reports", to: "/dashboard/revenue", icon: <DollarSign className="h-4 w-4" /> },
  { label: "Service Volume", to: "/dashboard/volume", icon: <BarChart3 className="h-4 w-4" /> },
  { label: "Staff Performance", to: "/dashboard/performance", icon: <UserCheck className="h-4 w-4" /> },
  { label: "Activity Log", to: "/dashboard/activity", icon: <Activity className="h-4 w-4" /> },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { username, role, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isManager = role === "manager";
  const navItems = isManager ? managerNav : [];

  const confirmLogout = async () => {
    setLoggingOut(true);
    await logout();
    window.location.href = "/login";
  };

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Sidebar - only for manager */}
      {isManager && (
        <>
          {/* Mobile overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          <aside
            className={`fixed lg:static z-50 h-screen w-64 border-r border-border bg-card flex flex-col transition-transform lg:translate-x-0 ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Car className="h-6 w-6 text-accent" />
                <h2 className="text-xl font-bold text-foreground">DriveWell</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {role} Panel
              </p>
            </div>

            <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
              {navItems.map((item) => {
                const isActive =
                  item.to === "/dashboard"
                    ? location.pathname === "/dashboard"
                    : location.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0">
        <header className="h-16 shrink-0 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {isManager && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-1 text-foreground"
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            )}
            {!isManager && (
              <div className="flex items-center gap-2">
                <Car className="h-6 w-6 text-accent" />
                <h2 className="text-lg font-bold text-foreground">
                  DriveWell <span className="text-muted-foreground font-normal">// {role}</span>
                </h2>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {username}
            </span>
            <ThemeToggle />
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="p-2 rounded-md border border-border bg-card text-foreground hover:bg-muted transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 min-h-0 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>

      {showLogoutConfirm && (
        <div
          className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4"
          onClick={() => !loggingOut && setShowLogoutConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-border bg-card p-4 space-y-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-foreground">Log out?</h3>
            <p className="text-sm text-muted-foreground">Are you sure you want to log out?</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                disabled={loggingOut}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                disabled={loggingOut}
                className="flex items-center gap-2 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                {loggingOut ? "Logging out..." : "Log Out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
