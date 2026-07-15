import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { vehiclesService, type Vehicle } from "@/services/vehicles.service";
import { servicesService, type ServicePackage } from "@/services/services.service";
import { bookingsService, type AvailableSlot } from "@/services/bookings.service";
import { ASSET_BASE_URL } from "@/lib/apiClient";
import { Calendar, Car, Clock, CheckCircle, Loader2 } from "lucide-react";
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

export default function BookService() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPackage = searchParams.get("package");

  const [step, setStep] = useState(1);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [dateAvailable, setDateAvailable] = useState<boolean | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [selectedSlotTime, setSelectedSlotTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    Promise.all([
      vehiclesService.getVehicles().then(({ vehicles }) => setVehicles(vehicles)),
      servicesService.getPackages().then(({ packages }) => {
        setPackages(packages);
        if (preselectedPackage) {
          const match = packages.find((p) => p.package_id.toString() === preselectedPackage);
          if (match) setSelectedPackageId(match.package_id);
        }
      }),
    ])
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load data"))
      .finally(() => setDataLoading(false));
  }, [user, navigate, preselectedPackage]);

  const handleDateChange = async (date: string) => {
    setSelectedDate(date);
    setSelectedSlotId(null);
    setSelectedSlotTime("");
    setSlotsLoading(true);
    try {
      const res = await bookingsService.getAvailableSlots(date);
      setDateAvailable(res.available);
      setSlots(res.slots);
      if (!res.available) toast.error(res.reason ?? "No availability on this date");
    } catch {
      toast.error("Failed to check availability");
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedVehicleId || !selectedPackageId || !selectedDate) return;
    setIsSubmitting(true);
    try {
      const res = await bookingsService.createBooking({
        vehicle_id: selectedVehicleId,
        package_id: selectedPackageId,
        service_date: selectedDate,
        ...(selectedSlotId ? { slot_id: selectedSlotId } : {}),
      });
      toast.success(`Booking confirmed! Ref: ${res.booking_ref}`);
      navigate("/bookings");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Booking failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d.toISOString().split("T")[0];
  });

  const vehicle = vehicles.find((v) => v.vehicle_id === selectedVehicleId);
  const pkg = packages.find((p) => p.package_id === selectedPackageId);

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8 text-center">Book a Service</h1>

      {/* Step indicator */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold ${step >= s ? "bg-cta text-cta-foreground" : "bg-muted text-muted-foreground"}`}>
                {s}
              </div>
              {s < 4 && <div className={`flex-1 h-1 mx-2 ${step > s ? "bg-cta" : "bg-muted"}`} />}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Vehicle</span>
          <span>Package</span>
          <span>Date & Time</span>
          <span>Confirm</span>
        </div>
      </div>

      {/* Step 1 — Select Vehicle */}
      {step === 1 && (
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
                <Button onClick={() => navigate("/vehicles")} variant="outline">
                  Add a Vehicle
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
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
                          {v.plate_no}{v.year ? ` • ${v.year}` : ""}{v.color ? ` • ${v.color}` : ""}
                        </p>
                      </div>
                      {selectedVehicleId === v.vehicle_id && (
                        <CheckCircle className="h-6 w-6 text-cta" />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <Button
              className="w-full bg-cta text-cta-foreground hover:bg-cta/90"
              onClick={() => setStep(2)}
              disabled={!selectedVehicleId}
            >
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — Select Package */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Select Service Package
            </CardTitle>
            <CardDescription>Choose the service package that fits your needs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              {packages.map((p) => (
                <Card
                  key={p.package_id}
                  className={`cursor-pointer transition-all ${selectedPackageId === p.package_id ? "border-cta border-2 bg-cta/5" : "hover:border-cta/50"}`}
                  onClick={() => setSelectedPackageId(p.package_id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {imageSrc(p.image_url) ? (
                          <img src={imageSrc(p.image_url)!} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <Car className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-lg">{p.name}</h3>
                            <p className="text-sm text-muted-foreground">{p.description}</p>
                          </div>
                          {selectedPackageId === p.package_id && (
                            <CheckCircle className="h-6 w-6 text-cta shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-2xl font-bold text-cta">
                            LKR {parseFloat(p.price).toLocaleString()}
                          </span>
                          <span className="text-muted-foreground">• {fmtDuration(p.estimated_duration)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
              <Button
                className="flex-1 bg-cta text-cta-foreground hover:bg-cta/90"
                onClick={() => setStep(3)}
                disabled={!selectedPackageId}
              >
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Date & Time */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Choose Date & Time
            </CardTitle>
            <CardDescription>Select your preferred appointment slot</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Date</Label>
              <Select value={selectedDate} onValueChange={handleDateChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a date" />
                </SelectTrigger>
                <SelectContent>
                  {dates.map((date) => (
                    <SelectItem key={date} value={date}>
                      {new Date(date).toLocaleDateString("en-LK", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedDate && (
              <div className="space-y-2">
                <Label>Time Slot</Label>
                {slotsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-cta" />
                  </div>
                ) : dateAvailable === false ? (
                  <p className="text-sm text-destructive">No slots available on this date. Please choose another date.</p>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Select a date to see available slots.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {slots.map((slot) => (
                      <Button
                        key={slot.slot_id}
                        variant={selectedSlotId === slot.slot_id ? "default" : "outline"}
                        className={selectedSlotId === slot.slot_id ? "bg-cta text-cta-foreground hover:bg-cta/90" : ""}
                        onClick={() => {
                          setSelectedSlotId(slot.slot_id);
                          setSelectedSlotTime(fmtTime(slot.slot_time));
                        }}
                      >
                        {fmtTime(slot.slot_time)}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
              <Button
                className="flex-1 bg-cta text-cta-foreground hover:bg-cta/90"
                onClick={() => setStep(4)}
                disabled={!selectedDate || dateAvailable === false}
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-cta" />
              Review & Confirm
            </CardTitle>
            <CardDescription>Please review your booking details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-start p-4 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Vehicle</p>
                  <p className="font-semibold">{vehicle?.make} {vehicle?.model}</p>
                  <p className="text-sm text-muted-foreground">{vehicle?.plate_no}</p>
                </div>
                <Car className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex justify-between items-start p-4 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Service Package</p>
                  <p className="font-semibold">{pkg?.name}</p>
                  <p className="text-sm text-muted-foreground">{pkg ? fmtDuration(pkg.estimated_duration) : ""}</p>
                </div>
                <CheckCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex justify-between items-start p-4 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Date & Time</p>
                  <p className="font-semibold">
                    {new Date(selectedDate).toLocaleDateString("en-LK", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedSlotTime || "Time slot: To be confirmed"}
                  </p>
                </div>
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex justify-between items-center p-4 bg-cta/10 rounded-lg border-2 border-cta">
                <span className="font-semibold text-lg">Estimated Cost</span>
                <span className="text-2xl font-bold text-cta">
                  {pkg ? `LKR ${parseFloat(pkg.price).toLocaleString()}` : "—"}
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              By confirming, you agree to our terms and conditions. Final invoice may include additional charges for
              extra work discovered during service.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1">Back</Button>
              <Button
                className="flex-1 bg-cta text-cta-foreground hover:bg-cta/90"
                onClick={handleConfirm}
                disabled={isSubmitting}
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
    </div>
  );
}
