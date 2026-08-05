import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BookingCalendar } from "@/components/BookingCalendar";
import { ScrollFade } from "@/components/ScrollFade";
import { fmtDuration } from "@/lib/packageFormat";
import { fmtTime } from "@/lib/time";
import { Calendar, CheckCircle, Loader2 } from "lucide-react";
export function DateTimeStep({ packageId, pkg, selectedDate, onSelectDate, slots, slotsLoading, dateAvailable, selectedStartTime, onSelectSlot, onBack, onContinue, }) {
    return (<Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5"/>
          Choose Date & Time
        </CardTitle>
        <CardDescription>Select your preferred appointment slot</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Date</Label>
            <BookingCalendar packageId={packageId} selectedDate={selectedDate} onSelectDate={onSelectDate}/>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Available Time Slots</Label>
              {selectedDate && (<Badge variant="outline" className="border-cta text-cta">
                  {new Date(selectedDate).toLocaleDateString("en-LK", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
            })}
                </Badge>)}
            </div>

            {!selectedDate ? (<p className="text-sm text-muted-foreground py-8 text-center">
                Select a date to see available slots.
              </p>) : slotsLoading ? (<div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-cta"/>
              </div>) : dateAvailable === false ? (<p className="text-sm text-destructive py-8 text-center">
                No slots available on this date. Please choose another date.
              </p>) : (
        // Capped to match the calendar's rendered height (not an arbitrary
        // value) so the two columns sit flush and neither one pushes the
        // sticky action bar below the fold.
        <ScrollFade className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[22rem] overflow-y-auto overscroll-contain -m-1 p-1" deps={[slots.length]}>
                {slots.map((slot) => {
                const isSelected = selectedStartTime === slot.start_time;
                const isVehicleConflict = !!slot.vehicle_conflict;
                const isFull = slot.remaining <= 0;
                const isDisabled = isFull || isVehicleConflict;
                return (<button key={slot.start_time} type="button" disabled={isDisabled} onClick={() => onSelectSlot(slot)} className={`text-left border-2 rounded-lg p-2.5 transition-colors ${isSelected
                        ? "border-cta bg-cta/5"
                        : isDisabled
                            ? "opacity-50 cursor-not-allowed border-border"
                            : "border-border hover:border-cta/50"}`}>
                      <div className="flex items-start justify-between mb-1.5">
                        <div>
                          <p className="font-semibold">{fmtTime(slot.start_time)} - {fmtTime(slot.end_time)}</p>
                          {pkg && <p className="text-xs text-muted-foreground">Est. service time: {fmtDuration(pkg.estimated_duration)}</p>}
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${isDisabled ? "bg-destructive/10 text-destructive" : "bg-cta/10 text-cta"}`}>
                          {isVehicleConflict ? "YOUR VEHICLE IS BOOKED" : isFull ? "FULL" : "AVAILABLE"}
                        </span>
                      </div>
                      {isVehicleConflict ? (<p className="text-xs text-destructive">
                          This vehicle already has a booking in this time window.
                        </p>) : (<div className="flex items-center gap-4 text-xs">
                          <span className="text-muted-foreground">
                            Free <span className="font-medium text-foreground">{slot.remaining}</span>
                          </span>
                          <span className="text-muted-foreground">
                            Booked <span className="font-medium text-foreground">{slot.booked_count}</span>
                          </span>
                        </div>)}
                      {isSelected && (<p className="text-xs text-cta font-medium mt-2 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3"/> Selected
                        </p>)}
                    </button>);
            })}
              </ScrollFade>)}
          </div>
        </div>

        {/* Sticky action bar — keeps Back/Confirm visible on short viewports. */}
        <div className="sticky bottom-0 -mx-6 -mb-6 rounded-b-lg border-t bg-card px-6 py-4 flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1">Back</Button>
          <Button className="flex-1 bg-cta text-cta-foreground hover:bg-cta/90" onClick={onContinue} disabled={!selectedDate || !selectedStartTime || dateAvailable === false}>
            Confirm Selection
          </Button>
        </div>
      </CardContent>
    </Card>);
}
