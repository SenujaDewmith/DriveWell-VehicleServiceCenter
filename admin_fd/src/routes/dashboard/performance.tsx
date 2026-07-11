import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { DateRangeFilter } from "@/components/reports/DateRangeFilter";
import { DownloadPdfButton } from "@/components/reports/DownloadPdfButton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Star } from "lucide-react";

export const Route = createFileRoute("/dashboard/performance")({
  component: PerformancePage,
});

interface StaffPerf {
  staff_id: number;
  full_name: string;
  email: string;
  jobs_completed: string;
  avg_rating: string | null;
  feedback_count: string;
}

function PerformancePage() {
  const [data, setData] = useState<StaffPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString() ? `?${params.toString()}` : "";
    api
      .get<{ staff_performance: StaffPerf[] }>(`/api/reports/staff-performance${qs}`)
      .then((d) => setData(d.staff_performance))
      .catch(() => setError("Failed to load performance data"))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(load, [load]);

  const chartData = data.map((s) => ({
    name: s.full_name.split(" ")[0],
    completed: parseInt(s.jobs_completed),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-extrabold tracking-tighter">STAFF PERFORMANCE</h1>
        <DownloadPdfButton elementId="performance-report-content" filename="drivewell-staff-performance-report.pdf" title="Staff Performance Report" />
      </div>

      <DateRangeFilter
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onClear={() => { setFrom(""); setTo(""); }}
      />

      {error && (
        <p className="text-xs font-mono text-destructive border border-destructive px-3 py-2">{error}</p>
      )}

      {loading ? (
        <div className="text-xs font-mono text-muted-foreground p-8">Loading...</div>
      ) : (
        <div id="performance-report-content" className="space-y-6 bg-background p-1">
          {data.length > 0 ? (
            <>
              <div className="border-2 border-border bg-card p-4">
                <h3 className="text-xs font-mono uppercase text-muted-foreground mb-4">
                  Jobs Completed
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 9, fontFamily: "DM Mono" }}
                      stroke="var(--color-muted-foreground)"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fontFamily: "DM Mono" }}
                      stroke="var(--color-muted-foreground)"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "2px solid var(--color-border)",
                        fontFamily: "DM Mono",
                        fontSize: 11,
                      }}
                    />
                    <Bar dataKey="completed" fill="#A7D129" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="border-2 border-border bg-card overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b-2 border-border">
                      <th className="text-left py-3 px-3 uppercase text-muted-foreground">
                        Staff Member
                      </th>
                      <th className="text-left py-3 px-3 uppercase text-muted-foreground">Completed</th>
                      <th className="text-left py-3 px-3 uppercase text-muted-foreground">Avg Rating</th>
                      <th className="text-left py-3 px-3 uppercase text-muted-foreground">
                        Feedback Count
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((s) => (
                      <tr key={s.staff_id} className="border-b border-border">
                        <td className="py-2 px-3 text-foreground">{s.full_name}</td>
                        <td className="py-2 px-3 text-foreground">{s.jobs_completed}</td>
                        <td className="py-2 px-3">
                          {s.avg_rating ? (
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 text-accent fill-accent" />
                              <span className="text-foreground">
                                {parseFloat(s.avg_rating).toFixed(1)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-foreground">{s.feedback_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="border-2 border-border bg-card p-8 text-center text-xs font-mono text-muted-foreground">
              No performance data available for this period.
            </div>
          )}
        </div>
      )}
    </div>
  );
}