import { useState, useEffect } from "react";
import { CalendarCheck, Calendar as CalendarIcon } from "lucide-react";
import { api } from "@/lib/api";
import { toLocalISODate, fmt12h, formatDateShort } from "@/lib/date";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

// Lets any staff role (not just managers) check how full a package's appointment
// windows are for any date — past, today, or future — without the customer-facing
// booking-eligibility gates (see ignore_restrictions on the backend). Self-contained
// so it can be dropped into any page: Schedule Config for managers, its own page for
// supervisors.
export function SlotAvailability() {
  const [packages, setPackages] = useState([]);
  const [slotPackageId, setSlotPackageId] = useState("");
  const [slotDate, setSlotDate] = useState(new Date());
  const [slotDatePopoverOpen, setSlotDatePopoverOpen] = useState(false);
  const [slotData, setSlotData] = useState(null);
  const [slotLoading, setSlotLoading] = useState(false);
  const [slotError, setSlotError] = useState("");

  useEffect(() => {
    api
      .get("/api/packages")
      .then((d) => {
        const active = (d.packages || []).filter((p) => p.is_active);
        setPackages(active);
        setSlotPackageId((prev) => prev || (active[0] ? String(active[0].package_id) : ""));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!slotPackageId || !slotDate) return;
    setSlotLoading(true);
    setSlotError("");
    const dateStr = toLocalISODate(slotDate);
    api
      .get(
        `/api/bookings/available-slots?date=${dateStr}&package_id=${slotPackageId}&ignore_restrictions=true`,
      )
      .then((d) => setSlotData(d))
      .catch((err) => setSlotError(err instanceof Error ? err.message : "Failed to load slots"))
      .finally(() => setSlotLoading(false));
  }, [slotPackageId, slotDate]);

  // Sum of per-window figures — the "day summary" shown at a glance above the
  // individual slot list, so staff don't have to add it up by eye.
  const slotSummary = slotData?.slots?.length
    ? slotData.slots.reduce(
        (acc, s) => ({
          totalCapacity: acc.totalCapacity + s.capacity,
          totalBooked: acc.totalBooked + s.booked_count,
          totalRemaining: acc.totalRemaining + s.remaining,
        }),
        { totalCapacity: 0, totalBooked: 0, totalRemaining: 0 },
      )
    : null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <CalendarCheck className="h-4 w-4" /> Slot Availability
      </h3>
      <p className="text-sm text-muted-foreground">
        Check available and booked appointment windows for a specific package and date.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-muted-foreground">Package</label>
          <Select value={slotPackageId} onValueChange={setSlotPackageId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select package" />
            </SelectTrigger>
            <SelectContent>
              {packages.map((p) => (
                <SelectItem key={p.package_id} value={String(p.package_id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-muted-foreground">Date</label>
          <Popover open={slotDatePopoverOpen} onOpenChange={setSlotDatePopoverOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground hover:border-muted-foreground transition-colors">
                <CalendarIcon className="h-3.5 w-3.5" />
                {slotDate ? formatDateShort(slotDate) : "Pick a date"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={slotDate ?? undefined}
                onSelect={(d) => {
                  if (!d) return;
                  setSlotDate(d);
                  setSlotDatePopoverOpen(false);
                }}
                autoFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {!packages.length && (
        <p className="text-sm text-muted-foreground">No active packages configured.</p>
      )}
      {slotLoading && <p className="text-sm text-muted-foreground">Loading slots...</p>}
      {slotError && <p className="text-sm text-destructive">{slotError}</p>}

      {!slotLoading && !slotError && slotData && !slotData.available && (
        <p className="text-sm text-muted-foreground border border-border rounded-md px-3 py-2">
          {slotData.reason ?? "No availability on this date"}
        </p>
      )}

      {!slotLoading && !slotError && slotData?.available && slotSummary && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Total Windows</p>
              <p className="text-lg font-semibold text-foreground">{slotData.slots.length}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Booked</p>
              <p className="text-lg font-semibold text-foreground">{slotSummary.totalBooked}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Available</p>
              <p className="text-lg font-semibold text-accent">{slotSummary.totalRemaining}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Capacity</p>
              <p className="text-lg font-semibold text-foreground">{slotSummary.totalCapacity}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {slotData.slots.map((s) => {
              const isFull = s.remaining <= 0;
              return (
                <div
                  key={s.start_time}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    isFull
                      ? "border-border bg-muted/40 text-muted-foreground"
                      : "border-accent/40 text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {fmt12h(s.start_time)} – {fmt12h(s.end_time)}
                    </span>
                    <span
                      className={`text-xs font-semibold ${isFull ? "text-destructive" : "text-accent"}`}
                    >
                      {isFull ? "Full" : `${s.remaining} free`}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {s.booked_count} / {s.capacity} booked
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
