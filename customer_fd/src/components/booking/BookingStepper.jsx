import { CheckCircle } from "lucide-react";
// Compact horizontal stepper (small circle + connector, label reduced to caption size)
// so it reads at a glance without pushing step content below the fold.
export function BookingStepper({ steps, currentStep }) {
    return (<div className="mb-4 rounded-lg border bg-card shadow-sm px-4 py-3">
      <div className="flex items-start">
        {steps.map((s, idx) => {
            const isComplete = currentStep > s.number;
            const isCurrent = currentStep === s.number;
            return (<div key={s.number} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${isComplete
                    ? "bg-cta text-cta-foreground"
                    : isCurrent
                        ? "bg-cta text-cta-foreground ring-4 ring-cta/20"
                        : "bg-muted text-muted-foreground"}`}>
                  {isComplete ? <CheckCircle className="h-4 w-4"/> : s.number}
                </div>
                <span className={`text-[11px] leading-none text-center whitespace-nowrap ${isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
              </div>
              {idx < steps.length - 1 && (<div className={`flex-1 h-0.5 mx-2 mb-4 rounded-full ${currentStep > s.number ? "bg-cta" : "bg-muted"}`}/>)}
            </div>);
        })}
      </div>
    </div>);
}
