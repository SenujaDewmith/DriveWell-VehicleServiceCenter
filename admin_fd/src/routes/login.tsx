import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { Role } from "@/data/dummyData";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const roles: { value: Role; label: string }[] = [
  { value: "manager", label: "Manager" },
  { value: "supervisor", label: "Supervisor" },
  { value: "cashier", label: "Cashier" },
  { value: "staff", label: "Service Staff" },
];

function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("manager");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    login(username || "Admin", role);
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md border-2 border-border bg-card p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tighter text-foreground">
            DRIVEWELL
          </h1>
          <p className="text-sm font-mono text-muted-foreground mt-1">
            SERVICE CENTER // ADMIN PORTAL
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-mono uppercase text-muted-foreground mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter any username"
              className="w-full border-2 border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-muted-foreground mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter any password"
              className="w-full border-2 border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-muted-foreground mb-2">
              Role
            </label>
            <div className="grid grid-cols-2 gap-2">
              {roles.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`border-2 px-3 py-2 text-xs font-mono uppercase transition-colors ${
                    role === r.value
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-background text-foreground hover:border-muted-foreground"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full border-2 border-accent bg-accent py-3 text-sm font-mono uppercase font-bold text-accent-foreground hover:opacity-90 transition-opacity"
          >
            ACCESS DASHBOARD →
          </button>
        </form>

        <p className="text-xs font-mono text-muted-foreground mt-6 text-center">
          ANY CREDENTIALS ACCEPTED // DEMO MODE
        </p>
      </div>
    </div>
  );
}
