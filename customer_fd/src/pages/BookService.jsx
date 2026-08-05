import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { vehiclesService } from "@/services/vehicles.service";
import { servicesService } from "@/services/services.service";
import { bookingsService } from "@/services/bookings.service";
import { AddVehicleDialog } from "@/components/AddVehicleDialog";
import { TermsDialog } from "@/components/TermsDialog";
import { AuthModal } from "@/components/auth/AuthModal";
import { BookingStepper, PackageStep, DateTimeStep, VehicleStep, ReviewStep } from "@/components/booking";
import { useAvailableSlots } from "@/hooks/useAvailableSlots";
import { TERMS_VERSION } from "@/lib/terms";
import { fmtTime } from "@/lib/time";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
const STEPS = [
    { number: 1, label: "Package" },
    { number: 2, label: "Vehicle" },
    { number: 3, label: "Date & Time" },
    { number: 4, label: "Confirm" },
];
export default function BookService() {
    const { user, isLoading } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const preselectedPackage = searchParams.get("package");
    const [step, setStep] = useState(1);
    const [selectedVehicleId, setSelectedVehicleId] = useState(null);
    const [selectedPackageId, setSelectedPackageId] = useState(null);
    const [selectedDate, setSelectedDate] = useState("");
    const [selectedStartTime, setSelectedStartTime] = useState(null);
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
        if (!isLoading && !user)
            setAuthModalOpen(true);
    }, [isLoading, user]);
    // If the session goes away mid-flow (expired cookie, logged out in another tab —
    // caught here via the same 401 that clears `user`), the wizard's own step/selection
    // state is plain useState and wouldn't otherwise reset: without this, the user is
    // left staring at a stale "Date & Time" step whose data just failed to load, with
    // the sign-in modal stacked on top of it instead of a clean step 1.
    useEffect(() => {
        if (!isLoading && !user) {
            setStep(1);
            setSelectedVehicleId(null);
            setSelectedPackageId(null);
            setSelectedDate("");
            setSelectedStartTime(null);
            setSelectedSlotTime("");
            setTermsAccepted(false);
        }
    }, [isLoading, user]);
    const [vehicles, setVehicles] = useState([]);
    const [packages, setPackages] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);
    useEffect(() => {
        if (!user)
            return;
        let cancelled = false;
        setDataLoading(true);
        Promise.all([vehiclesService.getVehicles(), servicesService.getPackages()])
            .then(([vehiclesRes, packagesRes]) => {
            if (cancelled)
                return;
            setVehicles(vehiclesRes.vehicles);
            setPackages(packagesRes.packages);
        })
            .catch(() => {
            if (!cancelled)
                toast.error("Failed to load data");
        })
            .finally(() => {
            if (!cancelled)
                setDataLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [user]);
    // Pre-select the package passed via ?package= once its data has loaded (runs once — bails
    // out as soon as a package is selected, whether by this effect or by the user). The user
    // already chose this package from the landing/services page, so skip straight past the
    // now-redundant package step to Vehicle.
    useEffect(() => {
        if (!preselectedPackage || selectedPackageId || packages.length === 0)
            return;
        const match = packages.find((p) => p.package_id.toString() === preselectedPackage);
        if (match) {
            setSelectedPackageId(match.package_id);
            setStep(2);
        }
    }, [preselectedPackage, packages, selectedPackageId]);
    // Clear any previously-picked slot whenever the date, package, or vehicle changes — covers
    // picking a new date, going back to pick a different (differently-timed) package, and
    // switching vehicles (availability is vehicle-specific, so a slot valid for one vehicle
    // may not be valid for another).
    useEffect(() => {
        setSelectedStartTime(null);
        setSelectedSlotTime("");
    }, [selectedDate, selectedPackageId, selectedVehicleId]);
    const { slots, dateAvailable, isLoading: slotsLoading } = useAvailableSlots(selectedDate, selectedPackageId, selectedVehicleId);
    const handleSelectSlot = (slot) => {
        setSelectedStartTime(slot.start_time);
        setSelectedSlotTime(`${fmtTime(slot.start_time)} - ${fmtTime(slot.end_time)}`);
    };
    const handleConfirm = async () => {
        if (!selectedVehicleId || !selectedPackageId || !selectedDate || !selectedStartTime || !termsAccepted)
            return;
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
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Booking failed");
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const handleVehicleAdded = (vehicle) => {
        setVehicles((prev) => [vehicle, ...prev]);
        setSelectedVehicleId(vehicle.vehicle_id);
    };
    const vehicle = vehicles.find((v) => v.vehicle_id === selectedVehicleId);
    const pkg = packages.find((p) => p.package_id === selectedPackageId);
    // Mirrors ProtectedRoute's loading guard — /book is intentionally NOT wrapped in
    // ProtectedRoute (see App.tsx) so an unauthenticated visit renders this page with
    // an AuthModal instead of bouncing to /login.
    if (isLoading) {
        return (<div className="flex justify-center items-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-cta"/>
      </div>);
    }
    return (<div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-5 text-center">Book a Service</h1>

      <BookingStepper steps={STEPS} currentStep={step}/>

      {step === 1 && (<PackageStep packages={packages} selectedPackageId={selectedPackageId} onSelect={setSelectedPackageId} onContinue={() => setStep(2)}/>)}

      {step === 2 && (<VehicleStep vehicles={vehicles} dataLoading={dataLoading} selectedVehicleId={selectedVehicleId} onSelect={setSelectedVehicleId} onAddVehicle={() => setAddVehicleOpen(true)} onBack={() => setStep(1)} onContinue={() => setStep(3)}/>)}

      {step === 3 && selectedPackageId && (<DateTimeStep packageId={selectedPackageId} pkg={pkg} selectedDate={selectedDate} onSelectDate={setSelectedDate} slots={slots} slotsLoading={slotsLoading} dateAvailable={dateAvailable} selectedStartTime={selectedStartTime} onSelectSlot={handleSelectSlot} onBack={() => setStep(2)} onContinue={() => setStep(4)}/>)}

      {step === 4 && (<ReviewStep vehicle={vehicle} pkg={pkg} selectedDate={selectedDate} selectedSlotTime={selectedSlotTime} termsAccepted={termsAccepted} onTermsAcceptedChange={setTermsAccepted} onOpenTerms={() => setTermsOpen(true)} isSubmitting={isSubmitting} onBack={() => setStep(3)} onConfirm={handleConfirm}/>)}

      <AddVehicleDialog open={addVehicleOpen} onOpenChange={setAddVehicleOpen} onVehicleAdded={handleVehicleAdded}/>

      <TermsDialog open={termsOpen} onOpenChange={setTermsOpen} onAgree={() => {
            setTermsAccepted(true);
            setTermsOpen(false);
        }}/>

      <AuthModal open={authModalOpen} onOpenChange={(open) => {
            setAuthModalOpen(open);
            // Dismissed without signing in — there's nothing to book on this page
            // yet, so send them somewhere useful instead of leaving them stranded.
            if (!open && !user)
                navigate("/services");
        }} onSuccess={() => setAuthModalOpen(false)} title="Sign in to book a service" description="Sign in or create an account to pick your vehicle, package, and time slot."/>
    </div>);
}
