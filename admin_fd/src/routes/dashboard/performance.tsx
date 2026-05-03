import { createFileRoute } from "@tanstack/react-router";
import { staffPerformance } from "@/data/dummyData";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Star } from "lucide-react";

export const Route = createFileRoute("/dashboard/performance")({
  component: PerformancePage,
});

function PerformancePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tighter">STAFF PERFORMANCE</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border-2 border-border bg-card p-4">
          <h3 className="text-xs font-mono uppercase text-muted-foreground mb-4">Jobs Completed</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={staffPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: "DM Mono" }} stroke="var(--color-muted-foreground)" />
              <YAxis tick={{ fontSize: 10, fontFamily: "DM Mono" }} stroke="var(--color-muted-foreground)" />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "2px solid var(--color-border)", fontFamily: "DM Mono", fontSize: 11 }} />
              <Bar dataKey="completed" fill="#A7D129" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="border-2 border-border bg-card p-4">
          <h3 className="text-xs font-mono uppercase text-muted-foreground mb-4">Efficiency %</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={staffPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: "DM Mono" }} stroke="var(--color-muted-foreground)" />
              <YAxis tick={{ fontSize: 10, fontFamily: "DM Mono" }} stroke="var(--color-muted-foreground)" domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "2px solid var(--color-border)", fontFamily: "DM Mono", fontSize: 11 }} />
              <Bar dataKey="efficiency" fill="#616F39" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="border-2 border-border bg-card overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b-2 border-border">
              <th className="text-left py-3 px-3 uppercase text-muted-foreground">Staff Member</th>
              <th className="text-left py-3 px-3 uppercase text-muted-foreground">Completed</th>
              <th className="text-left py-3 px-3 uppercase text-muted-foreground">Avg Rating</th>
              <th className="text-left py-3 px-3 uppercase text-muted-foreground">Efficiency</th>
            </tr>
          </thead>
          <tbody>
            {staffPerformance.map((s) => (
              <tr key={s.name} className="border-b border-border">
                <td className="py-2 px-3 text-foreground">{s.name}</td>
                <td className="py-2 px-3 text-foreground">{s.completed}</td>
                <td className="py-2 px-3">
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-accent fill-accent" />
                    <span className="text-foreground">{s.avgRating}</span>
                  </div>
                </td>
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-muted">
                      <div className="h-full bg-accent" style={{ width: `${s.efficiency}%` }} />
                    </div>
                    <span className="text-foreground">{s.efficiency}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
