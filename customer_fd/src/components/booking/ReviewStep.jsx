import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PhoneNumberInput } from "@/components/ui/phone-number-input";
import { fmtDuration } from "@/lib/packageFormat";
import { CANCELLATION_CUTOFF_HOURS } from "@/lib/bookingRules";
import { Car, CheckCircle, Clock, Phone, Loader2 } from "lucide-react";
export function ReviewStep({ vehicle, pkg, selectedDate, selectedSlotTime, user, contactPhoneChoice, onContactPhoneChoiceChange, newContactPhone, onNewContactPhoneChange, contactPhoneValid, termsAccepted, onTermsAcceptedChange, onOpenTerms, isSubmitting, onBack, onConfirm, confirmLabel = "Confirm Booking", requireTerms = true, }) {
    return (<Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-cta"/>
          Review & Confirm
        </CardTitle>
        <CardDescription>Please review your booking details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* One divided-row summary instead of three separate boxed cards — the same
            information reads at a glance in noticeably less vertical space, the
            standard layout for checkout/order-review summaries. */}
        <div className="rounded-lg border divide-y overflow-hidden">
          <div className="flex justify-between items-center gap-3 px-4 py-2.5 bg-muted/30">
            <div className="flex items-center gap-2.5 min-w-0">
              <Car className="h-4 w-4 text-muted-foreground shrink-0"/>
              <span className="text-sm text-muted-foreground shrink-0">Vehicle</span>
            </div>
            <div className="text-right min-w-0">
              <p className="font-semibold text-sm truncate">{vehicle?.make} {vehicle?.model}</p>
              <p className="text-xs text-muted-foreground">{vehicle?.plate_no}</p>
            </div>
          </div>
          <div className="flex justify-between items-center gap-3 px-4 py-2.5 bg-muted/30">
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckCircle className="h-4 w-4 text-muted-foreground shrink-0"/>
              <span className="text-sm text-muted-foreground shrink-0">Package</span>
            </div>
            <div className="text-right min-w-0">
              <p className="font-semibold text-sm truncate">{pkg?.name}</p>
              <p className="text-xs text-muted-foreground">{pkg ? fmtDuration(pkg.estimated_duration) : ""}</p>
            </div>
          </div>
          <div className="flex justify-between items-center gap-3 px-4 py-2.5 bg-muted/30">
            <div className="flex items-center gap-2.5 min-w-0">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0"/>
              <span className="text-sm text-muted-foreground shrink-0">Date & Time</span>
            </div>
            <div className="text-right min-w-0">
              <p className="font-semibold text-sm truncate">
                {new Date(selectedDate).toLocaleDateString("en-LK", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
        })}
              </p>
              <p className="text-xs text-muted-foreground">{selectedSlotTime || "To be confirmed"}</p>
            </div>
          </div>
          <div className="flex justify-between items-center px-4 py-3 bg-cta/10">
            <span className="font-semibold text-sm">Estimated Cost</span>
            <span className="text-xl font-bold text-cta">
              {pkg ? `LKR ${parseFloat(pkg.price).toLocaleString()} Upwards` : "—"}
            </span>
          </div>
        </div>
        {/* Collected here rather than earlier in the wizard — it's the last thing standing
            between the customer and submission, same as the transfer-ownership request
            dialog in Vehicles.jsx, which this mirrors: check the profile first, only ask
            for a new number if neither is on file. */}
        <div className="space-y-2 rounded-lg border p-3">
          <Label className="flex items-center gap-1.5">
            <Phone className="h-4 w-4 text-muted-foreground"/>
            Contact Phone Number <span className="text-destructive">*</span>
          </Label>
          <p className="text-xs text-muted-foreground">
            DriveWell staff will use this number to reach you about this booking.
          </p>
          <div className="space-y-2">
            {user?.phone && (<label className="flex items-center gap-2 text-sm">
                <input type="radio" name="booking_contact_phone_choice" checked={contactPhoneChoice === "primary"} onChange={() => onContactPhoneChoiceChange("primary")}/>
                Primary: {user.phone}
              </label>)}
            {user?.secondaryPhone && (<label className="flex items-center gap-2 text-sm">
                <input type="radio" name="booking_contact_phone_choice" checked={contactPhoneChoice === "secondary"} onChange={() => onContactPhoneChoiceChange("secondary")}/>
                Secondary: {user.secondaryPhone}
              </label>)}
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="booking_contact_phone_choice" checked={contactPhoneChoice === "new"} onChange={() => onContactPhoneChoiceChange("new")}/>
              Use a different number
            </label>
            {contactPhoneChoice === "new" && (<div className="mt-1">
                <PhoneNumberInput id="booking-new-contact-phone" value={newContactPhone} onChange={onNewContactPhoneChange}/>
              </div>)}
          </div>
        </div>
        {/* Clickwrap consent — unticked by default; gates the Confirm button and is
            re-validated server-side. Replaces the old passive "by confirming…" text.
            Skipped for a reschedule of an already-Booked appointment: the customer
            already accepted these terms when the booking was first made, and moving
            its date/time doesn't create a new agreement to re-consent to. */}
        {requireTerms && (<div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
          <Checkbox id="accept-terms" checked={termsAccepted} onCheckedChange={(checked) => onTermsAcceptedChange(checked === true)} className="mt-0.5"/>
          <div className="space-y-0.5">
            <label htmlFor="accept-terms" className="block cursor-pointer text-sm font-medium leading-snug">
              I have read and agree to the{" "}
              <button type="button" className="font-semibold text-cta underline underline-offset-2 hover:text-cta/80" onClick={(e) => {
            e.preventDefault();
            onOpenTerms();
        }}>
                Terms &amp; Conditions
              </button>
            </label>
            <p className="text-xs text-muted-foreground leading-snug">
              Includes our {CANCELLATION_CUTOFF_HOURS}-hour cancellation policy and possible additional charges
              for extra work discovered during service.
            </p>
          </div>
        </div>)}
        {/* Sticky action bar — pins Back/Confirm on short viewports. The summary
            above stays in normal flow (not scroll-capped) so every detail the
            user is confirming remains scannable. */}
        <div className="sticky bottom-0 -mx-6 -mb-6 rounded-b-lg border-t bg-card px-6 py-4 flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1">Back</Button>
          <Button className="flex-1 bg-cta text-cta-foreground hover:bg-cta/90" onClick={onConfirm} disabled={isSubmitting || !contactPhoneValid || (requireTerms && !termsAccepted)}>
            {isSubmitting ? (<>
                <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                Confirming...
              </>) : (confirmLabel)}
          </Button>
        </div>
      </CardContent>
    </Card>);
}
