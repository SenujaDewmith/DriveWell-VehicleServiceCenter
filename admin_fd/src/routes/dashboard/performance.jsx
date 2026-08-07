import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { DateRangeFilter } from "@/components/reports/DateRangeFilter";
import { DownloadPdfButton } from "@/components/reports/DownloadPdfButton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Star } from "lucide-react";
import { DataCard, DataCardField } from "@/components/ui/data-card";

export function PerformancePage() {
  const [data, setData] = useState([]);
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
      .get(`/api/reports/staff-performance${qs}`)
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
        <h1 className="text-2xl font-bold text-foreground">Staff Performance</h1>
        <DownloadPdfButton
          elementId="performance-report-content"
          filename="drivewell-staff-performance-report.pdf"
          title="Staff Performance Report"
        />
      </div>

      <DateRangeFilter
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onClear={() => {
          setFrom("");
          setTo("");
        }}
      />

      {error && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground p-8">Loading...</div>
      ) : (
        <div id="performance-report-content" className="space-y-6 bg-background p-1">
          {data.length > 0 ? (
            <>
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-foreground mb-4">Jobs Completed</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      stroke="var(--color-muted-foreground)"
                    />
                    <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="completed" fill="#A7D129" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Desktop table — lg+ only; below that, the card list further down takes over. */}
              <div className="hidden lg:block rounded-lg border border-border bg-card overflow-x-auto scroll-fade-x">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                        Staff Member
                      </th>
                      <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                        Completed
                      </th>
                      <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                        Avg Rating
                      </th>
                      <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                        Feedback Count
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((s) => (
                      <tr key={s.staff_id} className="border-b border-border last:border-0">
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

              {/* Mobile/tablet card list — lg:hidden, mirrors the table above row-for-row. */}
              <div className="lg:hidden space-y-3">
                {data.map((s) => (
                  <DataCard key={s.staff_id}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-foreground">{s.full_name}</p>
                      {s.avg_rating ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <Star className="h-3 w-3 text-accent fill-accent" />
                          <span className="text-foreground text-sm">
                            {parseFloat(s.avg_rating).toFixed(1)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm shrink-0">—</span>
                      )}
                    </div>
                    <DataCardField label="Completed" value={s.jobs_completed} />
                    <DataCardField label="Feedback Count" value={s.feedback_count} />
                  </DataCard>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No performance data available for this period.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
