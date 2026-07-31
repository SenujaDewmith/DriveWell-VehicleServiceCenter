import { AuthSidePanel } from "@/components/auth/AuthSidePanel";
import { HomeButton } from "@/components/auth/HomeButton";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { Calendar, Clock, FileText } from "lucide-react";
import { Logo } from "@/components/Logo";
const FEATURES = [
    { icon: Calendar, label: "Book a service in seconds" },
    { icon: Clock, label: "Track progress in real time" },
    { icon: FileText, label: "Digital invoices, always on record" },
];
export default function ForgotPassword() {
    return (<div className="grid min-h-screen lg:grid-cols-2">
      <AuthSidePanel title="Forgot your password?" description="No worries — enter your email and we'll send you a link to get back into your account." features={FEATURES}/>

      {/* Form panel */}
      <div className="relative flex items-center justify-center bg-muted/30 px-4 py-12">
        <HomeButton />
        <div className="w-full max-w-sm">
          {/* Compact brand for small screens where the side panel is hidden */}
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo className="h-8"/>
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-foreground">Reset your password</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter the email associated with your account
            </p>
          </div>

          <ForgotPasswordForm />
        </div>
      </div>
    </div>);
}
