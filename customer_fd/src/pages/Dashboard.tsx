import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mockBookings, mockVehicles, mockPackages } from "@/data/mockData";
import { Car, Calendar, FileText, Clock, ArrowRight } from "lucide-react";
import { useEffect } from "react";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  if (!user) return null;

  const upcomingBookings = mockBookings.filter(
    (b) => b.status === "booked" || b.status === "in-progress"
  );
  const lastService = mockBookings.find((b) => b.status === "completed");

  const getStatusColor = (status: string) => {
    const colors = {
      booked: "bg-status-booked/10 text-status-booked border-status-booked/20",
      "in-progress": "bg-status-inProgress/10 text-status-inProgress border-status-inProgress/20",
      completed: "bg-status-completed/10 text-status-completed border-status-completed/20",
      ready: "bg-status-ready/10 text-status-ready border-status-ready/20",
      cancelled: "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/20",
    };
    return colors[status as keyof typeof colors] || "";
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Welcome back, {user.name}!</h1>
        <p className="text-muted-foreground text-lg">Manage your vehicles and services from your dashboard</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cta">{upcomingBookings.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Next: {upcomingBookings[0]?.date || "None"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Vehicles Registered</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cta">{mockVehicles.length}</div>
            <p className="text-xs text-muted-foreground mt-1">All vehicles active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Last Service</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cta">{lastService?.date || "N/A"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {lastService ? mockPackages.find((p) => p.id === lastService.packageId)?.name : "No services yet"}
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
            <Button
              className="h-24 flex flex-col items-center justify-center gap-2 bg-cta text-cta-foreground hover:bg-cta/90"
              onClick={() => navigate("/book")}
            >
              <Calendar className="h-6 w-6" />
              <span className="font-semibold">Book a Service</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2 border-2"
              onClick={() => navigate("/vehicles")}
            >
              <Car className="h-6 w-6" />
              <span className="font-semibold">Manage Vehicles</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2 border-2"
              onClick={() => navigate("/bookings")}
            >
              <Calendar className="h-6 w-6" />
              <span className="font-semibold">View Bookings</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2 border-2"
              onClick={() => navigate("/invoices")}
            >
              <FileText className="h-6 w-6" />
              <span className="font-semibold">View Invoices</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Bookings */}
      {upcomingBookings.length > 0 && (
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming Bookings</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/bookings")}>
              View All <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingBookings.map((booking) => {
                const vehicle = mockVehicles.find((v) => v.id === booking.vehicleId);
                const pkg = mockPackages.find((p) => p.id === booking.packageId);
                return (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/bookings/${booking.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-cta/10 rounded-lg flex items-center justify-center">
                        <Car className="h-6 w-6 text-cta" />
                      </div>
                      <div>
                        <p className="font-semibold">
                          {vehicle?.make} {vehicle?.model}
                        </p>
                        <p className="text-sm text-muted-foreground">{pkg?.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{booking.date}</p>
                      <p className="text-sm text-muted-foreground">{booking.timeSlot}</p>
                    </div>
                    <Badge variant="outline" className={getStatusColor(booking.status)}>
                      {booking.status.replace("-", " ")}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockBookings.slice(0, 3).flatMap((booking) =>
              booking.statusHistory.slice(-2).map((update, idx) => {
                const vehicle = mockVehicles.find((v) => v.id === booking.vehicleId);
                return (
                  <div key={`${booking.id}-${idx}`} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="h-3 w-3 rounded-full bg-cta" />
                      {idx !== 1 && <div className="w-0.5 h-full bg-border mt-1" />}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm font-medium">
                        {vehicle?.make} {vehicle?.model} - {update.status.replace("-", " ")}
                      </p>
                      <p className="text-sm text-muted-foreground">{update.note}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(update.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
