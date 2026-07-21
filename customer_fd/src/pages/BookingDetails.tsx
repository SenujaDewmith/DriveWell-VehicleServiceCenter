import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { bookingsService, type Booking } from "@/services/bookings.service";
import { feedbackService } from "@/services/feedback.service";
import { CANCELLATION_CUTOFF_HOURS, canSelfCancel, bookingListTab } from "@/lib/bookingRules";
import { ArrowLeft, Car, Calendar, Clock, CheckCircle, Loader2, Wrench, FileText, Printer, Gauge } from "lucide-react";
import { toast } from "sonner";

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

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-LK", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
  const queryClient = useQueryClient();
  const reservationId = id ? parseInt(id) : undefined;
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  const bookingQuery = useQuery({
    queryKey: ["booking", reservationId],
    queryFn: () => bookingsService.getBooking(reservationId!).then((r) => r.booking),
    enabled: !!user && !!reservationId,
    // Seed from the already-fetched bookings list so arriving from /bookings renders
    // instantly with what we already know (vehicle/package/appointment/status), instead of
    // blanking the page — the list payload doesn't include service_record/invoice, so those
    // sections simply appear once the full fetch resolves, rather than gating the whole page.
    placeholderData: () =>
      queryClient.getQueryData<Booking[]>(["bookings"])?.find((b) => b.reservation_id === reservationId),
  });

  // Shares the ["feedback"] cache with the Feedback page — lets this page know whether
  // the booking's already been reviewed, so it doesn't offer a "Leave Feedback" button
  // that would just 400 ("Feedback already submitted for this booking") when clicked.
  const feedbackQuery = useQuery({
    queryKey: ["feedback"],
    queryFn: () => feedbackService.getFeedback().then((r) => r.feedback),
    enabled: !!user,
  });
  const hasFeedback = (feedbackQuery.data ?? []).some((f) => f.reservation_id === reservationId);
  const booking = bookingQuery.data ?? null;
  const loading = bookingQuery.isPending;
  const notFound = !id || bookingQuery.isError;

  const handleCancel = async () => {
    if (!booking) return;
    setCancelling(true);
    try {
      await bookingsService.cancelBooking(booking.reservation_id);
      queryClient.setQueryData<Booking>(["booking", reservationId], (prev) =>
        prev && { ...prev, status: "Cancelled" }
      );
      queryClient.setQueryData<Booking[]>(["bookings"], (prev) =>
        (prev ?? []).map((b) =>
          b.reservation_id === booking.reservation_id ? { ...b, status: "Cancelled" as const } : b
        )
      );
      toast.success("Booking cancelled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel");
    } finally {
      setCancelling(false);
    }
  };

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

  const invoice = booking.invoice;
  const serviceRecord = booking.service_record;
  const backToBookings = () => navigate(`/bookings?tab=${bookingListTab(booking.status)}`);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Button variant="ghost" onClick={backToBookings} className="mb-6">
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

      <div className="space-y-6">
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
              {booking.vehicle_type && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Vehicle Type</p>
                  <p className="font-semibold">{booking.vehicle_type}</p>
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
                <div className="text-right">
                  <p className="text-2xl font-bold text-cta">
                    LKR {parseFloat(booking.package_price).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Upwards — see invoice for final amount</p>
                </div>
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
                    {booking.slot_time
                      ? `${fmtTime(booking.slot_time)}${booking.slot_end_time ? ` - ${fmtTime(booking.slot_end_time)}` : ""}`
                      : "To be confirmed"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {serviceRecord && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Service Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-6 text-sm">
                {serviceRecord.started_at && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Started</p>
                    <p className="font-medium">{fmtDateTime(serviceRecord.started_at)}</p>
                  </div>
                )}
                {serviceRecord.completed_at && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Completed</p>
                    <p className="font-medium">{fmtDateTime(serviceRecord.completed_at)}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Quality Check</p>
                  <p className={`font-medium flex items-center gap-1 ${serviceRecord.quality_checked ? "text-cta" : "text-muted-foreground"}`}>
                    {serviceRecord.quality_checked ? (
                      <>
                        <CheckCircle className="h-4 w-4" /> Passed
                      </>
                    ) : (
                      "Pending"
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {serviceRecord?.remarks && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Supervisor's Remarks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{serviceRecord.remarks}</p>
            </CardContent>
          </Card>
        )}

        {serviceRecord?.has_oil_change && (
          <Card className="border-2 border-cta/20 bg-cta/5">
            <CardContent className="flex items-center gap-3 py-4">
              <Gauge className="h-5 w-5 text-cta shrink-0" />
              <p className="text-sm">
                Odometer at this service: <span className="font-medium">{serviceRecord.current_odometer?.toLocaleString() ?? "—"} km</span>
                {" — "}Next service due at{" "}
                <span className="font-semibold text-cta">{serviceRecord.next_service_odometer?.toLocaleString() ?? "—"} km</span>
              </p>
            </CardContent>
          </Card>
        )}

        {invoice && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Invoice
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge
                  variant="outline"
                  className={
                    invoice.payment_status === "Paid"
                      ? "bg-status-completed/10 text-status-completed border-status-completed/20"
                      : "bg-status-booked/10 text-status-booked border-status-booked/20"
                  }
                >
                  {invoice.payment_status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(invoice.generated_at).toLocaleDateString("en-LK")}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{booking.package_name}</span>
                  <span className="font-medium">LKR {parseFloat(invoice.base_amount).toLocaleString()}</span>
                </div>
                {invoice.items.map((item) => (
                  <div key={item.invoice_item_id} className="flex justify-between">
                    <span className="text-muted-foreground">
                      {item.description}{item.quantity > 1 ? ` ×${item.quantity}` : ""}
                    </span>
                    <span className="font-medium">LKR {parseFloat(item.line_total).toLocaleString()}</span>
                  </div>
                ))}
                {parseFloat(invoice.discount) > 0 && (
                  <div className="flex justify-between text-cta">
                    <span>Discount</span>
                    <span>-LKR {parseFloat(invoice.discount).toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between text-base font-bold pt-3 border-t">
                <span>Total</span>
                <span className="text-cta">LKR {parseFloat(invoice.total_amount).toLocaleString()}</span>
              </div>

              {invoice.payment_method && (
                <p className="text-xs text-muted-foreground">Paid via {invoice.payment_method}</p>
              )}
              {invoice.notes && (
                <p className="text-xs text-muted-foreground pt-3 border-t">{invoice.notes}</p>
              )}

              <Button variant="outline" className="w-full" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                Print Invoice
              </Button>
            </CardContent>
          </Card>
        )}

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

        {booking.status === "Booked" && (
          canSelfCancel(booking) ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full text-destructive hover:text-destructive" disabled={cancelling}>
                  Cancel Booking
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will cancel your {booking.package_name} appointment on {fmtDate(booking.service_date)}
                    {booking.slot_time ? ` at ${fmtTime(booking.slot_time)}` : ""}. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleCancel}
                  >
                    Yes, Cancel Booking
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <div className="space-y-1">
              <Button variant="outline" className="w-full" disabled>
                Cancel Booking
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Cancellations must be made at least {CANCELLATION_CUTOFF_HOURS}h ahead — please call us for urgent changes.
              </p>
            </div>
          )
        )}

        {booking.status === "Completed" || booking.status === "Ready for Pickup" ? (
          <div className="space-y-3">
            {hasFeedback && (
              <p className="text-sm text-muted-foreground text-center">You've already left feedback for this service.</p>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={backToBookings}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              {!hasFeedback && (
                <Button
                  className="flex-1 bg-cta text-cta-foreground hover:bg-cta/90"
                  onClick={() => navigate(`/feedback?booking=${booking.reservation_id}`)}
                >
                  Leave Feedback
                </Button>
              )}
            </div>
          </div>
        ) : (
          <Button variant="outline" className="w-full" onClick={backToBookings}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Bookings
          </Button>
        )}
      </div>
    </div>
  );
}