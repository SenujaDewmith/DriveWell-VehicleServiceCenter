import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DatePickerCalendar } from "@/components/ui/calendar";
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
import { toDateKey } from "@/components/BookingCalendar";
import { CANCELLATION_CUTOFF_HOURS, hoursUntilAppointment, UPCOMING_STATUSES, PAST_STATUSES } from "@/lib/bookingRules";
import { Calendar, Car, Clock, Eye, Loader2 } from "lucide-react";
import { format } from "date-fns";
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

const UPCOMING = UPCOMING_STATUSES;
const PAST = PAST_STATUSES;

// Inverse of toDateKey — builds a local-midnight Date from a "YYYY-MM-DD" key so it
// round-trips safely regardless of the browser's timezone offset.
function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
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
  const [searchParams, setSearchParams] = useSearchParams();
  // Tab lives in the URL (not just component state) so "Back to Bookings" from a
  // booking's detail page can land on the tab that booking actually belongs to,
  // and so the tab survives a refresh or a shared link.
  const activeTab = searchParams.get("tab") === "past" ? "past" : "upcoming";
  const setActiveTab = (tab: string) => {
    setSearchParams(tab === "past" ? { tab: "past" } : {}, { replace: true });
  };
  const [packageFilter, setPackageFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [fromPickerOpen, setFromPickerOpen] = useState(false);
  const [toPickerOpen, setToPickerOpen] = useState(false);

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

  const pastPackageOptions = Array.from(
    new Set(pastBookings.map((b) => b.package_name).filter((name): name is string => !!name))
  ).sort();

  const filtersActive = packageFilter !== "all" || !!dateFrom || !!dateTo;

  const filteredPastBookings = pastBookings.filter((b) => {
    if (packageFilter !== "all" && b.package_name !== packageFilter) return false;
    if (dateFrom && b.service_date < dateFrom) return false;
    if (dateTo && b.service_date > dateTo) return false;
    return true;
  });

  const clearFilters = () => {
    setPackageFilter("all");
    setDateFrom("");
    setDateTo("");
  };

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
                <Card>
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-end gap-4">
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Package</Label>
                      <Select value={packageFilter} onValueChange={setPackageFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Packages</SelectItem>
                          {pastPackageOptions.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">From</Label>
                      <Popover open={fromPickerOpen} onOpenChange={setFromPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`w-full justify-start text-left font-normal ${!dateFrom ? "text-muted-foreground" : ""}`}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {dateFrom ? format(parseDateKey(dateFrom), "PP") : "Any date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <DatePickerCalendar
                            mode="single"
                            selected={dateFrom ? parseDateKey(dateFrom) : undefined}
                            onSelect={(date) => {
                              setDateFrom(date ? toDateKey(date) : "");
                              setFromPickerOpen(false);
                            }}
                            disabled={dateTo ? { after: parseDateKey(dateTo) } : undefined}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">To</Label>
                      <Popover open={toPickerOpen} onOpenChange={setToPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`w-full justify-start text-left font-normal ${!dateTo ? "text-muted-foreground" : ""}`}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {dateTo ? format(parseDateKey(dateTo), "PP") : "Any date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <DatePickerCalendar
                            mode="single"
                            selected={dateTo ? parseDateKey(dateTo) : undefined}
                            onSelect={(date) => {
                              setDateTo(date ? toDateKey(date) : "");
                              setToPickerOpen(false);
                            }}
                            disabled={dateFrom ? { before: parseDateKey(dateFrom) } : undefined}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    {filtersActive && (
                      <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground">
                        Clear Filters
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {filteredPastBookings.length === 0 ? (
                  <Card className="text-center py-12">
                    <CardContent>
                      <Clock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">No bookings match your filters</h3>
                      <p className="text-muted-foreground mb-4">Try adjusting the package or date range</p>
                      <Button variant="outline" onClick={clearFilters}>
                        Clear Filters
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {filteredPastBookings.map((b) => (
                      <BookingCard key={b.reservation_id} booking={b} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
