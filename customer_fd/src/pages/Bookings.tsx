import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockBookings, mockVehicles, mockPackages, BookingStatus } from "@/data/mockData";
import { Calendar, Car, Clock, MapPin, Eye } from "lucide-react";
import { toast } from "sonner";

export default function Bookings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("upcoming");

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

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

  const upcomingBookings = mockBookings.filter(
    (b) => b.status === "booked" || b.status === "in-progress" || b.status === "ready"
  );
  const pastBookings = mockBookings.filter((b) => b.status === "completed" || b.status === "cancelled");

  const handleCancel = (bookingId: string) => {
    toast.success("Booking cancelled successfully");
  };

  if (!user) return null;

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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="upcoming">
            Upcoming ({upcomingBookings.length})
          </TabsTrigger>
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
              {upcomingBookings.map((booking) => {
                const vehicle = mockVehicles.find((v) => v.id === booking.vehicleId);
                const pkg = mockPackages.find((p) => p.id === booking.packageId);
                return (
                  <Card key={booking.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row gap-6">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="h-16 w-16 bg-cta/10 rounded-lg flex items-center justify-center shrink-0">
                            <Car className="h-8 w-8 text-cta" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h3 className="text-xl font-semibold">
                                  {vehicle?.make} {vehicle?.model}
                                </h3>
                                <p className="text-muted-foreground">{pkg?.name}</p>
                              </div>
                              <Badge variant="outline" className={getStatusColor(booking.status)}>
                                {booking.status.replace("-", " ")}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mt-4">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                <span>{booking.date}</span>
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span>{booking.timeSlot}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 lg:w-48">
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => navigate(`/bookings/${booking.id}`)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </Button>
                          {booking.status === "booked" && (
                            <Button
                              variant="outline"
                              className="w-full text-destructive hover:text-destructive"
                              onClick={() => handleCancel(booking.id)}
                            >
                              Cancel Booking
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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
              {pastBookings.map((booking) => {
                const vehicle = mockVehicles.find((v) => v.id === booking.vehicleId);
                const pkg = mockPackages.find((p) => p.id === booking.packageId);
                return (
                  <Card key={booking.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row gap-6">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center shrink-0">
                            <Car className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h3 className="text-xl font-semibold">
                                  {vehicle?.make} {vehicle?.model}
                                </h3>
                                <p className="text-muted-foreground">{pkg?.name}</p>
                              </div>
                              <Badge variant="outline" className={getStatusColor(booking.status)}>
                                {booking.status.replace("-", " ")}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mt-4">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                <span>{booking.date}</span>
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span>{booking.timeSlot}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 lg:w-48">
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => navigate(`/bookings/${booking.id}`)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </Button>
                          <Button variant="outline" className="w-full" onClick={() => navigate("/invoices")}>
                            View Invoice
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
