import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";

interface AuthSidePanelFeature {
  icon: LucideIcon;
  label: string;
}

interface AuthSidePanelProps {
  title: string;
  description: string;
  features: AuthSidePanelFeature[];
  className?: string;
}

/**
 * Shared brand/context panel for the auth screens (login, register).
 * Hidden below the `lg` breakpoint — the form pages show a compact
 * logo instead.
 */
export function AuthSidePanel({ title, description, features, className }: AuthSidePanelProps) {
  return (
    <div
      className={cn(
        "relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-b from-secondary to-black text-secondary-foreground p-12",
        className,
      )}
    >
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cta/10 blur-[100px]" />

      <div className="relative inline-flex w-fit rounded-3xl  p-5 backdrop-blur-sm">
        <Logo variant="icon" theme="dark" className="h-60 w-auto" />
      </div>

      <div className="relative max-w-md space-y-10">
        <div>
          <h1 className="text-3xl font-bold leading-tight">{title}</h1>
          <p className="mt-3 text-sm text-secondary-foreground/70">{description}</p>
        </div>

        <ul className="flex flex-col gap-3">
          {features.map(({ icon: FeatureIcon, label }) => (
            <li
              key={label}
              className="flex items-center gap-3.5 rounded-2xl bg-white/[0.04] px-4 py-3.5 ring-1 ring-white/10"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cta/15">
                <FeatureIcon className="h-4 w-4 text-cta" strokeWidth={2} />
              </div>
              <span className="text-sm font-medium text-secondary-foreground/90">{label}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-secondary-foreground/50">
        &copy; {new Date().getFullYear()} DriveWell. Premium vehicle care, simplified.
      </p>
    </div>
  );
}
