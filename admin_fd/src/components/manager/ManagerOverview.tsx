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
  Cell,
} from "recharts";

const COLORS = ["#A7D129", "#616F39", "#3E432E", "#8B9D4A", "#D4E157"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const COMPLETED_STATUSES = ["Completed", "Ready for Pickup"];

interface ApiBooking {
  reservation_id: number;
  booking_ref: string | null;
  status: string;
  customer_name: string;
  plate_no: string;
  package_name: string;
}

interface RevenueByDate {
  service_date: string;
  revenue: string;
}

interface VolumeByPackage {
  package_name: string;
  count: string;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function aggregateToMonthly(byDate: RevenueByDate[]) {
  const totals: Record<string, number> = {};
  for (const d of byDate) {
    const m = MONTHS[new Date(d.service_date).getMonth()];
    totals[m] = (totals[m] ?? 0) + parseFloat(d.revenue);
  }
  return MONTHS.filter((m) => totals[m] !== undefined).map((m) => ({ month: m, revenue: totals[m] }));
}

export function ManagerOverview() {
  const [todayBookings, setTodayBookings] = useState<ApiBooking[]>([]);
  const [recentBookings, setRecentBookings] = useState<ApiBooking[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [activePackages, setActivePackages] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; revenue: number }[]>([]);
  const [volumeByPackage, setVolumeByPackage] = useState<VolumeByPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const today = todayKey();
    Promise.all([
      api.get<{ bookings: ApiBooking[] }>(`/api/bookings?from=${today}&to=${today}`),
      api.get<{ bookings: ApiBooking[] }>("/api/bookings"),
      api.get<{ summary: { total_revenue: string }; by_date: RevenueByDate[] }>("/api/reports/revenue"),
      api.get<{ by_package: VolumeByPackage[] }>("/api/reports/volume"),
      api.get<{ packages: { is_active: boolean }[] }>("/api/packages"),
    ])
      .then(([todayRes, allRes, revenueRes, volumeRes, packagesRes]) => {
        setTodayBookings(todayRes.bookings);
        setRecentBookings(allRes.bookings.slice(0, 6));
        setTotalRevenue(parseFloat(revenueRes.summary.total_revenue));
        setMonthlyRevenue(aggregateToMonthly(revenueRes.by_date));
        setVolumeByPackage(volumeRes.by_package);
        setActivePackages(packagesRes.packages.filter((p) => p.is_active).length);
      })
      .catch(() => setError("Failed to load overview data"))
      .finally(() => setLoading(false));
  }, []);

  const completedToday = todayBookings.filter((b) => COMPLETED_STATUSES.includes(b.status)).length;

  const kpis = [
    { label: "Today's Bookings", value: todayBookings.length },
    { label: "Completed Today", value: completedToday },
    { label: "Total Revenue", value: `LKR ${totalRevenue.toLocaleString()}` },
    { label: "Active Packages", value: activePackages },
  ];

  const pieData = volumeByPackage.map((p) => ({ name: p.package_name, count: parseInt(p.count) }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Overview</h1>

      {error && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">{error}</p>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground p-8">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="border border-border rounded-lg bg-card p-4">
                <p className="text-sm text-muted-foreground">
                  {kpi.label}
                </p>
                <p className="text-2xl font-bold text-foreground mt-1">{kpi.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-border rounded-lg bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-4">
                Monthly Revenue (LKR)
              </h3>
              {monthlyRevenue.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                    <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                    <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="revenue" fill="#A7D129" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground py-16 text-center">No revenue data yet</p>
              )}
            </div>

            <div className="border border-border rounded-lg bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-4">
                Service Volume by Package
              </h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }: any) => `${name.split(" ")[0]} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                      fontSize={12}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground py-16 text-center">No bookings yet</p>
              )}
            </div>
          </div>

          <div className="border border-border rounded-lg bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Recent Bookings
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Ref</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Customer</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Vehicle</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Package</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.map((b) => (
                    <tr key={b.reservation_id} className="border-b border-border last:border-0">
                      <td className="py-2 px-2 text-muted-foreground">{b.booking_ref ?? `#${b.reservation_id}`}</td>
                      <td className="py-2 px-2 text-foreground">{b.customer_name}</td>
                      <td className="py-2 px-2 text-foreground">{b.plate_no}</td>
                      <td className="py-2 px-2 text-foreground">{b.package_name}</td>
                      <td className="py-2 px-2">
                        <StatusBadge status={b.status} />
                      </td>
                    </tr>
                  ))}
                  {recentBookings.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">No bookings yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Booked: "bg-status-booked/10 text-status-booked border border-status-booked/20",
    Started: "bg-status-in-progress/10 text-status-in-progress border border-status-in-progress/20",
    "In Progress": "bg-status-in-progress/10 text-status-in-progress border border-status-in-progress/20",
    Completed: "bg-status-completed/10 text-status-completed border border-status-completed/20",
    "Ready for Pickup": "bg-status-ready/10 text-status-ready border border-status-ready/20",
    Cancelled: "bg-status-cancelled/10 text-status-cancelled border border-status-cancelled/20",
    "No-show": "bg-status-cancelled/10 text-status-cancelled border border-status-cancelled/20",
  };

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || "bg-muted text-muted-foreground border border-border"}`}>
      {status}
    </span>
  );
}
