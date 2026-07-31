import { useNavigate, Link } from "react-router-dom";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { AuthSidePanel } from "@/components/auth/AuthSidePanel";
import { HomeButton } from "@/components/auth/HomeButton";
import { Car, Calendar, Shield, Star } from "lucide-react";
import { Logo } from "@/components/Logo";
const FEATURES = [
    { icon: Car, label: "All your vehicles, one place" },
    { icon: Calendar, label: "Online booking, anytime" },
    { icon: Shield, label: "Transparent, upfront pricing" },
    { icon: Star, label: "Rate every service you get" },
];
export default function Register() {
    const navigate = useNavigate();
    return (<div className="grid min-h-screen lg:grid-cols-2">
      <AuthSidePanel title="Vehicle care without the hassle" description="Create a free account and take control of your vehicle's maintenance — from booking to invoice." features={FEATURES}/>

      {/* Form panel */}
      <div className="relative flex items-center justify-center bg-muted/30 px-4 py-12">
        <HomeButton />
        <div className="w-full max-w-sm">
          {/* Compact brand for small screens where the side panel is hidden */}
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo className="h-8"/>
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-foreground">Create your account</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Join DriveWell to book and track your vehicle services online
            </p>
          </div>

          <RegisterForm onSuccess={() => navigate("/dashboard")}/>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-cta hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>);
}
