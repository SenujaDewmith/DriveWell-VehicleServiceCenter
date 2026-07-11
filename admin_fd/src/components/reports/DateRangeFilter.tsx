import { Filter, X } from "lucide-react";

interface DateRangeFilterProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onClear: () => void;
}

export function DateRangeFilter({ from, to, onFromChange, onToChange, onClear }: DateRangeFilterProps) {
  const hasFilter = from || to;

  return (
    <div className="flex flex-wrap items-end gap-3 border-2 border-border bg-card p-4">
      <Filter className="h-4 w-4 text-muted-foreground mb-2" />
      <div className="space-y-1">
        <label className="block text-[10px] font-mono uppercase text-muted-foreground">From</label>
        <input
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => onFromChange(e.target.value)}
          className="border-2 border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-[10px] font-mono uppercase text-muted-foreground">To</label>
        <input
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => onToChange(e.target.value)}
          className="border-2 border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
        />
      </div>
      {hasFilter && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 border-2 border-border px-3 py-2 text-[10px] font-mono uppercase text-muted-foreground hover:border-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" /> Clear
        </button>
      )}
    </div>
  );
}