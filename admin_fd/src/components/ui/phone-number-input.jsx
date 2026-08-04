import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toPhoneDigits, joinPhoneNo } from "@/lib/phoneNumber";

// Mirrors customer_fd/src/components/ui/phone-number-input.jsx — the "+94" prefix is a
// locked label, not typed, so the stored value is always exactly "+94" + 9 digits or "".
export function PhoneNumberInput({ id, value, onChange, onBlur, error, disabled, placeholder = "771234567" }) {
  const digits = toPhoneDigits(value);
  return (
    <div
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-md border border-input bg-transparent pl-3 focus-within:outline-none focus-within:ring-1 focus-within:ring-ring",
        error && "border-destructive",
      )}
    >
      <span aria-hidden className="shrink-0 text-sm font-medium text-muted-foreground">+94</span>
      <Input
        id={id}
        value={digits}
        onChange={(e) => onChange(joinPhoneNo(toPhoneDigits(e.target.value)))}
        onBlur={onBlur}
        placeholder={placeholder}
        maxLength={9}
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        aria-invalid={error}
        aria-label="Phone number"
        className="h-full border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
