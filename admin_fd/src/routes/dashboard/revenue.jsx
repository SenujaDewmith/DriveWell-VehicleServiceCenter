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
import { DataCard, DataCardField } from "@/components/ui/data-card";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function aggregateToMonthly(byDate) {
  const map = {};
  for (const d of byDate) {
    const m = MONTHS[new Date(d.service_date).getMonth()];
    if (!map[m]) map[m] = { revenue: 0, services: 0 };
    map[m].revenue += parseFloat(d.revenue);
    map[m].services += parseInt(d.count);
  }
  return MONTHS.filter((m) => map[m]).map((m) => ({
    month: m,
    revenue: map[m].revenue,
    services: map[m].services,
  }));
}

export function RevenuePage() {
  const [summary, setSummary] = useState(null);
  const [byPackage, setByPackage] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString() ? `?${params.toString()}` : "";

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .get(`/api/reports/revenue${qs}`)
      .then(({ summary: s, by_package, by_date }) => {
        setSummary(s);
        setByPackage(by_package);
        setChartData(aggregateToMonthly(by_date));
      })
      .catch(() => setError("Failed to load revenue data"))
      .finally(() => setLoading(false));
  }, [qs]);

  useEffect(load, [load]);

  const totalRevenue = summary ? parseFloat(summary.total_revenue) : 0;
  const paidRevenue = summary ? parseFloat(summary.paid_revenue) : 0;
  const unpaidRevenue = summary ? parseFloat(summary.unpaid_revenue) : 0;
  const avgMonthly =
    chartData.length > 0
      ? Math.round(chartData.reduce((s, d) => s + d.revenue, 0) / chartData.length)
      : 0;
  const peakMonth = chartData.reduce((best, d) => (d.revenue > best.revenue ? d : best), {
    month: "—",
    revenue: 0,
    services: 0,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Revenue Reports</h1>
        <DownloadPdfButton
          path={`/api/reports/revenue/pdf${qs}`}
          filename="drivewell-revenue-report.pdf"
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
        <div className="space-y-6 bg-background p-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                LKR {totalRevenue.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Paid / Unpaid</p>
              <p className="text-lg font-bold text-foreground mt-1">
                LKR {paidRevenue.toLocaleString()}{" "}
                <span className="text-muted-foreground text-sm">/</span> LKR{" "}
                {unpaidRevenue.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Peak Month</p>
              <p className="text-2xl font-bold text-foreground mt-1">{peakMonth.month}</p>
            </div>
          </div>

          {chartData.length > 0 ? (
            <>
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-foreground mb-4">
                  Monthly Revenue Trend
                </h3>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12 }}
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

              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-foreground mb-4">Revenue by Month</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12 }}
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
                    <Bar dataKey="revenue" fill="#616F39" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Desktop table — lg+ only; below that, the card list further down takes over. */}
              <div className="hidden lg:block rounded-lg border border-border bg-card overflow-x-auto scroll-fade-x">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                        Package
                      </th>
                      <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                        Invoices
                      </th>
                      <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                        Revenue (LKR)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {byPackage.map((p) => (
                      <tr key={p.package_name} className="border-b border-border last:border-0">
                        <td className="py-2 px-3 text-foreground">{p.package_name}</td>
                        <td className="py-2 px-3 text-foreground">{p.count}</td>
                        <td className="py-2 px-3 text-foreground">
                          {parseFloat(p.revenue).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile/tablet card list — lg:hidden, mirrors the table above row-for-row. */}
              <div className="lg:hidden space-y-3">
                {byPackage.map((p) => (
                  <DataCard key={p.package_name}>
                    <p className="font-semibold text-foreground">{p.package_name}</p>
                    <DataCardField label="Invoices" value={p.count} />
                    <DataCardField
                      label="Revenue (LKR)"
                      value={parseFloat(p.revenue).toLocaleString()}
                    />
                  </DataCard>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No revenue data available for this period.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
