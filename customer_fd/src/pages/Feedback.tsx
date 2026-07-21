import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bookingsService } from "@/services/bookings.service";
import { feedbackService } from "@/services/feedback.service";
import { Star, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

const FEEDBACK_ELIGIBLE_STATUSES = ["Completed", "Ready for Pickup"];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-LK", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function Feedback() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [selectedBookingId, setSelectedBookingId] = useState(() => searchParams.get("booking") ?? "");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: () => bookingsService.getBookings().then((r) => r.bookings),
    enabled: !!user,
  });
  const feedbackQuery = useQuery({
    queryKey: ["feedback"],
    queryFn: () => feedbackService.getFeedback().then((r) => r.feedback),
    enabled: !!user,
  });
  const bookings = bookingsQuery.data ?? [];
  const feedback = feedbackQuery.data ?? [];
  const loading = bookingsQuery.isPending || feedbackQuery.isPending;

  useEffect(() => {
    if (bookingsQuery.isError || feedbackQuery.isError) toast.error("Failed to load feedback data");
  }, [bookingsQuery.isError, feedbackQuery.isError]);

  const reviewedReservationIds = new Set(feedback.map((f) => f.reservation_id));
  const eligibleBookings = bookings.filter(
    (b) => FEEDBACK_ELIGIBLE_STATUSES.includes(b.status) && !reviewedReservationIds.has(b.reservation_id)
  );

  const effectiveSelectedId =
    selectedBookingId && eligibleBookings.some((b) => b.reservation_id.toString() === selectedBookingId)
      ? selectedBookingId
      : (eligibleBookings[0]?.reservation_id.toString() ?? "");

  const averageRating =
    feedback.length > 0 ? (feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length).toFixed(1) : "N/A";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveSelectedId) return;
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }
    setSubmitting(true);
    try {
      await feedbackService.submitFeedback({
        reservation_id: parseInt(effectiveSelectedId),
        rating,
        comment: comment.trim() || undefined,
      });
      toast.success("Thank you for your feedback!");
      setRating(0);
      setComment("");
      setSelectedBookingId("");
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Ratings & Feedback</h1>
        <p className="text-muted-foreground">Share your experience and help us improve</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-cta" />
        </div>
      ) : (
        <>
          <Card className="mb-8 border-2 border-cta/20 bg-cta/5">
            <CardContent className="py-8">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 mb-2">
                  <span className="text-5xl font-bold text-cta">{averageRating}</span>
                  <Star className="h-10 w-10 fill-cta text-cta" />
                </div>
                <p className="text-muted-foreground">
                  Average rating from {feedback.length} review{feedback.length !== 1 ? "s" : ""}
                </p>
              </div>
            </CardContent>
          </Card>

          {eligibleBookings.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Leave Feedback</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label>Which Service</Label>
                    <Select value={effectiveSelectedId} onValueChange={setSelectedBookingId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {eligibleBookings.map((b) => (
                          <SelectItem key={b.reservation_id} value={b.reservation_id.toString()}>
                            {b.package_name} — {b.make} {b.model} ({fmtDate(b.service_date)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-3">Rate Your Experience</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((r) => (
                        <button key={r} type="button" onClick={() => setRating(r)} className="group">
                          <Star
                            className={`h-10 w-10 transition-colors ${
                              r <= rating ? "fill-cta text-cta" : "text-muted-foreground group-hover:text-cta"
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
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-cta text-cta-foreground hover:bg-cta/90"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Submit Feedback
                      </>
                    )}
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
              {feedback.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No feedback submitted yet</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {feedback.map((f) => (
                    <div key={f.feedback_id} className="border-b border-border last:border-0 pb-6 last:pb-0">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold">
                            {f.make} {f.model} — {f.package_name}
                          </p>
                          <p className="text-sm text-muted-foreground">{fmtDate(f.service_date)}</p>
                        </div>
                        <div className="flex gap-1">
                          {Array.from({ length: f.rating }).map((_, i) => (
                            <Star key={i} className="h-5 w-5 fill-cta text-cta" />
                          ))}
                        </div>
                      </div>
                      {f.comment && <p className="text-muted-foreground italic">"{f.comment}"</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

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