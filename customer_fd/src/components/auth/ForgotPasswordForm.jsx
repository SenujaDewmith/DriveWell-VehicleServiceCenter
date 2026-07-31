import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { authService } from "@/services/auth.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, ArrowLeft } from "lucide-react";
import { forgotPasswordSchema } from "@/lib/schemas/auth";

export function ForgotPasswordForm() {
    const [submittedEmail, setSubmittedEmail] = useState(null);
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
        resolver: zodResolver(forgotPasswordSchema),
    });
    const onSubmit = async (data) => {
        try {
            await authService.forgotPassword(data.email);
            // The backend always replies 200 here regardless of whether the email is
            // registered, so a thrown error means the request itself failed
            // (network, rate limit) — safe to surface, unlike "email not found".
            setSubmittedEmail(data.email);
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Something went wrong. Please try again.");
        }
    };
    if (submittedEmail) {
        return (<div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cta/10">
          <Mail className="h-6 w-6 text-cta"/>
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Check your email</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            If an account exists for <span className="font-medium text-foreground">{submittedEmail}</span>, we've sent a link to reset your password. The link expires in 30 minutes.
          </p>
        </div>
        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-cta hover:underline">
          <ArrowLeft className="h-3.5 w-3.5"/>
          Back to sign in
        </Link>
      </div>);
    }
    return (<div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="john@example.com" autoComplete="email" autoFocus {...register("email")}/>
          {errors.email && (<p className="text-sm text-destructive">{errors.email.message}</p>)}
        </div>
        <Button type="submit" className="w-full bg-cta text-cta-foreground hover:bg-cta/90" disabled={isSubmitting}>
          {isSubmitting ? "Sending..." : "Send reset link"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-cta hover:underline font-medium">
          <ArrowLeft className="h-3.5 w-3.5"/>
          Back to sign in
        </Link>
      </p>
    </div>);
}
