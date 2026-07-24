import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Car,
  ClipboardList,
  Eye,
  EyeOff,
  Receipt,
  ShieldCheck,
  UserCog,
  Wrench,
} from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const ROLES = [
  {
    icon: UserCog,
    title: "Manager",
    description: "Oversee operations, staff, and business reports",
  },
  {
    icon: ClipboardList,
    title: "Supervisor",
    description: "Assign jobs and track service progress",
  },
  {
    icon: Receipt,
    title: "Cashier",
    description: "Handle invoices and customer payments",
  },
  {
    icon: Wrench,
    title: "Staff",
    description: "View assigned jobs and update work status",
  },
];

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Brand / context panel — hidden on small screens */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-secondary text-secondary-foreground p-12">
        <div className="flex items-center gap-2">
          <Car className="h-8 w-8 text-accent" />
          <span className="text-2xl font-bold">DriveWell</span>
        </div>

        <div className="space-y-8 max-w-md">
          <div>
            <h1 className="text-3xl font-bold leading-tight">
              Service Center Admin Portal
            </h1>
            <p className="mt-3 text-sm text-secondary-foreground/80">
              One place for the whole team to run daily operations — bookings,
              job assignments, invoicing, and reporting.
            </p>
          </div>

          <ul className="space-y-5">
            {ROLES.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/15">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-sm text-secondary-foreground/70">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-secondary-foreground/60">
          &copy; {new Date().getFullYear()} DriveWell. Internal use only.
        </p>
      </div>

      {/* Form panel */}
      <div className="relative flex w-full lg:w-1/2 items-center justify-center p-4">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm">
          {/* Compact brand for small screens where the side panel is hidden */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <Car className="h-7 w-7 text-accent" />
            <span className="text-2xl font-bold text-foreground">DriveWell</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your staff credentials to access the dashboard
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="manager@drivewell.com"
                autoComplete="email"
                autoFocus
                required
                className="w-full border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full border border-border rounded-md bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-accent py-3 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-8 flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Restricted to authorized DriveWell staff. Accounts are created by
              a manager — contact yours if you can't sign in.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
