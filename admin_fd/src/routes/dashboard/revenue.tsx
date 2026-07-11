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
  LineChart,
  Line,
} from "recharts";

export const Route = createFileRoute("/dashboard/revenue")({
  component: RevenuePage,
});

interface RevenueSummary {
  total_revenue: string;
  total_invoices: string;
  paid_revenue: string;
  unpaid_revenue: string;
}

interface RevenueByDate {
  service_date: string;
  revenue: string;
  count: string;
}

interface RevenueByPackage {
  package_name: string;
  count: string;
  revenue: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function aggregateToMonthly(byDate: RevenueByDate[]) {
  const map: Record<string, { revenue: number; services: number }> = {};
  for (const d of byDate) {
    const m = MONTHS[new Date(d.service_date).getMonth()];
    if (!map[m]) map[m] = { revenue: 0, services: 0 };
    map[m].revenue += parseFloat(d.revenue);
    map[m].services += parseInt(d.count);
  }
  return MONTHS.filter((m) => map[m]).map((m) => ({ month: m, revenue: map[m].revenue, services: map[m].services }));
}

function RevenuePage() {
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [byPackage, setByPackage] = useState<RevenueByPackage[]>([]);
  const [chartData, setChartData] = useState<{ month: string; revenue: number; services: number }[]>([]);
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
      .get<{ summary: RevenueSummary; by_package: RevenueByPackage[]; by_date: RevenueByDate[] }>(
        `/api/reports/revenue${qs}`,
      )
      .then(({ summary: s, by_package, by_date }) => {
        setSummary(s);
        setByPackage(by_package);
        setChartData(aggregateToMonthly(by_date));
      })
      .catch(() => setError("Failed to load revenue data"))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(load, [load]);

  const totalRevenue = summary ? parseFloat(summary.total_revenue) : 0;
  const paidRevenue = summary ? parseFloat(summary.paid_revenue) : 0;
  const unpaidRevenue = summary ? parseFloat(summary.unpaid_revenue) : 0;
  const avgMonthly =
    chartData.length > 0
      ? Math.round(chartData.reduce((s, d) => s + d.revenue, 0) / chartData.length)
      : 0;
  const peakMonth = chartData.reduce(
    (best, d) => (d.revenue > best.revenue ? d : best),
    { month: "—", revenue: 0, services: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-extrabold tracking-tighter">REVENUE REPORTS</h1>
        <DownloadPdfButton elementId="revenue-report-content" filename="drivewell-revenue-report.pdf" title="Revenue Report" />
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
        <div id="revenue-report-content" className="space-y-6 bg-background p-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="border-2 border-border bg-card p-4">
              <p className="text-[10px] font-mono uppercase text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-extrabold text-foreground mt-1">
                LKR {totalRevenue.toLocaleString()}
              </p>
            </div>
            <div className="border-2 border-border bg-card p-4">
              <p className="text-[10px] font-mono uppercase text-muted-foreground">Paid / Unpaid</p>
              <p className="text-lg font-extrabold text-foreground mt-1">
                LKR {paidRevenue.toLocaleString()} <span className="text-muted-foreground text-xs">/</span> LKR {unpaidRevenue.toLocaleString()}
              </p>
            </div>
            <div className="border-2 border-border bg-card p-4">
              <p className="text-[10px] font-mono uppercase text-muted-foreground">Peak Month</p>
              <p className="text-2xl font-extrabold text-foreground mt-1">{peakMonth.month}</p>
            </div>
          </div>

          {chartData.length > 0 ? (
            <>
              <div className="border-2 border-border bg-card p-4">
                <h3 className="text-xs font-mono uppercase text-muted-foreground mb-4">
                  Monthly Revenue Trend
                </h3>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fontFamily: "DM Mono" }}
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
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#A7D129"
                      strokeWidth={2}
                      dot={{ fill: "#A7D129" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="border-2 border-border bg-card p-4">
                <h3 className="text-xs font-mono uppercase text-muted-foreground mb-4">
                  Revenue by Month
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fontFamily: "DM Mono" }}
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
                    <Bar dataKey="revenue" fill="#616F39" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="border-2 border-border bg-card overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b-2 border-border">
                      <th className="text-left py-3 px-3 uppercase text-muted-foreground">Package</th>
                      <th className="text-left py-3 px-3 uppercase text-muted-foreground">Invoices</th>
                      <th className="text-left py-3 px-3 uppercase text-muted-foreground">Revenue (LKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byPackage.map((p) => (
                      <tr key={p.package_name} className="border-b border-border">
                        <td className="py-2 px-3 text-foreground">{p.package_name}</td>
                        <td className="py-2 px-3 text-foreground">{p.count}</td>
                        <td className="py-2 px-3 text-foreground">{parseFloat(p.revenue).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="border-2 border-border bg-card p-8 text-center text-xs font-mono text-muted-foreground">
              No revenue data available for this period.
            </div>
          )}
        </div>
      )}
    </div>
  );
}