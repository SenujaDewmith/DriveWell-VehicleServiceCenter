import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { bookingsService, type Booking } from "@/services/bookings.service";
import { vehiclesService } from "@/services/vehicles.service";
import { fmtTime } from "@/lib/time";
import { ArrowLeft, Calendar, Car, ChevronRight, Clock, Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-LK", {
    year: "numeric",
    month: "long",
    day: "numeric",
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

export default function VehicleServiceHistory() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const vehicleId = id ? parseInt(id) : undefined;

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  // Same query key Vehicles.tsx uses, so arriving from there is normally a cache hit —
  // also doubles as the ownership check: this list is already scoped to the customer's
  // own vehicles, so a missing id here means "not yours" as much as "doesn't exist".
  const vehiclesQuery = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => vehiclesService.getVehicles().then((r) => r.vehicles),
    enabled: !!user,
  });
  const vehicle = vehiclesQuery.data?.find((v) => v.vehicle_id === vehicleId);

  const historyQuery = useQuery({
    queryKey: ["bookings", "vehicle-history", vehicleId],
    queryFn: () => bookingsService.getVehicleHistory(vehicleId!).then((r) => r.bookings),
    enabled: !!user && !!vehicleId && !!vehicle,
  });

  useEffect(() => {
    if (historyQuery.isError) toast.error("Failed to load service history");
  }, [historyQuery.isError]);

  if (!user) return null;

  const loading = vehiclesQuery.isPending || (!!vehicle && historyQuery.isPending);
  const notFound = !id || (vehiclesQuery.isSuccess && !vehicle) || historyQuery.isError;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-cta" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-xl mb-4">Vehicle not found</p>
            <Button onClick={() => navigate("/vehicles")}>Back to My Vehicles</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const bookings = historyQuery.data ?? [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button variant="ghost" onClick={() => navigate("/vehicles")} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to My Vehicles
      </Button>

      <div className="mb-6">
        <h1 className="text-4xl font-bold mb-2">Service History</h1>
        <p className="text-muted-foreground flex items-center gap-2">
          <Car className="h-4 w-4" />
          {vehicle?.make} {vehicle?.model} — {vehicle?.plate_no}
        </p>
      </div>

      {bookings.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Wrench className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No service history yet</h3>
            <p className="text-muted-foreground">This vehicle hasn't had any bookings yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const beforeOwnership = booking.customer_id !== undefined && String(booking.customer_id) !== user.id;
            return (
              <Card
                key={booking.reservation_id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/bookings/${booking.reservation_id}`)}
              >
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{booking.package_name}</span>
                      <Badge variant="outline" className={STATUS_COLORS[booking.status]}>
                        {booking.status}
                      </Badge>
                      {beforeOwnership && (
                        <Badge variant="outline" className="text-muted-foreground">
                          Before your ownership
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {fmtDate(booking.service_date)}
                      </span>
                      {booking.slot_time && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {fmtTime(booking.slot_time)}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
