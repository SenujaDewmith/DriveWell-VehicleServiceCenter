import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { joinPlateNo, sanitizePlatePrefix, sanitizePlateSuffix, splitPlateNo } from "@/lib/plateNumber";
export function PlateNumberInput({ id, value, onChange, onBlur, error, disabled }) {
    const { prefix, suffix } = splitPlateNo(value);
    const prefixRef = useRef(null);
    const suffixRef = useRef(null);
    const errorClass = error ? "border-destructive" : "";
    return (<div className="flex items-center gap-2">
      <Input ref={prefixRef} id={id} value={prefix} onChange={(e) => {
            const next = sanitizePlatePrefix(e.target.value);
            onChange(joinPlateNo(next, suffix));
            if (next.length === 3)
                suffixRef.current?.focus();
        }} onBlur={onBlur} placeholder="CAB" maxLength={3} autoCapitalize="characters" autoComplete="off" spellCheck={false} disabled={disabled} aria-invalid={error} aria-label="Plate prefix" className={cn("w-20 text-center uppercase tracking-widest", errorClass)}/>
      <span aria-hidden className="text-muted-foreground font-medium">-</span>
      <Input ref={suffixRef} value={suffix} onChange={(e) => onChange(joinPlateNo(prefix, sanitizePlateSuffix(e.target.value)))} onKeyDown={(e) => {
            if (e.key === "Backspace" && suffix === "")
                prefixRef.current?.focus();
        }} onBlur={onBlur} placeholder="1234" maxLength={4} inputMode="numeric" autoComplete="off" spellCheck={false} disabled={disabled} aria-invalid={error} aria-label="Plate number" className={cn("w-24 text-center tracking-widest", errorClass)}/>
    </div>);
}
