import { useNavigate, Link } from "react-router-dom";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { Calendar, Car, Shield, Star } from "lucide-react";

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
  const navigate = useNavigate();

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

          <RegisterForm onSuccess={() => navigate("/dashboard")} />

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
