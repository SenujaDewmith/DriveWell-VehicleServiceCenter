import { createFileRoute } from "@tanstack/react-router";
import { revenueData } from "@/data/dummyData";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from "recharts";

export const Route = createFileRoute("/dashboard/revenue")({
  component: RevenuePage,
});

function RevenuePage() {
  const totalRevenue = revenueData.reduce((s, d) => s + d.revenue, 0);
  const avgMonthly = Math.round(totalRevenue / revenueData.length);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tighter">REVENUE REPORTS</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="border-2 border-border bg-card p-4">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Total Annual</p>
          <p className="text-2xl font-extrabold text-foreground mt-1">LKR {totalRevenue.toLocaleString()}</p>
        </div>
        <div className="border-2 border-border bg-card p-4">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Monthly Avg</p>
          <p className="text-2xl font-extrabold text-foreground mt-1">LKR {avgMonthly.toLocaleString()}</p>
        </div>
        <div className="border-2 border-border bg-card p-4">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Peak Month</p>
          <p className="text-2xl font-extrabold text-foreground mt-1">December</p>
        </div>
      </div>

      <div className="border-2 border-border bg-card p-4">
        <h3 className="text-xs font-mono uppercase text-muted-foreground mb-4">Monthly Revenue Trend</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fontFamily: "DM Mono" }} stroke="var(--color-muted-foreground)" />
            <YAxis tick={{ fontSize: 10, fontFamily: "DM Mono" }} stroke="var(--color-muted-foreground)" />
            <Tooltip contentStyle={{ background: "var(--color-card)", border: "2px solid var(--color-border)", fontFamily: "DM Mono", fontSize: 11 }} />
            <Line type="monotone" dataKey="revenue" stroke="#A7D129" strokeWidth={2} dot={{ fill: "#A7D129" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="border-2 border-border bg-card p-4">
        <h3 className="text-xs font-mono uppercase text-muted-foreground mb-4">Revenue by Month</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fontFamily: "DM Mono" }} stroke="var(--color-muted-foreground)" />
            <YAxis tick={{ fontSize: 10, fontFamily: "DM Mono" }} stroke="var(--color-muted-foreground)" />
            <Tooltip contentStyle={{ background: "var(--color-card)", border: "2px solid var(--color-border)", fontFamily: "DM Mono", fontSize: 11 }} />
            <Bar dataKey="revenue" fill="#616F39" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
