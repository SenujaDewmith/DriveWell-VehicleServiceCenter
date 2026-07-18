import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge } from "@/components/manager/ManagerOverview";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Star } from "lucide-react";

interface MyService {
  reservation_id: number;
  booking_ref: string | null;
  service_date: string;
  status: string;
  customer_name: string | null;
  make: string | null;
  model: string | null;
  plate_no: string | null;
  package_name: string | null;
  work_note: string | null;
  rating: number | null;
}

interface Performance {
  jobs_completed: number;
  avg_rating: number | null;
  feedback_count: number;
  first_service: string | null;
  last_service: string | null;
}

interface RatingBreakdown {
  rating: number;
  count: number;
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function weekAgoKey() {
  const d = new Date(Date.now() - 7 * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function StaffDashboard() {
  const { username } = useAuth();
  const [period, setPeriod] = useState<"today" | "week" | "all">("all");
  const [services, setServices] = useState<MyService[]>([]);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [ratingBreakdown, setRatingBreakdown] = useState<RatingBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    const params =
      period === "today" ? `?from=${todayKey()}&to=${todayKey()}` :
      period === "week" ? `?from=${weekAgoKey()}` : "";

    Promise.all([
      api.get<{ services: MyService[] }>(`/api/staff/my-services${params}`),
      api.get<{ performance: Performance; rating_breakdown: RatingBreakdown[] }>(`/api/staff/my-performance${params}`),
    ])
      .then(([svc, perf]) => {
        setServices(svc.services);
        setPerformance(perf.performance);
        setRatingBreakdown(perf.rating_breakdown);
      })
      .catch(() => setError("Failed to load your service contributions"))
      .finally(() => setLoading(false));
  }, [period]);

  const chartData = [1, 2, 3, 4, 5].map((r) => ({
    rating: `${r} ★`,
    count: ratingBreakdown.find((b) => b.rating === r)?.count ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Dashboard</h1>
          <p className="text-sm text-muted-foreground">{username}</p>
        </div>
        <div className="flex gap-1">
          {(["today", "week", "all"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors capitalize ${
                period === p
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              }`}
            >
              {p === "all" ? "All Time" : p}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">{error}</p>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Contributions</p>
          <p className="text-2xl font-bold text-foreground mt-1">{services.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Jobs Completed</p>
          <p className="text-2xl font-bold text-foreground mt-1">{performance?.jobs_completed ?? 0}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Avg Rating</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-2xl font-bold text-foreground">{performance?.avg_rating ?? "N/A"}</p>
            {performance?.avg_rating != null && <Star className="h-5 w-5 text-accent fill-accent" />}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4">Customer Rating Breakdown</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="rating" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
            <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" allowDecimals={false} />
            <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="count" fill="#A7D129" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* My Contributions */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4">My Service Contributions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Ref</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Date</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Customer</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Vehicle</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Package</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">My Work</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Rating</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
              )}
              {!loading && services.map((s) => (
                <tr key={s.reservation_id} className="border-b border-border last:border-0">
                  <td className="py-2 px-2 text-muted-foreground">{s.booking_ref ?? `#${s.reservation_id}`}</td>
                  <td className="py-2 px-2 text-foreground">{s.service_date}</td>
                  <td className="py-2 px-2 text-foreground">{s.customer_name}</td>
                  <td className="py-2 px-2 text-foreground">{s.plate_no} — {s.make} {s.model}</td>
                  <td className="py-2 px-2 text-foreground">{s.package_name}</td>
                  <td className="py-2 px-2 text-foreground">{s.work_note ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-2 px-2"><StatusBadge status={s.status} /></td>
                  <td className="py-2 px-2">
                    {s.rating ? (
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-accent fill-accent" />
                        <span>{s.rating}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && services.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No service contributions in this period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
