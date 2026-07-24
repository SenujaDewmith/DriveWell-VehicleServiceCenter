import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calendar, Car, Eye, EyeOff, Shield, Star } from "lucide-react";
import { registerSchema, RegisterFormData } from "@/lib/schemas/auth";

const BENEFITS = [
  {
    icon: Car,
    title: "All your vehicles, one place",
    description: "Add your vehicles once and manage every service from your dashboard",
  },
  {
    icon: Calendar,
    title: "Online booking, anytime",
    description: "Reserve a service slot in seconds — no phone calls needed",
  },
  {
    icon: Shield,
    title: "Transparent pricing",
    description: "Know the cost upfront, with digital invoices for every job",
  },
  {
    icon: Star,
    title: "Your feedback matters",
    description: "Rate every service and help us keep quality high",
  },
];

export default function Register() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await registerUser({ name: data.name, email: data.email, password: data.password });
      toast.success("Account created successfully!");
      navigate("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed");
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
              Vehicle care without the hassle
            </h1>
            <p className="mt-3 text-sm text-secondary-foreground/80">
              Create a free account and take control of your vehicle's
              maintenance — from booking to invoice.
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
            <h2 className="text-2xl font-bold text-foreground">Create your account</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Join DriveWell to book and track your vehicle services online
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                autoComplete="name"
                autoFocus
                {...register("name")}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                autoComplete="email"
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
                  autoComplete="new-password"
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
              {errors.password ? (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  At least 8 characters, with uppercase, lowercase, a number, and a special character. No spaces.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="pr-10"
                  {...register("confirmPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full bg-cta text-cta-foreground hover:bg-cta/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-cta hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
