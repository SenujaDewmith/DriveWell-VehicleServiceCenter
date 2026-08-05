import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { bookingsService } from "@/services/bookings.service";
import { vehiclesService } from "@/services/vehicles.service";
import { ACTIVE_SERVICE_STATUSES, isUpcomingBooking } from "@/lib/bookingRules";
import { Car, Calendar, FileText, Clock, ArrowRight, Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
const STATUS_COLORS = {
    Booked: "bg-status-booked/10 text-status-booked border-status-booked/20",
    Started: "bg-status-inProgress/10 text-status-inProgress border-status-inProgress/20",
    Completed: "bg-status-completed/10 text-status-completed border-status-completed/20",
    Collected: "bg-status-completed/10 text-status-completed border-status-completed/20",
    Cancelled: "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/20",
    "No-show": "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/20",
};
function fmtDate(d) {
    return new Date(d).toLocaleDateString("en-LK", { year: "numeric", month: "short", day: "numeric" });
}
function fmtDateTime(d) {
    return new Date(d).toLocaleString("en-LK", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
// Shared row layout for the Active Services and Upcoming Bookings cards below.
function BookingRow({ booking, navigate }) {
    return (<div className="flex items-center justify-between gap-4 p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/bookings/${booking.reservation_id}`)}>
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="h-12 w-12 bg-cta/10 rounded-lg flex items-center justify-center shrink-0">
          <Car className="h-6 w-6 text-cta"/>
        </div>
        <div className="min-w-0">
          <p className="font-semibold truncate">
            {booking.make} {booking.model}
          </p>
          <p className="text-sm text-muted-foreground truncate">{booking.package_name}</p>
        </div>
      </div>
      <div className="text-right w-28 shrink-0">
        <p className="text-sm font-medium">{fmtDate(booking.service_date)}</p>
        <p className="text-sm text-muted-foreground">
          {booking.slot_time ? booking.slot_time.slice(0, 5) : "To be confirmed"}
        </p>
      </div>
      <Badge variant="outline" className={`shrink-0 w-28 justify-center ${STATUS_COLORS[booking.status]}`}>
        {booking.status}
      </Badge>
    </div>);
}
export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [bookings, setBookings] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        if (!user)
            navigate("/login");
    }, [user, navigate]);
    // Loads both lists together — the dashboard needs both before it can show anything useful,
    // so one shared loading/error state is simpler than tracking each fetch separately.
    useEffect(() => {
        if (!user)
            return;
        let cancelled = false;
        setLoading(true);
        Promise.all([bookingsService.getBookings(), vehiclesService.getVehicles()])
            .then(([bookingsRes, vehiclesRes]) => {
            if (cancelled)
                return;
            setBookings(bookingsRes.bookings);
            setVehicles(vehiclesRes.vehicles);
        })
            .catch(() => {
            if (!cancelled)
                toast.error("Failed to load dashboard data");
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [user]);
    if (!user)
        return null;
    const upcomingBookings = bookings
        .filter(isUpcomingBooking)
        .sort((a, b) => new Date(a.service_date).getTime() - new Date(b.service_date).getTime());
    const activeServiceBookings = bookings
        .filter((b) => ACTIVE_SERVICE_STATUSES.includes(b.status))
        .sort((a, b) => new Date(a.service_date).getTime() - new Date(b.service_date).getTime());
    const lastService = bookings
        .filter((b) => b.status === "Completed")
        .sort((a, b) => new Date(b.service_date).getTime() - new Date(a.service_date).getTime())[0];
    const recentActivity = [...bookings]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);
    return (<div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Welcome back, {user.name}!</h1>
        <p className="text-muted-foreground text-lg">Manage your vehicles and services from your dashboard</p>
      </div>

      {loading ? (<div className="flex justify-center items-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-cta"/>
        </div>) : (<>
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Upcoming Bookings</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground"/>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-cta">{upcomingBookings.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Next: {upcomingBookings[0] ? fmtDate(upcomingBookings[0].service_date) : "None"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Vehicles Registered</CardTitle>
                <Car className="h-4 w-4 text-muted-foreground"/>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-cta">{vehicles.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {vehicles.length > 0 ? "All vehicles active" : "No vehicles added yet"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Last Service</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground"/>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-cta">
                  {lastService ? fmtDate(lastService.service_date) : "N/A"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {lastService ? lastService.package_name : "No services yet"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Button className="h-24 flex flex-col items-center justify-center gap-2 bg-cta text-cta-foreground hover:bg-cta/90" onClick={() => navigate("/book")}>
                  <Calendar className="h-6 w-6"/>
                  <span className="font-semibold">Book a Service</span>
                </Button>
                <Button variant="outline" className="h-24 flex flex-col items-center justify-center gap-2 border-2" onClick={() => navigate("/vehicles")}>
                  <Car className="h-6 w-6"/>
                  <span className="font-semibold">Manage Vehicles</span>
                </Button>
                <Button variant="outline" className="h-24 flex flex-col items-center justify-center gap-2 border-2" onClick={() => navigate("/bookings")}>
                  <Calendar className="h-6 w-6"/>
                  <span className="font-semibold">View Bookings</span>
                </Button>
                <Button variant="outline" className="h-24 flex flex-col items-center justify-center gap-2 border-2" onClick={() => navigate("/invoices")}>
                  <FileText className="h-6 w-6"/>
                  <span className="font-semibold">View Invoices</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Active Services — vehicle is physically at the shop right now, so this
              takes priority over merely-scheduled upcoming appointments below. */}
          {activeServiceBookings.length > 0 && (<Card className="mb-8">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-cta"/> Active Services
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/bookings")}>
                  View All <ArrowRight className="ml-2 h-4 w-4"/>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activeServiceBookings.slice(0, 5).map((booking) => (<BookingRow key={booking.reservation_id} booking={booking} navigate={navigate}/>))}
                </div>
              </CardContent>
            </Card>)}

          {/* Upcoming Bookings */}
          {upcomingBookings.length > 0 && (<Card className="mb-8">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Upcoming Bookings</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/bookings")}>
                  View All <ArrowRight className="ml-2 h-4 w-4"/>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {upcomingBookings.slice(0, 5).map((booking) => (<BookingRow key={booking.reservation_id} booking={booking} navigate={navigate}/>))}
                </div>
              </CardContent>
            </Card>)}

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (<p className="text-sm text-muted-foreground">No activity yet — book your first service to get started.</p>) : (<div className="space-y-4">
                  {recentActivity.map((booking, idx) => (<div key={booking.reservation_id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="h-3 w-3 rounded-full bg-cta"/>
                        {idx !== recentActivity.length - 1 && <div className="w-0.5 h-full bg-border mt-1"/>}
                      </div>
                      <div role="button" tabIndex={0} className="flex-1 pb-4 -m-2 p-2 rounded-lg cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate(`/bookings/${booking.reservation_id}`)} onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/bookings/${booking.reservation_id}`);
                        }
                    }}>
                        <p className="text-sm font-medium">
                          {booking.make} {booking.model} — {booking.status}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {booking.package_name} · Ref: {booking.booking_ref}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{fmtDateTime(booking.created_at)}</p>
                      </div>
                    </div>))}
                </div>)}
            </CardContent>
          </Card>
        </>)}
    </div>);
}
