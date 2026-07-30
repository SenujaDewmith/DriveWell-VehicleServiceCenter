import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegisterForm } from "@/components/auth/RegisterForm";
const COPY = {
    login: {
        title: "Sign in to continue",
        description: "Sign in to your account to pick up right where you left off.",
    },
    register: {
        title: "Create your account",
        description: "Join DriveWell to book and track your vehicle services online.",
    },
};
export function AuthModal({ open, onOpenChange, onSuccess, defaultMode = "login", title, description }) {
    const [mode, setMode] = useState(defaultMode);
    // Reset back to the default mode each time the modal is reopened, so it
    // doesn't reopen mid-flow on a stale "register" view from a prior visit.
    const handleOpenChange = (next) => {
        if (next)
            setMode(defaultMode);
        onOpenChange(next);
    };
    return (<Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title ?? COPY[mode].title}</DialogTitle>
          <DialogDescription>{description ?? COPY[mode].description}</DialogDescription>
        </DialogHeader>

        {mode === "login" ? (<LoginForm onSuccess={onSuccess} onSwitchToRegister={() => setMode("register")}/>) : (<RegisterForm onSuccess={onSuccess} onSwitchToLogin={() => setMode("login")}/>)}
      </DialogContent>
    </Dialog>);
}
