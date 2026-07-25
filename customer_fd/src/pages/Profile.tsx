import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { authService } from "@/services/auth.service";
import { profileService } from "@/services/profile.service";
import { ASSET_BASE_URL } from "@/lib/apiClient";
import {
  changePasswordSchema,
  ChangePasswordFormData,
} from "@/lib/schemas/auth";
import { PasswordHint } from "@/components/auth/PasswordHint";
import { AvatarEditorDialog } from "@/components/AvatarEditorDialog";

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [editorImageSrc, setEditorImageSrc] = useState<string | null>(null);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);
  const [removeAvatarError, setRemoveAvatarError] = useState<string | null>(null);

  // Revoke the selected file's object URL once the editor is done with it, so
  // we don't leak memory across repeated avatar selections.
  useEffect(() => {
    return () => {
      if (editorImageSrc) URL.revokeObjectURL(editorImageSrc);
    };
  }, [editorImageSrc]);

  const handleChangeAvatarClick = () => avatarInputRef.current?.click();

  // Validated as soon as the file is picked — before the editor ever opens —
  // so the user finds out about a bad file immediately instead of after
  // cropping it and pressing save.
  const handleAvatarFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error("Please choose a JPEG, PNG, WEBP, or GIF image");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      toast.error("Image must be 2MB or smaller");
      return;
    }

    setEditorImageSrc(URL.createObjectURL(file));
  };

  const handleAvatarEditorSave = async (blob: Blob) => {
    const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    setIsSavingAvatar(true);
    try {
      const { profile } = await profileService.uploadAvatar(file);
      updateProfile({
        avatar: profile.avatar_url ? `${ASSET_BASE_URL}${profile.avatar_url}` : undefined,
      });
      toast.success("Avatar updated successfully!");
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleConfirmRemoveAvatar = async () => {
    setIsRemovingAvatar(true);
    setRemoveAvatarError(null);
    try {
      await profileService.removeAvatar();
      updateProfile({ avatar: undefined });
      toast.success("Avatar removed");
      setIsRemoveDialogOpen(false);
    } catch (error) {
      setRemoveAvatarError(
        error instanceof Error ? error.message : "Failed to remove avatar",
      );
    } finally {
      setIsRemovingAvatar(false);
    }
  };

  const {
    register: registerPasswordField,
    handleSubmit: handlePasswordSubmit,
    reset: resetPasswordForm,
    watch: watchPasswordField,
    formState: { errors: passwordErrors, isSubmitting: isChangingPassword },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  });
  const newPassword = watchPasswordField("newPassword", "");

  const onChangePassword = async (data: ChangePasswordFormData) => {
    try {
      await authService.changePassword(data.currentPassword, data.newPassword);
      toast.success("Password changed successfully!");
      resetPasswordForm();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to change password",
      );
    }
  };

  useEffect(() => {
    if (!user) {
      navigate("/login");
    } else {
      setFormData({
        name: user.name,
        email: user.email,
        phone: user.phone,
      });
    }
  }, [user, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(formData);
    toast.success("Profile updated successfully!");
  };

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your personal information and account security
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-4 text-center sm:flex-row sm:text-left">
            <div className="relative shrink-0">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="bg-cta text-cta-foreground text-2xl font-bold">
                  {user.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              {isSavingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60">
                  <Loader2 className="h-5 w-5 animate-spin text-foreground" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold truncate">{user.name}</p>
              <p className="text-sm text-muted-foreground truncate">
                {user.email}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <input
                ref={avatarInputRef}
                type="file"
                accept={ALLOWED_AVATAR_TYPES.join(",")}
                className="hidden"
                onChange={handleAvatarFileSelected}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleChangeAvatarClick}
                disabled={isSavingAvatar}
              >
                Change Avatar
              </Button>
              {user.avatar && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsRemoveDialogOpen(true)}
                  disabled={isSavingAvatar}
                >
                  Remove
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <AvatarEditorDialog
          imageSrc={editorImageSrc}
          onOpenChange={(open) => {
            if (!open) {
              if (editorImageSrc) URL.revokeObjectURL(editorImageSrc);
              setEditorImageSrc(null);
            }
          }}
          onSave={handleAvatarEditorSave}
        />

        <AlertDialog
          open={isRemoveDialogOpen}
          onOpenChange={(open) => {
            if (isRemovingAvatar) return;
            setIsRemoveDialogOpen(open);
            if (!open) setRemoveAvatarError(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove avatar?</AlertDialogTitle>
              <AlertDialogDescription>
                Your profile picture will be removed and you&apos;ll see your
                initials instead. This can&apos;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {removeAvatarError && (
              <p className="text-sm text-destructive">{removeAvatarError}</p>
            )}
            <AlertDialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsRemoveDialogOpen(false)}
                disabled={isRemovingAvatar}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmRemoveAvatar}
                disabled={isRemovingAvatar}
              >
                {isRemovingAvatar && <Loader2 className="h-4 w-4 animate-spin" />}
                {isRemovingAvatar ? "Removing..." : "Remove"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Personal Information</CardTitle>
              <CardDescription>
                Update your name and contact details
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <form
                onSubmit={handleSubmit}
                className="flex flex-1 flex-col space-y-3"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="mt-auto w-full bg-cta text-cta-foreground hover:bg-cta/90"
                >
                  Save Changes
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Change Password</CardTitle>
              <CardDescription>
                Choose a strong password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <form
                onSubmit={handlePasswordSubmit(onChangePassword)}
                className="flex flex-1 flex-col space-y-3"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrentPassword ? "text" : "password"}
                      className="pr-10"
                      {...registerPasswordField("currentPassword")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                      aria-label={
                        showCurrentPassword ? "Hide password" : "Show password"
                      }
                      tabIndex={-1}
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {passwordErrors.currentPassword && (
                    <p className="text-sm text-destructive">
                      {passwordErrors.currentPassword.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      className="pr-10"
                      {...registerPasswordField("newPassword")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                      aria-label={
                        showNewPassword ? "Hide password" : "Show password"
                      }
                      tabIndex={-1}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <PasswordHint password={newPassword} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmNewPassword ? "text" : "password"}
                      className="pr-10"
                      {...registerPasswordField("confirmNewPassword")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                      aria-label={
                        showConfirmNewPassword
                          ? "Hide password"
                          : "Show password"
                      }
                      tabIndex={-1}
                    >
                      {showConfirmNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {passwordErrors.confirmNewPassword && (
                    <p className="text-sm text-destructive">
                      {passwordErrors.confirmNewPassword.message}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  className="mt-auto w-full"
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? "Updating..." : "Update Password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
