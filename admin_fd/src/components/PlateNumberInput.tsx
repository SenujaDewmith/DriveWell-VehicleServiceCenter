import { useRef } from "react";
import { cn } from "@/lib/utils";
import { joinPlateNo, sanitizePlatePrefix, sanitizePlateSuffix, splitPlateNo } from "@/lib/plateNumber";

interface PlateNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: boolean;
  disabled?: boolean;
}

const baseInputClass =
  "border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function PlateNumberInput({ value, onChange, onBlur, error, disabled }: PlateNumberInputProps) {
  const { prefix, suffix } = splitPlateNo(value);
  const prefixRef = useRef<HTMLInputElement>(null);
  const suffixRef = useRef<HTMLInputElement>(null);

  const errorClass = error ? "border-destructive focus:ring-destructive" : "";

  return (
    <div className="flex items-center gap-2">
      <input
        ref={prefixRef}
        value={prefix}
        onChange={(e) => {
          const next = sanitizePlatePrefix(e.target.value);
          onChange(joinPlateNo(next, suffix));
          if (next.length === 3) suffixRef.current?.focus();
        }}
        onBlur={onBlur}
        placeholder="CAB"
        maxLength={3}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        aria-invalid={error}
        aria-label="Plate prefix"
        className={cn(baseInputClass, "w-20 text-center uppercase tracking-widest", errorClass)}
      />
      <span aria-hidden className="text-muted-foreground font-medium">-</span>
      <input
        ref={suffixRef}
        value={suffix}
        onChange={(e) => onChange(joinPlateNo(prefix, sanitizePlateSuffix(e.target.value)))}
        onKeyDown={(e) => {
          if (e.key === "Backspace" && suffix === "") prefixRef.current?.focus();
        }}
        onBlur={onBlur}
        placeholder="1234"
        maxLength={4}
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        aria-invalid={error}
        aria-label="Plate number"
        className={cn(baseInputClass, "w-24 text-center tracking-widest", errorClass)}
      />
    </div>
  );
}
