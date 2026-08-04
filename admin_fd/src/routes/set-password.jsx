import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/api";

export function SetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/auth/reset-password", { token, new_password: newPassword });
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo className="h-8" />
        </div>

        {!token ? (
          <div className="text-center space-y-3">
            <h2 className="text-xl font-bold text-foreground">Invalid link</h2>
            <p className="text-sm text-muted-foreground">
              This link is missing its token. Check the URL from your email, or ask your manager to
              send a new invite.
            </p>
          </div>
        ) : done ? (
          <div className="text-center space-y-3">
            <h2 className="text-xl font-bold text-foreground">Password set</h2>
            <p className="text-sm text-muted-foreground">
              Your account is now active. Redirecting to sign in...
            </p>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground">Set your password</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a password to activate your DriveWell staff account.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="new_password"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  New password
                </label>
                <div className="relative">
                  <input
                    id="new_password"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    autoFocus
                    required
                    className="w-full border border-border rounded-md bg-background px-3 py-2 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  8-64 characters, with an uppercase and lowercase letter, a number, and a special
                  character.
                </p>
              </div>

              <div>
                <label
                  htmlFor="confirm_password"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Confirm password
                </label>
                <input
                  id="confirm_password"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="w-full border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
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
                {loading ? "Setting password..." : "Set password & activate account"}
              </button>
            </form>
          </>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          <Link to="/login" className="hover:text-foreground">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
