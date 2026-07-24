import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { vehiclesService, type Vehicle } from "@/services/vehicles.service";
import { servicesService, type ServicePackage } from "@/services/services.service";
import { bookingsService, type AvailableSlot } from "@/services/bookings.service";
import { AddVehicleDialog } from "@/components/AddVehicleDialog";
import { BookingCalendar } from "@/components/BookingCalendar";
import { TermsDialog } from "@/components/TermsDialog";
import { AuthModal } from "@/components/auth/AuthModal";
import { Checkbox } from "@/components/ui/checkbox";
import { TERMS_VERSION } from "@/lib/terms";
import { CANCELLATION_CUTOFF_HOURS } from "@/lib/bookingRules";
import { ASSET_BASE_URL } from "@/lib/apiClient";
import { Calendar, Car, Clock, CheckCircle, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function imageSrc(image_url: string | null) {
  return image_url ? `${ASSET_BASE_URL}${image_url}` : null;
}

function fmtDuration(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

const STEPS = [
  { number: 1, label: "Package" },
  { number: 2, label: "Date & Time" },
  { number: 3, label: "Vehicle" },
  { number: 4, label: "Confirm" },
] as const;

export default function BookService() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPackage = searchParams.get("package");

  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [dateAvailable, setDateAvailable] = useState<boolean | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedStartTime, setSelectedStartTime] = useState<string | null>(null);
  const [selectedSlotTime, setSelectedSlotTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  // Gate booking behind an inline modal instead of redirecting to /login, so an
  // unauthenticated visitor never loses their place in the booking flow (e.g. a
  // preselected package from ?package=) — they authenticate and keep going right here.
  const [authModalOpen, setAuthModalOpen] = useState(false);
  useEffect(() => {
    if (!isLoading && !user) setAuthModalOpen(true);
  }, [isLoading, user]);

  const vehiclesQuery = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => vehiclesService.getVehicles().then((r) => r.vehicles),
    enabled: !!user,
  });
  const packagesQuery = useQuery({
    queryKey: ["packages"],
    queryFn: () => servicesService.getPackages().then((r) => r.packages),
    enabled: !!user,
  });
  const vehicles = vehiclesQuery.data ?? [];
  const packages = packagesQuery.data ?? [];
  const dataLoading = vehiclesQuery.isPending || packagesQuery.isPending;

  useEffect(() => {
    if (vehiclesQuery.isError || packagesQuery.isError) toast.error("Failed to load data");
  }, [vehiclesQuery.isError, packagesQuery.isError]);

  // Pre-select the package passed via ?package= once its data has loaded (runs once — bails
  // out as soon as a package is selected, whether by this effect or by the user). The user
  // already chose this package from the landing/services page, so skip straight past the
  // now-redundant package step to Date & Time.
  useEffect(() => {
    if (!preselectedPackage || selectedPackageId || packages.length === 0) return;
    const match = packages.find((p) => p.package_id.toString() === preselectedPackage);
    if (match) {
      setSelectedPackageId(match.package_id);
      setStep(2);
    }
  }, [preselectedPackage, packages, selectedPackageId]);

  // Re-fetch available slots whenever the selected date OR package changes — covers
  // both picking a new date and going back to pick a different (differently-timed) package.
  useEffect(() => {
    if (!selectedDate || !selectedPackageId) return;
    setSelectedStartTime(null);
    setSelectedSlotTime("");
    setSlotsLoading(true);
    bookingsService
      .getAvailableSlots(selectedDate, selectedPackageId)
      .then((res) => {
        setDateAvailable(res.available);
        setSlots(res.slots);
        if (!res.available) toast.error(res.reason ?? "No availability on this date");
      })
      .catch(() => toast.error("Failed to check availability"))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate, selectedPackageId]);

  const handleConfirm = async () => {
    if (!selectedVehicleId || !selectedPackageId || !selectedDate || !selectedStartTime || !termsAccepted) return;
    setIsSubmitting(true);
    try {
      const res = await bookingsService.createBooking({
        vehicle_id: selectedVehicleId,
        package_id: selectedPackageId,
        service_date: selectedDate,
        start_time: selectedStartTime,
        terms_accepted: true,
        terms_version: TERMS_VERSION,
      });
      toast.success(`Booking confirmed! Ref: ${res.booking_ref}`);
      navigate("/bookings");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Booking failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVehicleAdded = (vehicle: Vehicle) => {
    queryClient.setQueryData<Vehicle[]>(["vehicles"], (prev) => [vehicle, ...(prev ?? [])]);
    setSelectedVehicleId(vehicle.vehicle_id);
  };

  const vehicle = vehicles.find((v) => v.vehicle_id === selectedVehicleId);
  const pkg = packages.find((p) => p.package_id === selectedPackageId);

  // Mirrors ProtectedRoute's loading guard — /book is intentionally NOT wrapped in
  // ProtectedRoute (see App.tsx) so an unauthenticated visit renders this page with
  // an AuthModal instead of bouncing to /login.
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-cta" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-5 text-center">Book a Service</h1>

      {/* Step indicator — compact horizontal stepper (small circle + connector, label
          reduced to caption size) so it reads at a glance without pushing step content
          below the fold. */}
      <div className="mb-4 rounded-lg border bg-card shadow-sm px-4 py-3">
        <div className="flex items-start">
          {STEPS.map((s, idx) => {
            const isComplete = step > s.number;
            const isCurrent = step === s.number;
            return (
              <div key={s.number} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                      isComplete
                        ? "bg-cta text-cta-foreground"
                        : isCurrent
                          ? "bg-cta text-cta-foreground ring-4 ring-cta/20"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isComplete ? <CheckCircle className="h-4 w-4" /> : s.number}
                  </div>
                  <span
                    className={`text-[11px] leading-none text-center whitespace-nowrap ${
                      isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 mb-4 rounded-full ${step > s.number ? "bg-cta" : "bg-muted"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1 — Select Package */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Select Service Package
            </CardTitle>
            <CardDescription>Choose the service package that fits your needs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Same viewport-capped scroll pattern as the vehicle step, so the
                actions below stay reachable however large the catalog grows. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[min(52vh,28rem)] overflow-y-auto overscroll-contain -m-1 p-1">
              {packages.map((p) => {
                const isSelected = selectedPackageId === p.package_id;
                return (
                  <Card
                    key={p.package_id}
                    className={`cursor-pointer transition-all overflow-hidden flex flex-col ${isSelected ? "border-cta border-2 bg-cta/5" : "hover:border-cta/50"}`}
                    onClick={() => setSelectedPackageId(p.package_id)}
                  >
                    {/* Fixed 128px thumbnail strip — enough to actually read the photo
                        without the image dominating the card over its details/price. */}
                    <div className="relative h-32 w-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {imageSrc(p.image_url) ? (
                        <img
                          src={imageSrc(p.image_url)!}
                          alt={p.name}
                          className="h-full w-full object-cover object-center"
                          loading="lazy"
                        />
                      ) : (
                        <Car className="h-8 w-8 text-muted-foreground" />
                      )}
                      {isSelected && (
                        <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-cta text-cta-foreground flex items-center justify-center shadow">
                          <CheckCircle className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3 flex flex-col flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm">{p.name}</h3>
                        {p.package_code && (
                          <span className="text-[10px] font-mono text-muted-foreground">{p.package_code}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{p.description}</p>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t">
                        <div>
                          <span className="text-base font-bold text-cta">
                            LKR {parseFloat(p.price).toLocaleString()}
                          </span>
                          <span className="text-muted-foreground text-[10px] font-medium ml-1">Upwards</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{fmtDuration(p.estimated_duration)}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {/* Sticky action bar — keeps Continue visible even when the card
                overflows short viewports (e.g. mobile). */}
            <div className="sticky bottom-0 -mx-6 -mb-6 rounded-b-lg border-t bg-card px-6 py-4">
              <Button
                className="w-full bg-cta text-cta-foreground hover:bg-cta/90"
                onClick={() => setStep(2)}
                disabled={!selectedPackageId}
              >
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — Date & Time */}
      {step === 2 && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Choose Date & Time
            </CardTitle>
            <CardDescription>Select your preferred appointment slot</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <BookingCalendar packageId={selectedPackageId!} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Available Time Slots</Label>
                  {selectedDate && (
                    <Badge variant="outline" className="border-cta text-cta">
                      {new Date(selectedDate).toLocaleDateString("en-LK", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Badge>
                  )}
                </div>

                {!selectedDate ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Select a date to see available slots.
                  </p>
                ) : slotsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-cta" />
                  </div>
                ) : dateAvailable === false ? (
                  <p className="text-sm text-destructive py-8 text-center">
                    No slots available on this date. Please choose another date.
                  </p>
                ) : (
                  // Capped to match the calendar's rendered height (not an arbitrary
                  // value) so the two columns sit flush and neither one pushes the
                  // sticky action bar below the fold.
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[22rem] overflow-y-auto overscroll-contain -m-1 p-1">
                    {slots.map((slot) => {
                      const isSelected = selectedStartTime === slot.start_time;
                      const isFull = slot.remaining <= 0;
                      return (
                        <button
                          key={slot.start_time}
                          type="button"
                          disabled={isFull}
                          onClick={() => {
                            setSelectedStartTime(slot.start_time);
                            setSelectedSlotTime(`${fmtTime(slot.start_time)} - ${fmtTime(slot.end_time)}`);
                          }}
                          className={`text-left border-2 rounded-lg p-2.5 transition-colors ${
                            isSelected
                              ? "border-cta bg-cta/5"
                              : isFull
                                ? "opacity-50 cursor-not-allowed border-border"
                                : "border-border hover:border-cta/50"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-1.5">
                            <div>
                              <p className="font-semibold">{fmtTime(slot.start_time)} - {fmtTime(slot.end_time)}</p>
                              {pkg && <p className="text-xs text-muted-foreground">Est. service time: {fmtDuration(pkg.estimated_duration)}</p>}
                            </div>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                                isFull ? "bg-destructive/10 text-destructive" : "bg-cta/10 text-cta"
                              }`}
                            >
                              {isFull ? "FULL" : "AVAILABLE"}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-muted-foreground">
                              Free <span className="font-medium text-foreground">{slot.remaining}</span>
                            </span>
                            <span className="text-muted-foreground">
                              Booked <span className="font-medium text-foreground">{slot.booked_count}</span>
                            </span>
                          </div>
                          {isSelected && (
                            <p className="text-xs text-cta font-medium mt-2 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> Selected
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Sticky action bar — keeps Back/Confirm visible on short viewports. */}
            <div className="sticky bottom-0 -mx-6 -mb-6 rounded-b-lg border-t bg-card px-6 py-4 flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
              <Button
                className="flex-1 bg-cta text-cta-foreground hover:bg-cta/90"
                onClick={() => setStep(3)}
                disabled={!selectedDate || !selectedStartTime || dateAvailable === false}
              >
                Confirm Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Select Vehicle */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Select Your Vehicle
            </CardTitle>
            <CardDescription>Choose which vehicle you'd like to service</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dataLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-cta" />
              </div>
            ) : vehicles.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">You haven't added any vehicles yet</p>
                <Button onClick={() => setAddVehicleOpen(true)} variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add a Vehicle
                </Button>
              </div>
            ) : (
              // Capped to viewport height so long vehicle lists scroll internally
              // and the Continue button below stays reachable without page scrolling.
              <div className="grid gap-4 sm:grid-cols-2 max-h-[min(50vh,26rem)] overflow-y-auto overscroll-contain -m-1 p-1">
                {vehicles.map((v) => (
                  <Card
                    key={v.vehicle_id}
                    className={`cursor-pointer transition-all ${selectedVehicleId === v.vehicle_id ? "border-cta border-2 bg-cta/5" : "hover:border-cta/50"}`}
                    onClick={() => setSelectedVehicleId(v.vehicle_id)}
                  >
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="h-12 w-12 bg-cta/10 rounded-lg flex items-center justify-center">
                        <Car className="h-6 w-6 text-cta" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{v.make} {v.model}</p>
                        <p className="text-sm text-muted-foreground">
                          {v.plate_no}{v.year ? ` • ${v.year}` : ""} • {v.vehicle_type}
                        </p>
                      </div>
                      {selectedVehicleId === v.vehicle_id && (
                        <CheckCircle className="h-6 w-6 text-cta" />
                      )}
                    </CardContent>
                  </Card>
                ))}
                <Card
                  className="cursor-pointer border-dashed hover:border-cta/50 transition-all"
                  onClick={() => setAddVehicleOpen(true)}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="h-12 w-12 bg-muted rounded-lg flex items-center justify-center">
                      <Plus className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="font-semibold text-muted-foreground">Add New Vehicle</p>
                  </CardContent>
                </Card>
              </div>
            )}
            {/* Sticky action bar — keeps Back/Continue visible even when the card
                overflows short viewports (e.g. mobile). */}
            <div className="sticky bottom-0 -mx-6 -mb-6 rounded-b-lg border-t bg-card px-6 py-4 flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
              <Button
                className="flex-1 bg-cta text-cta-foreground hover:bg-cta/90"
                onClick={() => setStep(4)}
                disabled={!selectedVehicleId}
              >
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4 — Review & Confirm */}
      {step === 4 && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-cta" />
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
                  <Car className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground shrink-0">Vehicle</span>
                </div>
                <div className="text-right min-w-0">
                  <p className="font-semibold text-sm truncate">{vehicle?.make} {vehicle?.model}</p>
                  <p className="text-xs text-muted-foreground">{vehicle?.plate_no}</p>
                </div>
              </div>
              <div className="flex justify-between items-center gap-3 px-4 py-2.5 bg-muted/30">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground shrink-0">Package</span>
                </div>
                <div className="text-right min-w-0">
                  <p className="font-semibold text-sm truncate">{pkg?.name}</p>
                  <p className="text-xs text-muted-foreground">{pkg ? fmtDuration(pkg.estimated_duration) : ""}</p>
                </div>
              </div>
              <div className="flex justify-between items-center gap-3 px-4 py-2.5 bg-muted/30">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
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
            {/* Clickwrap consent — unticked by default; gates the Confirm button and is
                re-validated server-side. Replaces the old passive "by confirming…" text. */}
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
              <Checkbox
                id="accept-terms"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <label htmlFor="accept-terms" className="block cursor-pointer text-sm font-medium leading-snug">
                  I have read and agree to the{" "}
                  <button
                    type="button"
                    className="font-semibold text-cta underline underline-offset-2 hover:text-cta/80"
                    onClick={(e) => {
                      e.preventDefault();
                      setTermsOpen(true);
                    }}
                  >
                    Terms &amp; Conditions
                  </button>
                </label>
                <p className="text-xs text-muted-foreground leading-snug">
                  Includes our {CANCELLATION_CUTOFF_HOURS}-hour cancellation policy and possible additional charges
                  for extra work discovered during service.
                </p>
              </div>
            </div>
            {/* Sticky action bar — pins Back/Confirm on short viewports. The summary
                above stays in normal flow (not scroll-capped) so every detail the
                user is confirming remains scannable. */}
            <div className="sticky bottom-0 -mx-6 -mb-6 rounded-b-lg border-t bg-card px-6 py-4 flex gap-3">
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1">Back</Button>
              <Button
                className="flex-1 bg-cta text-cta-foreground hover:bg-cta/90"
                onClick={handleConfirm}
                disabled={isSubmitting || !termsAccepted}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  "Confirm Booking"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AddVehicleDialog
        open={addVehicleOpen}
        onOpenChange={setAddVehicleOpen}
        onVehicleAdded={handleVehicleAdded}
      />

      <TermsDialog
        open={termsOpen}
        onOpenChange={setTermsOpen}
        onAgree={() => {
          setTermsAccepted(true);
          setTermsOpen(false);
        }}
      />

      <AuthModal
        open={authModalOpen}
        onOpenChange={(open) => {
          setAuthModalOpen(open);
          // Dismissed without signing in — there's nothing to book on this page
          // yet, so send them somewhere useful instead of leaving them stranded.
          if (!open && !user) navigate("/services");
        }}
        onSuccess={() => setAuthModalOpen(false)}
        title="Sign in to book a service"
        description="Sign in or create an account to pick your vehicle, package, and time slot."
      />
    </div>
  );
}
