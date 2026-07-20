import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Calendar, Car, Clock, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";

type BookingStatus = Booking["status"];

const STATUS_COLORS: Record<BookingStatus, string> = {
  Booked: "bg-status-booked/10 text-status-booked border-status-booked/20",
  Started: "bg-status-inProgress/10 text-status-inProgress border-status-inProgress/20",
  "In Progress": "bg-status-inProgress/10 text-status-inProgress border-status-inProgress/20",
  "Ready for Pickup": "bg-status-ready/10 text-status-ready border-status-ready/20",
  Completed: "bg-status-completed/10 text-status-completed border-status-completed/20",
  Cancelled: "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/20",
  "No-show": "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/20",
};

const UPCOMING: BookingStatus[] = ["Booked", "Started", "In Progress", "Ready for Pickup"];
const PAST: BookingStatus[] = ["Completed", "Cancelled", "No-show"];

// Must match CANCELLATION_CUTOFF_MINUTES in backend/src/controllers/bookings.controller.js —
// this only drives the UI's disabled state; the backend independently enforces the real rule.
const CANCELLATION_CUTOFF_HOURS = 24;

// slot_time is "HH:MM:SS"; combined with service_date ("YYYY-MM-DD") this parses as local time,
// matching how the rest of the app treats booking dates/times as local wall-clock values.
function hoursUntilAppointment(booking: Booking): number | null {
  if (!booking.slot_time) return null;
  const scheduledAt = new Date(`${booking.service_date}T${booking.slot_time}`);
  return (scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-LK", {
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

export default function Bookings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("upcoming");

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: () => bookingsService.getBookings().then((r) => r.bookings),
    enabled: !!user,
  });
  const bookings = bookingsQuery.data ?? [];
  const loading = bookingsQuery.isPending;

  useEffect(() => {
    if (bookingsQuery.isError) toast.error("Failed to load bookings");
  }, [bookingsQuery.isError]);

  const handleCancel = async (id: number) => {
    try {
      await bookingsService.cancelBooking(id);
      queryClient.setQueryData<Booking[]>(["bookings"], (prev) =>
        (prev ?? []).map((b) => (b.reservation_id === id ? { ...b, status: "Cancelled" as const } : b))
      );
      toast.success("Booking cancelled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel");
    }
  };

  if (!user) return null;

  const upcomingBookings = bookings.filter((b) => UPCOMING.includes(b.status));
  const pastBookings = bookings.filter((b) => PAST.includes(b.status));

  const BookingCard = ({ booking, showCancel }: { booking: Booking; showCancel?: boolean }) => (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex items-start gap-4 flex-1">
            <div className={`h-16 w-16 rounded-lg flex items-center justify-center shrink-0 ${showCancel ? "bg-cta/10" : "bg-muted"}`}>
              <Car className={`h-8 w-8 ${showCancel ? "text-cta" : "text-muted-foreground"}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-xl font-semibold">
                    {booking.make} {booking.model}
                  </h3>
                  <p className="text-muted-foreground">{booking.package_name}</p>
                  {booking.booking_ref && (
                    <p className="text-xs text-muted-foreground mt-1">Ref: {booking.booking_ref}</p>
                  )}
                </div>
                <Badge variant="outline" className={STATUS_COLORS[booking.status]}>
                  {booking.status}
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mt-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{fmtDate(booking.service_date)}</span>
                </div>
                {booking.slot_time && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{fmtTime(booking.slot_time)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 lg:w-48">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate(`/bookings/${booking.reservation_id}`)}
            >
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </Button>
            {showCancel && booking.status === "Booked" && (() => {
              const hoursUntil = hoursUntilAppointment(booking);
              const withinCutoff = hoursUntil !== null && hoursUntil < CANCELLATION_CUTOFF_HOURS;
              return withinCutoff ? (
                <div className="space-y-1">
                  <Button variant="outline" className="w-full" disabled>
                    Cancel Booking
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Cancellations must be made at least {CANCELLATION_CUTOFF_HOURS}h ahead — please call us for urgent changes.
                  </p>
                </div>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="w-full text-destructive hover:text-destructive">
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
                        onClick={() => handleCancel(booking.reservation_id)}
                      >
                        Yes, Cancel Booking
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              );
            })()}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">My Bookings</h1>
          <p className="text-muted-foreground">View and manage your service bookings</p>
        </div>
        <Button className="bg-cta text-cta-foreground hover:bg-cta/90" onClick={() => navigate("/book")}>
          <Calendar className="mr-2 h-4 w-4" />
          New Booking
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-cta" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="upcoming">Upcoming ({upcomingBookings.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({pastBookings.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            {upcomingBookings.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No upcoming bookings</h3>
                  <p className="text-muted-foreground mb-4">You don't have any scheduled services</p>
                  <Button className="bg-cta text-cta-foreground hover:bg-cta/90" onClick={() => navigate("/book")}>
                    Book a Service
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {upcomingBookings.map((b) => (
                  <BookingCard key={b.reservation_id} booking={b} showCancel />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past">
            {pastBookings.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Clock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No past bookings</h3>
                  <p className="text-muted-foreground">Your service history will appear here</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {pastBookings.map((b) => (
                  <BookingCard key={b.reservation_id} booking={b} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
