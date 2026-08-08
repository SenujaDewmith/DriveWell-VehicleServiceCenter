import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getDefaultSidebarCollapsed } from "@/hooks/use-sidebar-breakpoint";
import { cn } from "@/lib/utils";
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
  ArrowLeftRight,
  Car,
  Contact,
  MessageSquare,
  History,
  ChevronsLeft,
  ChevronsRight,
  Settings,
} from "lucide-react";
import { Logo } from "@/components/Logo";

const managerNav = [
  { label: "Overview", to: "/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: "All Bookings", to: "/dashboard/bookings", icon: <BookOpen className="h-4 w-4" /> },
  { label: "Service Packages", to: "/dashboard/packages", icon: <Package className="h-4 w-4" /> },
  { label: "Feedback", to: "/dashboard/feedback", icon: <MessageSquare className="h-4 w-4" /> },
  {
    label: "Charge Catalog",
    to: "/dashboard/charge-catalog",
    icon: <Wrench className="h-4 w-4" />,
  },
  { label: "Schedule Config", to: "/dashboard/schedule", icon: <Calendar className="h-4 w-4" /> },
  { label: "Staff Management", to: "/dashboard/users", icon: <Users className="h-4 w-4" /> },
  {
    label: "Customer Management",
    to: "/dashboard/customers",
    icon: <Contact className="h-4 w-4" />,
  },
  {
    label: "Vehicle Transfers",
    to: "/dashboard/vehicle-transfers",
    icon: <ArrowLeftRight className="h-4 w-4" />,
  },
  { label: "Vehicle Catalog", to: "/dashboard/vehicle-catalog", icon: <Car className="h-4 w-4" /> },
  {
    label: "Vehicle History",
    to: "/dashboard/vehicle-history",
    icon: <History className="h-4 w-4" />,
  },

  { label: "Revenue Reports", to: "/dashboard/revenue", icon: <DollarSign className="h-4 w-4" /> },
  { label: "Service Volume", to: "/dashboard/volume", icon: <BarChart3 className="h-4 w-4" /> },
  {
    label: "Staff Performance",
    to: "/dashboard/performance",
    icon: <UserCheck className="h-4 w-4" />,
  },
  { label: "Activity Log", to: "/dashboard/activity", icon: <Activity className="h-4 w-4" /> },
  { label: "Business Settings", to: "/dashboard/settings", icon: <Settings className="h-4 w-4" /> },
];

const supervisorNav = [
  { label: "Overview", to: "/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "All Bookings", to: "/dashboard/bookings", icon: <BookOpen className="h-4 w-4" /> },
  {
    label: "Vehicle History",
    to: "/dashboard/vehicle-history",
    icon: <History className="h-4 w-4" />,
  },
  { label: "Feedback", to: "/dashboard/feedback", icon: <MessageSquare className="h-4 w-4" /> },
  {
    label: "Slot Availability",
    to: "/dashboard/slot-availability",
    icon: <Calendar className="h-4 w-4" />,
  },
  {
    // Read-only for supervisors — the page itself hides Add/Edit/Activate based on role.
    label: "Customer Management",
    to: "/dashboard/customers",
    icon: <Contact className="h-4 w-4" />,
  },
];

export function DashboardLayout({ children }) {
  const { username, role, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(getDefaultSidebarCollapsed);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isManager = role === "manager";
  const isSupervisor = role === "supervisor";
  const hasSidebar = isManager || isSupervisor;
  const navItems = isManager ? managerNav : isSupervisor ? supervisorNav : [];

  const confirmLogout = async () => {
    setLoggingOut(true);
    await logout();
    window.location.href = "/login";
  };

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Sidebar - manager and supervisor only */}
      {hasSidebar && (
        <>
          {/* Mobile overlay - only below md, since md+ shows the sidebar in normal flow */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          <aside
            className={cn(
              "fixed md:static z-50 h-screen w-64 border-r border-border bg-card flex flex-col transition-[transform,width] duration-200 md:translate-x-0",
              sidebarOpen ? "translate-x-0" : "-translate-x-full",
              collapsed ? "md:w-16" : "md:w-64",
            )}
          >
            <div
              className={cn(
                "flex items-center border-b border-border p-4",
                collapsed ? "md:justify-center md:px-2" : "justify-between",
              )}
            >
              <div className={cn(collapsed && "md:hidden")}>
                <Logo className="h-8" />
                <p className="text-xs text-muted-foreground mt-2">{role} Panel</p>
              </div>
              {collapsed && (
                <div className="hidden md:block">
                  <Logo variant="icon" className="h-8" alt="DriveWell" />
                </div>
              )}
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="hidden shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground md:inline-flex"
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? (
                  <ChevronsRight className="h-4 w-4" />
                ) : (
                  <ChevronsLeft className="h-4 w-4" />
                )}
              </button>
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
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      collapsed && "md:justify-center md:px-0",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {item.icon}
                    <span className={cn(collapsed && "md:hidden")}>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <header className="h-16 shrink-0 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 flex items-center justify-between px-3 sm:px-4">
          <div className="flex items-center gap-3 min-w-0">
            {hasSidebar && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-1 text-foreground shrink-0"
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            )}
            {!hasSidebar && (
              <div className="flex items-center gap-2 min-w-0">
                <Logo className="h-7 shrink-0" />
                <span className="text-sm text-muted-foreground truncate">// {role}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="hidden sm:inline text-sm text-muted-foreground">{username}</span>
            <ThemeToggle />
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 min-h-0 p-4 md:p-5 lg:p-6 overflow-auto">{children}</main>
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
