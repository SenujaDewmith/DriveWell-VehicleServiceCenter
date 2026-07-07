import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockVehicles, mockPackages } from "@/data/mockData";
import { Calendar, Car, Clock, DollarSign, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function BookService() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedPackage = searchParams.get("package");

  const [step, setStep] = useState(1);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedPackage, setSelectedPackage] = useState(preselectedPackage || "");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  const timeSlots = [
    "8:00 AM",
    "9:00 AM",
    "10:00 AM",
    "11:00 AM",
    "12:00 PM",
    "1:00 PM",
    "2:00 PM",
    "3:00 PM",
    "4:00 PM",
    "5:00 PM",
  ];

  const dates = Array.from({ length: 14 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i + 1);
    return date.toISOString().split("T")[0];
  });

  const handleNext = () => {
    if (step === 1 && !selectedVehicle) {
      toast.error("Please select a vehicle");
      return;
    }
    if (step === 2 && !selectedPackage) {
      toast.error("Please select a service package");
      return;
    }
    if (step === 3 && (!selectedDate || !selectedTimeSlot)) {
      toast.error("Please select date and time");
      return;
    }
    if (step < 4) {
      setStep(step + 1);
    }
  };

  const handleConfirm = () => {
    toast.success("Booking confirmed! Redirecting to your bookings...");
    setTimeout(() => navigate("/bookings"), 1500);
  };

  const vehicle = mockVehicles.find((v) => v.id === selectedVehicle);
  const pkg = mockPackages.find((p) => p.id === selectedPackage);

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8 text-center">Book a Service</h1>

      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= s ? "bg-cta text-cta-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {s}
              </div>
              {s < 4 && (
                <div
                  className={`flex-1 h-1 mx-2 ${step > s ? "bg-cta" : "bg-muted"}`}
                />
              )}
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
            {mockVehicles.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">You haven't added any vehicles yet</p>
                <Button onClick={() => navigate("/vehicles")} variant="outline">
                  Add a Vehicle
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {mockVehicles.map((vehicle) => (
                  <Card
                    key={vehicle.id}
                    className={`cursor-pointer transition-all ${
                      selectedVehicle === vehicle.id ? "border-cta border-2 bg-cta/5" : "hover:border-cta/50"
                    }`}
                    onClick={() => setSelectedVehicle(vehicle.id)}
                  >
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="h-12 w-12 bg-cta/10 rounded-lg flex items-center justify-center">
                        <Car className="h-6 w-6 text-cta" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{vehicle.nickname}</p>
                        <p className="text-sm text-muted-foreground">
                          {vehicle.make} {vehicle.model} • {vehicle.year}
                        </p>
                      </div>
                      {selectedVehicle === vehicle.id && (
                        <CheckCircle className="h-6 w-6 text-cta" />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <Button
              className="w-full bg-cta text-cta-foreground hover:bg-cta/90"
              onClick={handleNext}
              disabled={!selectedVehicle}
            >
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Select Service Package
            </CardTitle>
            <CardDescription>Choose the service package that fits your needs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              {mockPackages.map((pkg) => (
                <Card
                  key={pkg.id}
                  className={`cursor-pointer transition-all ${
                    selectedPackage === pkg.id ? "border-cta border-2 bg-cta/5" : "hover:border-cta/50"
                  }`}
                  onClick={() => setSelectedPackage(pkg.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-lg">{pkg.name}</h3>
                        <p className="text-sm text-muted-foreground">{pkg.description}</p>
                      </div>
                      {selectedPackage === pkg.id && (
                        <CheckCircle className="h-6 w-6 text-cta shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-2xl font-bold text-cta">${pkg.price}</span>
                      <span className="text-muted-foreground">• {pkg.duration}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button
                className="flex-1 bg-cta text-cta-foreground hover:bg-cta/90"
                onClick={handleNext}
                disabled={!selectedPackage}
              >
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
              <Select value={selectedDate} onValueChange={setSelectedDate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a date" />
                </SelectTrigger>
                <SelectContent>
                  {dates.map((date) => (
                    <SelectItem key={date} value={date}>
                      {new Date(date).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Time Slot</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {timeSlots.map((slot) => (
                  <Button
                    key={slot}
                    variant={selectedTimeSlot === slot ? "default" : "outline"}
                    className={
                      selectedTimeSlot === slot ? "bg-cta text-cta-foreground hover:bg-cta/90" : ""
                    }
                    onClick={() => setSelectedTimeSlot(slot)}
                  >
                    {slot}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                Back
              </Button>
              <Button
                className="flex-1 bg-cta text-cta-foreground hover:bg-cta/90"
                onClick={handleNext}
                disabled={!selectedDate || !selectedTimeSlot}
              >
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                  <p className="font-semibold">
                    {vehicle?.make} {vehicle?.model}
                  </p>
                  <p className="text-sm text-muted-foreground">{vehicle?.registration}</p>
                </div>
                <Car className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex justify-between items-start p-4 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Service Package</p>
                  <p className="font-semibold">{pkg?.name}</p>
                  <p className="text-sm text-muted-foreground">{pkg?.description}</p>
                </div>
                <DollarSign className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex justify-between items-start p-4 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Date & Time</p>
                  <p className="font-semibold">
                    {new Date(selectedDate).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedTimeSlot}</p>
                </div>
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex justify-between items-center p-4 bg-cta/10 rounded-lg border-2 border-cta">
                <span className="font-semibold text-lg">Estimated Cost</span>
                <span className="text-2xl font-bold text-cta">${pkg?.price}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              By confirming, you agree to our terms and conditions. Final invoice may include additional charges for
              extra work discovered during service.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(3)} className="flex-1">
                Back
              </Button>
              <Button
                className="flex-1 bg-cta text-cta-foreground hover:bg-cta/90"
                onClick={handleConfirm}
              >
                Confirm Booking
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
