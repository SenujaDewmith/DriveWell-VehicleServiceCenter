import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { bookingsService, type Booking } from "@/services/bookings.service";
import { ArrowLeft, Car, Calendar, Clock, CheckCircle, Loader2 } from "lucide-react";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-LK", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function fmtDuration(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

type Status = Booking["status"];

const STATUS_COLORS: Record<Status, string> = {
  Booked: "bg-status-booked/10 text-status-booked border-status-booked/20",
  Started: "bg-status-inProgress/10 text-status-inProgress border-status-inProgress/20",
  "In Progress": "bg-status-inProgress/10 text-status-inProgress border-status-inProgress/20",
  "Ready for Pickup": "bg-status-ready/10 text-status-ready border-status-ready/20",
  Completed: "bg-status-completed/10 text-status-completed border-status-completed/20",
  Cancelled: "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/20",
  "No-show": "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/20",
};

export default function BookingDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (!id) { setNotFound(true); setLoading(false); return; }
    bookingsService.getBooking(parseInt(id))
      .then(({ booking }) => setBooking(booking))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id, user, navigate]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-cta" />
      </div>
    );
  }

  if (notFound || !booking) {
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
          <Badge variant="outline" className={`text-lg py-1 px-3 ${STATUS_COLORS[booking.status]}`}>
            {booking.status}
          </Badge>
        </div>
        <p className="text-muted-foreground">Ref: {booking.booking_ref}</p>
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
                <p className="font-semibold">{booking.make} {booking.model}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Plate Number</p>
                <p className="font-semibold">{booking.plate_no ?? "—"}</p>
              </div>
              {booking.color && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Color</p>
                  <p className="font-semibold">{booking.color}</p>
                </div>
              )}
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
                <p className="text-xl font-semibold mb-1">{booking.package_name}</p>
                {booking.estimated_duration && (
                  <p className="text-muted-foreground">Duration: {fmtDuration(booking.estimated_duration)}</p>
                )}
              </div>
              {booking.package_price && (
                <p className="text-2xl font-bold text-cta">
                  LKR {parseFloat(booking.package_price).toLocaleString()}
                </p>
              )}
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
                  <p className="text-sm text-muted-foreground">Service Date</p>
                  <p className="font-semibold">{fmtDate(booking.service_date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-cta/10 rounded-lg flex items-center justify-center">
                  <Clock className="h-5 w-5 text-cta" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Time Slot</p>
                  <p className="font-semibold">
                    {booking.slot_time ? fmtTime(booking.slot_time) : "To be confirmed"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-cta" />
              Current Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className={`text-base py-1 px-3 ${STATUS_COLORS[booking.status]}`}>
                {booking.status}
              </Badge>
              <p className="text-sm text-muted-foreground">
                Booked on {new Date(booking.created_at).toLocaleDateString("en-LK")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {(booking.status === "Completed" || booking.status === "Ready for Pickup") && (
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
