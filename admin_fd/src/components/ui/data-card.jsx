import { cn } from "@/lib/utils";

// Mobile/tablet stand-in for a table row: renders as a bordered card with
// label/value pairs instead of table columns. Pair with `hidden lg:block` on
// the table and `lg:hidden` on the list of these, so desktop keeps the table
// and screens below 1024px get this instead of horizontal table scrolling.
export function DataCard({ className, children, ...props }) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-card p-3 space-y-2", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function DataCardField({ label, value }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-foreground text-right">{value}</span>
    </div>
  );
}
