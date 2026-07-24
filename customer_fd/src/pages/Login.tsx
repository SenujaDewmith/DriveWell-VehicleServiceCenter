import { useNavigate, Link } from "react-router-dom";
import { LoginForm } from "@/components/auth/LoginForm";
import { Calendar, Car, Clock, FileText } from "lucide-react";

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

          <LoginForm onSuccess={() => navigate("/dashboard")} />

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
