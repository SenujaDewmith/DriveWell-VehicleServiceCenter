import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calendar, Car, Clock, Eye, EyeOff, FileText } from "lucide-react";
import { loginSchema, LoginFormData } from "@/lib/schemas/auth";

const BENEFITS = [
  {
    icon: Calendar,
    title: "Book in seconds",
    description: "Pick a service package and a time slot that suits you",
  },
  {
    icon: Clock,
    title: "Track in real time",
    description: "Follow your vehicle's service progress as it happens",
  },
  {
    icon: FileText,
    title: "Everything on record",
    description: "Digital invoices and full service history, always available",
  },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  // rememberMe is a simple boolean toggle — no Zod validation needed
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password, rememberMe);
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    }
  };

  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      {/* Brand / context panel — hidden on small screens */}
      <div className="hidden lg:flex flex-col justify-between bg-secondary text-secondary-foreground p-12">
        <div className="flex items-center gap-2">
          <Car className="h-8 w-8 text-cta" />
          <span className="text-2xl font-bold">DriveWell</span>
        </div>

        <div className="max-w-md space-y-8">
          <div>
            <h1 className="text-3xl font-bold leading-tight">
              Welcome back to your vehicle's home
            </h1>
            <p className="mt-3 text-sm text-secondary-foreground/80">
              Sign in to manage bookings, track ongoing services, and keep your
              vehicle's full history in one place.
            </p>
          </div>

          <ul className="space-y-5">
            {BENEFITS.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cta/15">
                  <Icon className="h-5 w-5 text-cta" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-sm text-secondary-foreground/70">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-secondary-foreground/60">
          &copy; {new Date().getFullYear()} DriveWell. Premium vehicle care, simplified.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-muted/30 px-4 py-12">
        <div className="w-full max-w-sm">
          {/* Compact brand for small screens where the side panel is hidden */}
          <div className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <Car className="h-7 w-7 text-cta" />
            <span className="text-2xl font-bold text-foreground">DriveWell</span>
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-foreground">Sign in to your account</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Access your dashboard, bookings, and service history
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                autoComplete="email"
                autoFocus
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pr-10"
                  {...register("password")}
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
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
              <a href="#" className="text-cta hover:underline">
                Forgot password?
              </a>
            </div>
            <Button
              type="submit"
              className="w-full bg-cta text-cta-foreground hover:bg-cta/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            New to DriveWell?{" "}
            <Link to="/register" className="text-cta hover:underline font-medium">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
