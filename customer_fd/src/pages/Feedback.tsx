import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { mockFeedback, mockBookings, mockVehicles, mockPackages } from "@/data/mockData";
import { Star, Send } from "lucide-react";
import { toast } from "sonner";

export default function Feedback() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedRating, setSelectedRating] = useState(0);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  const completedBookings = mockBookings.filter((b) => b.status === "completed");
  const averageRating =
    mockFeedback.length > 0
      ? (mockFeedback.reduce((sum, f) => sum + f.rating, 0) / mockFeedback.length).toFixed(1)
      : "N/A";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRating === 0) {
      toast.error("Please select a rating");
      return;
    }
    toast.success("Thank you for your feedback!");
    setSelectedRating(0);
    setComment("");
  };

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Ratings & Feedback</h1>
        <p className="text-muted-foreground">Share your experience and help us improve</p>
      </div>

      <Card className="mb-8 border-2 border-cta/20 bg-cta/5">
        <CardContent className="py-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 mb-2">
              <span className="text-5xl font-bold text-cta">{averageRating}</span>
              <Star className="h-10 w-10 fill-cta text-cta" />
            </div>
            <p className="text-muted-foreground">
              Average rating from {mockFeedback.length} review{mockFeedback.length !== 1 ? "s" : ""}
            </p>
          </div>
        </CardContent>
      </Card>

      {completedBookings.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Leave Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-3">Rate Your Experience</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setSelectedRating(rating)}
                      className="group"
                    >
                      <Star
                        className={`h-10 w-10 transition-colors ${
                          rating <= selectedRating
                            ? "fill-cta text-cta"
                            : "text-muted-foreground group-hover:text-cta"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="comment" className="block text-sm font-medium mb-2">
                  Your Comments
                </label>
                <Textarea
                  id="comment"
                  placeholder="Tell us about your experience..."
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-cta text-cta-foreground hover:bg-cta/90">
                <Send className="mr-2 h-4 w-4" />
                Submit Feedback
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your Past Feedback</CardTitle>
        </CardHeader>
        <CardContent>
          {mockFeedback.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No feedback submitted yet</p>
            </div>
          ) : (
            <div className="space-y-6">
              {mockFeedback.map((feedback) => {
                const booking = mockBookings.find((b) => b.id === feedback.bookingId);
                const vehicle = mockVehicles.find((v) => v.id === feedback.vehicleId);
                const pkg = booking ? mockPackages.find((p) => p.id === booking.packageId) : null;
                return (
                  <div key={feedback.id} className="border-b border-border last:border-0 pb-6 last:pb-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold">
                          {vehicle?.make} {vehicle?.model} - {pkg?.name}
                        </p>
                        <p className="text-sm text-muted-foreground">{feedback.date}</p>
                      </div>
                      <div className="flex gap-1">
                        {Array.from({ length: feedback.rating }).map((_, i) => (
                          <Star key={i} className="h-5 w-5 fill-cta text-cta" />
                        ))}
                      </div>
                    </div>
                    <p className="text-muted-foreground italic">"{feedback.comment}"</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-8 bg-muted/30">
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground text-center">
            Your feedback helps us improve our services and maintain the highest standards of quality. Thank you for
            taking the time to share your experience with us.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
