import {
  bookings,
  revenueData,
  serviceVolumeByPackage,
  getTodayBookings,
  getPackagePrice,
} from "@/data/dummyData";
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

export function ManagerOverview() {
  const todayBookings = getTodayBookings();
  const totalRevenue = bookings
    .filter((b) => b.status === "Billed")
    .reduce((sum, b) => sum + getPackagePrice(b.package) + b.addOns.reduce((s, a) => s + a.price, 0) - b.discount, 0);
  const completedToday = todayBookings.filter(
    (b) => b.status === "Completed" || b.status === "Ready for Pickup" || b.status === "Billed"
  ).length;

  const kpis = [
    { label: "Today's Bookings", value: todayBookings.length },
    { label: "Completed Today", value: completedToday },
    { label: "Total Revenue", value: `LKR ${totalRevenue.toLocaleString()}` },
    { label: "Active Packages", value: 5 },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Overview</h1>

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
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="revenue" fill="#A7D129" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="border border-border rounded-lg bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Service Volume by Package
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={serviceVolumeByPackage}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }: any) => `${name.split(" ")[0]} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
                fontSize={12}
              >
                {serviceVolumeByPackage.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
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
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">ID</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Customer</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Vehicle</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Package</th>
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {todayBookings.slice(0, 6).map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0">
                  <td className="py-2 px-2 text-muted-foreground">{b.id}</td>
                  <td className="py-2 px-2 text-foreground">{b.customerName}</td>
                  <td className="py-2 px-2 text-foreground">{b.vehicle.plate}</td>
                  <td className="py-2 px-2 text-foreground">{b.package}</td>
                  <td className="py-2 px-2">
                    <StatusBadge status={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
    Billed: "bg-muted text-muted-foreground border border-border",
  };

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || "bg-muted text-muted-foreground border border-border"}`}>
      {status}
    </span>
  );
}
