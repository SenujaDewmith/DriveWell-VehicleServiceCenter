import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mockBookings, mockVehicles, mockPackages, BookingStatus } from "@/data/mockData";
import { ArrowLeft, Car, Calendar, Clock, CheckCircle } from "lucide-react";

export default function BookingDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

  const booking = mockBookings.find((b) => b.id === id);
  const vehicle = booking ? mockVehicles.find((v) => v.id === booking.vehicleId) : null;
  const pkg = booking ? mockPackages.find((p) => p.id === booking.packageId) : null;

  const getStatusColor = (status: BookingStatus) => {
    const colors = {
      booked: "bg-status-booked/10 text-status-booked border-status-booked/20",
      "in-progress": "bg-status-inProgress/10 text-status-inProgress border-status-inProgress/20",
      completed: "bg-status-completed/10 text-status-completed border-status-completed/20",
      ready: "bg-status-ready/10 text-status-ready border-status-ready/20",
      cancelled: "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/20",
    };
    return colors[status];
  };

  if (!user || !booking) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-xl mb-4">Booking not found</p>
            <Button onClick={() => navigate("/bookings")}>View All Bookings</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button variant="ghost" onClick={() => navigate("/bookings")} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Bookings
      </Button>

      <div className="mb-6">
        <div className="flex items-start justify-between mb-2">
          <h1 className="text-4xl font-bold">Booking Details</h1>
          <Badge variant="outline" className={`text-lg py-1 px-3 ${getStatusColor(booking.status)}`}>
            {booking.status.replace("-", " ")}
          </Badge>
        </div>
        <p className="text-muted-foreground">Booking ID: {booking.id}</p>
      </div>

      <div className="grid gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Vehicle Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Vehicle</p>
                <p className="font-semibold">
                  {vehicle?.make} {vehicle?.model}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Registration</p>
                <p className="font-semibold">{vehicle?.registration}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Year</p>
                <p className="font-semibold">{vehicle?.year}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Color</p>
                <p className="font-semibold">{vehicle?.color}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service Package</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xl font-semibold mb-1">{pkg?.name}</p>
                <p className="text-muted-foreground">{pkg?.description}</p>
              </div>
              <p className="text-2xl font-bold text-cta">${pkg?.price}</p>
            </div>
            <div className="space-y-2">
              {pkg?.features.map((feature) => (
                <div key={feature} className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-cta shrink-0 mt-0.5" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Appointment Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-cta/10 rounded-lg flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-cta" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-semibold">{booking.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-cta/10 rounded-lg flex items-center justify-center">
                  <Clock className="h-5 w-5 text-cta" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Time Slot</p>
                  <p className="font-semibold">{booking.timeSlot}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Service Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {booking.statusHistory.map((update, idx) => (
              <div key={idx} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`h-3 w-3 rounded-full ${idx === 0 ? "bg-cta" : "bg-muted"}`} />
                  {idx !== booking.statusHistory.length - 1 && (
                    <div className="w-0.5 h-full bg-border mt-1" />
                  )}
                </div>
                <div className="flex-1 pb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={getStatusColor(update.status)}>
                      {update.status.replace("-", " ")}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(update.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm">{update.note}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {booking.status === "completed" && (
        <div className="flex gap-4 mt-6">
          <Button
            className="flex-1 bg-cta text-cta-foreground hover:bg-cta/90"
            onClick={() => navigate("/invoices")}
          >
            View Invoice
          </Button>
          <Button className="flex-1" variant="outline" onClick={() => navigate("/feedback")}>
            Leave Feedback
          </Button>
        </div>
      )}
    </div>
  );
}
