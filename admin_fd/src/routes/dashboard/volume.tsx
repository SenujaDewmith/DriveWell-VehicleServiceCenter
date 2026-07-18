import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { DateRangeFilter } from "@/components/reports/DateRangeFilter";
import { DownloadPdfButton } from "@/components/reports/DownloadPdfButton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
} from "recharts";

export const Route = createFileRoute("/dashboard/volume")({
  component: VolumePage,
});

const COLORS = ["#A7D129", "#616F39", "#3E432E", "#8B9D4A", "#D4E157"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface VolumeData {
  by_status: { status: string; count: string }[];
  by_package: { package_name: string; count: string }[];
  by_date: { service_date: string; count: string }[];
}

function VolumePage() {
  const [data, setData] = useState<VolumeData | null>(null);
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
      .get<VolumeData>(`/api/reports/volume${qs}`)
      .then(setData)
      .catch(() => setError("Failed to load volume data"))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(load, [load]);

  const byPackage = (data?.by_package ?? []).map((p, i) => ({
    name: p.package_name,
    count: parseInt(p.count),
    fill: COLORS[i % COLORS.length],
  }));
  const totalServices = byPackage.reduce((s, p) => s + p.count, 0);
  const mostPopular = byPackage[0]?.name ?? "—";

  const byStatus = data?.by_status ?? [];

  const monthlyMap: Record<string, number> = {};
  for (const d of data?.by_date ?? []) {
    const m = MONTHS[new Date(d.service_date).getMonth()];
    monthlyMap[m] = (monthlyMap[m] ?? 0) + parseInt(d.count);
  }
  const monthlyData = MONTHS.filter((m) => monthlyMap[m]).map((m) => ({
    month: m,
    services: monthlyMap[m],
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Service Volume</h1>
        <DownloadPdfButton elementId="volume-report-content" filename="drivewell-volume-report.pdf" title="Service Volume Report" />
      </div>

      <DateRangeFilter
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onClear={() => { setFrom(""); setTo(""); }}
      />

      {error && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">{error}</p>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground p-8">Loading...</div>
      ) : (
        <div id="volume-report-content" className="space-y-6 bg-background p-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Total Services</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {totalServices.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Most Popular</p>
              <p className="text-2xl font-bold text-foreground mt-1">{mostPopular}</p>
            </div>
          </div>

          {byPackage.length > 0 ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-4">
                    Volume by Package
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={byPackage} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 12 }}
                        stroke="var(--color-muted-foreground)"
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={140}
                        tick={{ fontSize: 11 }}
                        stroke="var(--color-muted-foreground)"
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" fill="#A7D129" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-4">
                    Distribution
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={byPackage}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {monthlyData.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-4">
                    Monthly Service Count
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12 }}
                        stroke="var(--color-muted-foreground)"
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        stroke="var(--color-muted-foreground)"
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="services" fill="#3E432E" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="rounded-lg border border-border bg-card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-3 font-medium text-muted-foreground">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byStatus.map((s) => (
                      <tr key={s.status} className="border-b border-border last:border-0">
                        <td className="py-2 px-3 text-foreground">{s.status}</td>
                        <td className="py-2 px-3 text-foreground">{s.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No service volume data available for this period.
            </div>
          )}
        </div>
      )}
    </div>
  );
}