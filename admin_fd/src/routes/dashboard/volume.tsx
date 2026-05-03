import { createFileRoute } from "@tanstack/react-router";
import { serviceVolumeByPackage, revenueData } from "@/data/dummyData";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

export const Route = createFileRoute("/dashboard/volume")({
  component: VolumePage,
});

const COLORS = ["#A7D129", "#616F39", "#3E432E", "#8B9D4A", "#D4E157"];

function VolumePage() {
  const totalServices = revenueData.reduce((s, d) => s + d.services, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tighter">SERVICE VOLUME</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border-2 border-border bg-card p-4">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Total Services (Annual)</p>
          <p className="text-2xl font-extrabold text-foreground mt-1">{totalServices.toLocaleString()}</p>
        </div>
        <div className="border-2 border-border bg-card p-4">
          <p className="text-[10px] font-mono uppercase text-muted-foreground">Most Popular</p>
          <p className="text-2xl font-extrabold text-foreground mt-1">Basic Exterior Wash</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border-2 border-border bg-card p-4">
          <h3 className="text-xs font-mono uppercase text-muted-foreground mb-4">Volume by Package</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={serviceVolumeByPackage} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis type="number" tick={{ fontSize: 10, fontFamily: "DM Mono" }} stroke="var(--color-muted-foreground)" />
              <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 9, fontFamily: "DM Mono" }} stroke="var(--color-muted-foreground)" />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "2px solid var(--color-border)", fontFamily: "DM Mono", fontSize: 11 }} />
              <Bar dataKey="count" fill="#A7D129" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="border-2 border-border bg-card p-4">
          <h3 className="text-xs font-mono uppercase text-muted-foreground mb-4">Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={serviceVolumeByPackage} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={100}>
                {serviceVolumeByPackage.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "2px solid var(--color-border)", fontFamily: "DM Mono", fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="border-2 border-border bg-card p-4">
        <h3 className="text-xs font-mono uppercase text-muted-foreground mb-4">Monthly Service Count</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fontFamily: "DM Mono" }} stroke="var(--color-muted-foreground)" />
            <YAxis tick={{ fontSize: 10, fontFamily: "DM Mono" }} stroke="var(--color-muted-foreground)" />
            <Tooltip contentStyle={{ background: "var(--color-card)", border: "2px solid var(--color-border)", fontFamily: "DM Mono", fontSize: 11 }} />
            <Bar dataKey="services" fill="#3E432E" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
