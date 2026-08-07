import { useState, useEffect } from "react";
import { Star, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataCard, DataCardField } from "@/components/ui/data-card";

// Matches MAX_FEATURED_FEEDBACK in backend/src/controllers/feedback.controller.js —
// the landing page's testimonials section only ever displays up to 4 entries.
const MAX_FEATURED_FEEDBACK = 4;

const SORT_OPTIONS = [
  { value: "latest", label: "Date: Latest First" },
  { value: "earliest", label: "Date: Earliest First" },
];

function sortBySubmittedDate(list, order) {
  const sorted = [...list].sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
  return order === "latest" ? sorted.reverse() : sorted;
}

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
  const { role } = useAuth();
  // Featuring/unfeaturing is Manager-only on the backend (see managerOnly middleware in
  // feedback.routes.js) — Supervisor gets a view-only table, not just a disabled button,
  // since there's nothing for them to act on here.
  const canFeature = role === "manager";
  const [feedback, setFeedback] = useState([]);
  const [ratingFilter, setRatingFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("latest");
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
    if (ratingFilter === "Featured" && !f.is_featured) return false;
    if (ratingFilter !== "All" && ratingFilter !== "Featured" && f.rating !== Number(ratingFilter))
      return false;
    if (search && !(f.booking_ref ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const sortedFeedback = sortBySubmittedDate(filteredFeedback, sortOrder);
  const hasFilter = ratingFilter !== "All" || search !== "";
  const clearFilter = () => {
    setRatingFilter("All");
    setSearch("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customer Feedback</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {canFeature
              ? `Feature up to ${MAX_FEATURED_FEEDBACK} testimonials to show on the public landing page (${featuredCount}/${MAX_FEATURED_FEEDBACK} selected).`
              : "Ratings and comments customers left after their service."}
          </p>
        </div>
      </div>

      {pageError && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
          {pageError}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          placeholder="Search by booking ref..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring w-full sm:w-64"
        />
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
        <Select value={sortOrder} onValueChange={setSortOrder}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilter && (
          <button
            onClick={clearFilter}
            className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" /> Clear Filter
          </button>
        )}
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading...
        </div>
      ) : (
        <>
      {/* Desktop table — lg+ only; below that, the card list further down takes over. */}
      <div className="hidden lg:block rounded-lg border border-border bg-card overflow-x-auto scroll-fade-x">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Rating</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Comment</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Package</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Date</th>
                {canFeature && (
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedFeedback.map((fb) => (
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
                  {canFeature && (
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
                  )}
                </tr>
              ))}
              {sortedFeedback.length === 0 && (
                <tr>
                  <td colSpan={canFeature ? 6 : 5} className="py-8 text-center text-muted-foreground">
                    {feedback.length === 0
                      ? "No feedback submitted yet."
                      : `No feedback matches this filter.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
      </div>

      {/* Mobile/tablet card list — lg:hidden, mirrors the table above row-for-row. */}
      <div className="lg:hidden space-y-3">
        {sortedFeedback.map((fb) => (
          <DataCard key={fb.feedback_id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-foreground">{fb.customer_name ?? "—"}</p>
                  {fb.is_featured && (
                    <span
                      title="Featured on landing page"
                      className="flex items-center gap-0.5 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent"
                    >
                      <Star className="h-2.5 w-2.5 fill-accent" /> Featured
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{fb.booking_ref}</p>
              </div>
              <div className="shrink-0">
                <Stars rating={fb.rating} />
              </div>
            </div>

            <DataCardField
              label="Comment"
              value={
                fb.comment ? (
                  fb.comment
                ) : (
                  <span className="text-muted-foreground italic">No comment</span>
                )
              }
            />
            <DataCardField label="Package" value={fb.package_name} />
            <DataCardField label="Date" value={new Date(fb.submitted_at).toLocaleDateString()} />

            {canFeature && (
              <div className="flex items-center gap-1.5 pt-2 border-t border-border">
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
                  <Star className={`h-4 w-4 ${fb.is_featured ? "fill-accent text-accent" : ""}`} />
                </button>
              </div>
            )}
          </DataCard>
        ))}
        {sortedFeedback.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {feedback.length === 0 ? "No feedback submitted yet." : `No feedback matches this filter.`}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}
