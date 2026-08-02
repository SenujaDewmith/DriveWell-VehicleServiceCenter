import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toPhoneDigits, joinPhoneNo } from "@/lib/phoneNumber";
export function PhoneNumberInput({ id, value, onChange, onBlur, error, disabled, placeholder = "771234567" }) {
    const digits = toPhoneDigits(value);
    return (<div className={cn("flex h-10 items-center gap-1.5 rounded-md border border-input bg-background pl-3 focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background", error && "border-destructive")}>
      <span aria-hidden className="shrink-0 text-sm font-medium text-muted-foreground">+94</span>
      <Input id={id} value={digits} onChange={(e) => onChange(joinPhoneNo(toPhoneDigits(e.target.value)))} onBlur={onBlur} placeholder={placeholder} maxLength={9} inputMode="numeric" autoComplete="off" spellCheck={false} disabled={disabled} aria-invalid={error} aria-label="Phone number" className="h-full border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"/>
    </div>);
}
