import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { api } from "@/lib/api";

// Matches MAX_FEATURED_FEEDBACK in backend/src/controllers/feedback.controller.js —
// the landing page's testimonials section only ever displays up to 4 entries.
const MAX_FEATURED_FEEDBACK = 4;

function Stars({ rating }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < rating ? "fill-accent text-accent" : "text-muted-foreground"}`}
        />
      ))}
    </div>
  );
}

export function FeedbackPage() {
  const [feedback, setFeedback] = useState([]);
  const [ratingFilter, setRatingFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const load = () => {
    setLoading(true);
    api
      .get("/api/feedback")
      .then((d) => setFeedback(d.feedback))
      .catch(() => setPageError("Failed to load feedback"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const featuredCount = feedback.filter((f) => f.is_featured).length;

  // Updates the affected row in place instead of calling load() — a full refetch
  // drops the table behind a "Loading..." placeholder, collapsing the page's
  // height and jumping the scroll position on a long list.
  const toggleFeatured = async (fb) => {
    if (!fb.is_featured && featuredCount >= MAX_FEATURED_FEEDBACK) {
      setPageError(
        `You've already selected ${MAX_FEATURED_FEEDBACK} testimonials. Unfeature one before adding another.`,
      );
      return;
    }
    setPageError("");
    try {
      if (fb.is_featured) {
        await api.patch(`/api/feedback/${fb.feedback_id}/unfeature`);
      } else {
        await api.patch(`/api/feedback/${fb.feedback_id}/feature`);
      }
      setFeedback((prev) =>
        prev.map((f) =>
          f.feedback_id === fb.feedback_id ? { ...f, is_featured: !f.is_featured } : f,
        ),
      );
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Toggle failed");
    }
  };

  const filteredFeedback = feedback.filter((f) => {
    if (ratingFilter === "Featured") return f.is_featured;
    if (ratingFilter !== "All") return f.rating === Number(ratingFilter);
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customer Feedback</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Feature up to {MAX_FEATURED_FEEDBACK} testimonials to show on the public landing page (
            {featuredCount}/{MAX_FEATURED_FEEDBACK} selected).
          </p>
        </div>
      </div>

      {pageError && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
          {pageError}
        </p>
      )}

      <div className="flex gap-1 flex-wrap">
        {["All", "Featured", "5", "4", "3", "2", "1"].map((f) => (
          <button
            key={f}
            onClick={() => setRatingFilter(f)}
            className={`rounded-md border px-2 py-1.5 text-sm font-medium transition-colors ${
              ratingFilter === f
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            {f === "All" ? "All" : f === "Featured" ? "Featured" : `${f} star`}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Rating</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Comment</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Package</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFeedback.map((fb) => (
                <tr
                  key={fb.feedback_id}
                  className="border-b border-border last:border-0 hover:bg-muted/20"
                >
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <p className="text-foreground font-semibold">{fb.customer_name ?? "—"}</p>
                      {fb.is_featured && (
                        <span
                          title="Featured on landing page"
                          className="flex items-center gap-0.5 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent"
                        >
                          <Star className="h-2.5 w-2.5 fill-accent" /> Featured
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs mt-0.5">{fb.booking_ref}</p>
                  </td>
                  <td className="py-3 px-3">
                    <Stars rating={fb.rating} />
                  </td>
                  <td className="py-3 px-3 text-foreground max-w-xs">
                    {fb.comment ? (
                      <p className="line-clamp-2">{fb.comment}</p>
                    ) : (
                      <span className="text-muted-foreground italic">No comment</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-foreground">{fb.package_name}</td>
                  <td className="py-3 px-3 text-muted-foreground">
                    {new Date(fb.submitted_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-3">
                    <button
                      onClick={() => toggleFeatured(fb)}
                      disabled={
                        !fb.is_featured && (featuredCount >= MAX_FEATURED_FEEDBACK || !fb.comment)
                      }
                      title={
                        fb.is_featured
                          ? "Remove from landing page"
                          : !fb.comment
                            ? "Feedback with no comment can't be featured"
                            : featuredCount >= MAX_FEATURED_FEEDBACK
                              ? `Already have ${MAX_FEATURED_FEEDBACK} testimonials selected`
                              : "Feature on landing page"
                      }
                      className={`p-1 text-muted-foreground hover:text-foreground ${
                        !fb.is_featured && (featuredCount >= MAX_FEATURED_FEEDBACK || !fb.comment)
                          ? "opacity-30 cursor-not-allowed hover:text-muted-foreground"
                          : ""
                      }`}
                    >
                      <Star
                        className={`h-4 w-4 ${fb.is_featured ? "fill-accent text-accent" : ""}`}
                      />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredFeedback.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    {feedback.length === 0
                      ? "No feedback submitted yet."
                      : `No feedback matches this filter.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
