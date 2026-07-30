import { cn } from "@/lib/utils";
import logoFull from "@/assets/logo/logo-full.png";
import logoFullDark from "@/assets/logo/logo-full-dark.png";
import logoIcon from "@/assets/logo/logo-icon.png";
import logoIconDark from "@/assets/logo/logo-icon-dark.png";
export function Logo({ variant = "full", theme = "auto", className, alt = "DriveWell" }) {
    const light = variant === "icon" ? logoIcon : logoFull;
    const dark = variant === "icon" ? logoIconDark : logoFullDark;
    // self-start + shrink-0: without these, an <img> sized only by height
    // (w-auto) gets stretched full-width by flex/grid containers that don't
    // explicitly set align-items, silently distorting the aspect ratio.
    const base = "h-8 w-auto self-start shrink-0";
    if (theme === "light") {
        return <img src={light} alt={alt} className={cn(base, className)}/>;
    }
    if (theme === "dark") {
        return <img src={dark} alt={alt} className={cn(base, className)}/>;
    }
    return (<>
      <img src={light} alt={alt} className={cn(base, "block dark:hidden", className)}/>
      <img src={dark} alt={alt} className={cn(base, "hidden dark:block", className)}/>
    </>);
}
