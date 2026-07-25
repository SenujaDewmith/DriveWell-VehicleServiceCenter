import { useNavigate, Link } from "react-router-dom";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthSidePanel } from "@/components/auth/AuthSidePanel";
import { Calendar, Clock, FileText } from "lucide-react";
import { Logo } from "@/components/Logo";

const FEATURES = [
  { icon: Calendar, label: "Book a service in seconds" },
  { icon: Clock, label: "Track progress in real time" },
  { icon: FileText, label: "Digital invoices, always on record" },
];

export default function Login() {
  const navigate = useNavigate();

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <AuthSidePanel
        title="Welcome back to your vehicle's home"
        description="Sign in to manage bookings, track ongoing services, and keep your vehicle's full history in one place."
        features={FEATURES}
      />

      {/* Form panel */}
      <div className="flex items-center justify-center bg-muted/30 px-4 py-12">
        <div className="w-full max-w-sm">
          {/* Compact brand for small screens where the side panel is hidden */}
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo className="h-44" />
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
