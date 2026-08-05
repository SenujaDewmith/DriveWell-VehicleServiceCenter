import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { authService } from "@/services/auth.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { resetPasswordSchema } from "@/lib/schemas/auth";
import { PasswordHint } from "@/components/auth/PasswordHint";

export function ResetPasswordForm() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
        resolver: zodResolver(resetPasswordSchema),
    });
    const newPassword = watch("newPassword", "");
    const newPasswordField = register("newPassword");
    const confirmNewPasswordField = register("confirmNewPassword");
    const stripSpaces = (field) => (e) => {
        e.target.value = e.target.value.replace(/\s/g, "");
        field.onChange(e);
    };
    const blockSpaceKey = (e) => {
        if (e.key === " ") e.preventDefault();
    };
    const onSubmit = async (data) => {
        try {
            await authService.resetPassword(token, data.newPassword);
            toast.success("Password reset. Please sign in with your new password.");
            navigate("/login");
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to reset password");
        }
    };
    // No token in the URL — either a bad link or the user navigated here directly.
    if (!token) {
        return (<div className="space-y-3 text-center">
        <p className="text-sm text-muted-foreground">
          This password reset link is missing or invalid. Please request a new one.
        </p>
        <Link to="/forgot-password" className="text-sm font-medium text-cta hover:underline">
          Request a new link
        </Link>
      </div>);
    }
    return (<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="newPassword">New Password <span className="text-destructive">*</span></Label>
        <div className="relative">
          <Input id="newPassword" type={showPassword ? "text" : "password"} placeholder="••••••••" autoComplete="new-password" autoFocus className="pr-10" required aria-required="true" aria-invalid={!!errors.newPassword} {...newPasswordField} onChange={stripSpaces(newPasswordField)} onKeyDown={blockSpaceKey}/>
          <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground" aria-label={showPassword ? "Hide password" : "Show password"} tabIndex={-1}>
            {showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
          </button>
        </div>
        <PasswordHint password={newPassword}/>
        {errors.newPassword && (<p className="text-sm text-destructive" role="alert">{errors.newPassword.message}</p>)}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmNewPassword">Confirm New Password <span className="text-destructive">*</span></Label>
        <div className="relative">
          <Input id="confirmNewPassword" type={showConfirmPassword ? "text" : "password"} placeholder="••••••••" autoComplete="new-password" className="pr-10" required aria-required="true" aria-invalid={!!errors.confirmNewPassword} {...confirmNewPasswordField} onChange={stripSpaces(confirmNewPasswordField)} onKeyDown={blockSpaceKey}/>
          <button type="button" onClick={() => setShowConfirmPassword((prev) => !prev)} className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground" aria-label={showConfirmPassword ? "Hide password" : "Show password"} tabIndex={-1}>
            {showConfirmPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
          </button>
        </div>
        {errors.confirmNewPassword && (<p className="text-sm text-destructive" role="alert">{errors.confirmNewPassword.message}</p>)}
      </div>
      <Button type="submit" className="w-full bg-cta text-cta-foreground hover:bg-cta/90" disabled={isSubmitting}>
        {isSubmitting ? "Resetting..." : "Reset Password"}
      </Button>
    </form>);
}
