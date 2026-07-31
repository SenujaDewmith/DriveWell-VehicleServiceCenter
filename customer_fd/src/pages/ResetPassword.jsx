import { AuthSidePanel } from "@/components/auth/AuthSidePanel";
import { HomeButton } from "@/components/auth/HomeButton";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { Calendar, Clock, FileText } from "lucide-react";
import { Logo } from "@/components/Logo";
const FEATURES = [
    { icon: Calendar, label: "Book a service in seconds" },
    { icon: Clock, label: "Track progress in real time" },
    { icon: FileText, label: "Digital invoices, always on record" },
];
export default function ResetPassword() {
    return (<div className="grid min-h-screen lg:grid-cols-2">
      <AuthSidePanel title="Choose a new password" description="Pick a strong password you haven't used before to keep your account secure." features={FEATURES}/>

      {/* Form panel */}
      <div className="relative flex items-center justify-center bg-muted/30 px-4 py-12">
        <HomeButton />
        <div className="w-full max-w-sm">
          {/* Compact brand for small screens where the side panel is hidden */}
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo className="h-8"/>
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-foreground">Set a new password</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your new password must be different from previous ones
            </p>
          </div>

          <ResetPasswordForm />
        </div>
      </div>
    </div>);
}
