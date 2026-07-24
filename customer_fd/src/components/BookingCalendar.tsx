import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bookingsService, type DayAvailability, type DayAvailabilityStatus } from "@/services/bookings.service";
import { toast } from "sonner";

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Local-date key (no UTC conversion) — toISOString() shifts the date backward
// for any timezone ahead of UTC (e.g. Sri Lanka, UTC+5:30), causing off-by-one bugs.
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const STATUS_DOT: Record<DayAvailabilityStatus, string> = {
  available: "bg-cta",
  limited: "bg-amber-500",
  full: "bg-destructive",
  closed: "bg-muted-foreground/40",
};

const LEGEND: { status: DayAvailabilityStatus; label: string }[] = [
  { status: "available", label: "Available" },
  { status: "limited", label: "Limited" },
  { status: "full", label: "Full" },
  { status: "closed", label: "Closed" },
];

interface BookingCalendarProps {
  packageId: number;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export function BookingCalendar({ packageId, selectedDate, onSelectDate }: BookingCalendarProps) {
  const today = new Date();
  const todayKey = toDateKey(today);
  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    bookingsService
      .getMonthAvailability(viewMonth.getFullYear(), viewMonth.getMonth() + 1, packageId)
      .then(({ days }) => setDays(days))
      .catch(() => toast.error("Failed to load calendar availability"))
      .finally(() => setLoading(false));
  }, [viewMonth, packageId]);

  const dayMap = useMemo(() => {
    const map: Record<string, DayAvailability> = {};
    days.forEach((d) => { map[d.date] = d; });
    return map;
  }, [days]);

  const cells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const startOffset = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const result: { date: Date; inMonth: boolean }[] = [];
    for (let i = startOffset - 1; i >= 0; i--) {
      result.push({ date: new Date(year, month, -i), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({ date: new Date(year, month, d), inMonth: true });
    }
    const trailing = (7 - (result.length % 7)) % 7;
    for (let i = 1; i <= trailing; i++) {
      result.push({ date: new Date(year, month + 1, i), inMonth: false });
    }
    return result;
  }, [viewMonth]);

  const goToMonth = (offset: number) => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const goToday = () => {
    setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b">
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => goToMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => goToMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <span className="font-semibold text-sm">
          {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </span>
        <Button type="button" variant="outline" size="sm" className="h-6 text-xs" onClick={goToday}>
          Today
        </Button>
      </div>

      <div className="p-2.5">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-cta" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-center text-[10px] font-medium text-muted-foreground py-0.5">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map(({ date, inMonth }, i) => {
                const key = toDateKey(date);
                const info = dayMap[key];
                const isPast = key < todayKey;
                const isToday = key === todayKey;
                const isSelected = key === selectedDate;
                const isClosed = !info || info.status === "closed";
                const disabled = !inMonth || isPast || isClosed;

                return (
                  <button
                    key={i}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelectDate(key)}
                    className={`flex flex-col items-center justify-center gap-0.5 rounded-md py-1 text-xs transition-colors ${
                      !inMonth || isPast
                        ? "text-muted-foreground/30 cursor-default"
                        : isSelected
                          ? "bg-cta text-cta-foreground font-semibold"
                          : isClosed
                            ? "text-muted-foreground/50 cursor-default"
                            : "hover:bg-muted cursor-pointer"
                    } ${isToday && !isSelected ? "ring-1 ring-cta" : ""}`}
                  >
                    <span>{date.getDate()}</span>
                    {inMonth && info && info.status !== "closed" && (
                      <span className={`text-[9px] leading-none ${isSelected ? "text-cta-foreground/80" : "text-muted-foreground"}`}>
                        {info.remaining_capacity} slots
                      </span>
                    )}
                    {inMonth && info && (
                      <span className={`h-1 w-1 rounded-full ${STATUS_DOT[info.status]}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-t bg-muted/20">
        {LEGEND.map((l) => (
          <div key={l.status} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[l.status]}`} />
            <span className="text-[10px] text-muted-foreground">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
