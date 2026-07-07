import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
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
  const [chartData, setChartData] = useState<{ month: string; revenue: number; services: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<{ summary: RevenueSummary; by_date: RevenueByDate[] }>("/api/reports/revenue")
      .then(({ summary: s, by_date }) => {
        setSummary(s);
        setChartData(aggregateToMonthly(by_date));
      })
      .catch(() => setError("Failed to load revenue data"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-xs font-mono text-muted-foreground p-8">Loading...</div>;
  }

  const totalRevenue = summary ? parseFloat(summary.total_revenue) : 0;
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
      <h1 className="text-2xl font-extrabold tracking-tighter">REVENUE REPORTS</h1>

      {error && (
        <p className="text-xs font-mono text-destructive border border-destructive px-3 py-2">{error}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="border-2 border-border bg-card p-4">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Total Revenue</p>
          <p className="text-2xl font-extrabold text-foreground mt-1">
            LKR {totalRevenue.toLocaleString()}
          </p>
        </div>
        <div className="border-2 border-border bg-card p-4">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Monthly Avg</p>
          <p className="text-2xl font-extrabold text-foreground mt-1">
            LKR {avgMonthly.toLocaleString()}
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
        </>
      ) : (
        <div className="border-2 border-border bg-card p-8 text-center text-xs font-mono text-muted-foreground">
          No revenue data available yet.
        </div>
      )}
    </div>
  );
}
