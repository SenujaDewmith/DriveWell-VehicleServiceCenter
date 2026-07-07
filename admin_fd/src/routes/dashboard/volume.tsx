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

  useEffect(() => {
    api
      .get<VolumeData>("/api/reports/volume")
      .then(setData)
      .catch(() => setError("Failed to load volume data"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-xs font-mono text-muted-foreground p-8">Loading...</div>;
  }

  const byPackage = (data?.by_package ?? []).map((p, i) => ({
    name: p.package_name,
    count: parseInt(p.count),
    fill: COLORS[i % COLORS.length],
  }));
  const totalServices = byPackage.reduce((s, p) => s + p.count, 0);
  const mostPopular = byPackage[0]?.name ?? "—";

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
      <h1 className="text-2xl font-extrabold tracking-tighter">SERVICE VOLUME</h1>

      {error && (
        <p className="text-xs font-mono text-destructive border border-destructive px-3 py-2">{error}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border-2 border-border bg-card p-4">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Total Services</p>
          <p className="text-2xl font-extrabold text-foreground mt-1">
            {totalServices.toLocaleString()}
          </p>
        </div>
        <div className="border-2 border-border bg-card p-4">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Most Popular</p>
          <p className="text-2xl font-extrabold text-foreground mt-1">{mostPopular}</p>
        </div>
      </div>

      {byPackage.length > 0 ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border-2 border-border bg-card p-4">
              <h3 className="text-xs font-mono uppercase text-muted-foreground mb-4">
                Volume by Package
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={byPackage} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fontFamily: "DM Mono" }}
                    stroke="var(--color-muted-foreground)"
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={140}
                    tick={{ fontSize: 9, fontFamily: "DM Mono" }}
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
                  <Bar dataKey="count" fill="#A7D129" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="border-2 border-border bg-card p-4">
              <h3 className="text-xs font-mono uppercase text-muted-foreground mb-4">
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
                      border: "2px solid var(--color-border)",
                      fontFamily: "DM Mono",
                      fontSize: 11,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {monthlyData.length > 0 && (
            <div className="border-2 border-border bg-card p-4">
              <h3 className="text-xs font-mono uppercase text-muted-foreground mb-4">
                Monthly Service Count
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
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
                  <Bar dataKey="services" fill="#3E432E" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      ) : (
        <div className="border-2 border-border bg-card p-8 text-center text-xs font-mono text-muted-foreground">
          No service volume data available yet.
        </div>
      )}
    </div>
  );
}
