import { createFileRoute } from "@tanstack/react-router";
import { activityLog } from "@/data/dummyData";

export const Route = createFileRoute("/dashboard/activity")({
  component: ActivityPage,
});

const actionColors: Record<string, string> = {
  BOOKING_CREATED: "text-accent",
  STATUS_CHANGED: "text-primary",
  STAFF_ASSIGNED: "text-chart-2",
  QUALITY_CHECK: "text-chart-1",
  INVOICE_GENERATED: "text-chart-4",
  PAYMENT_RECEIVED: "text-chart-5",
  PACKAGE_UPDATED: "text-primary",
  USER_DEACTIVATED: "text-destructive",
  SCHEDULE_UPDATED: "text-chart-3",
};

function ActivityPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tighter">ACTIVITY LOG</h1>

      <div className="border-2 border-border bg-card">
        <div className="divide-y divide-border">
          {activityLog.map((log) => (
            <div key={log.id} className="flex items-start gap-4 p-4">
              <div className="min-w-[140px]">
                <p className="text-[10px] font-mono text-muted-foreground">
                  {new Date(log.timestamp).toLocaleString()}
                </p>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-mono uppercase font-bold ${actionColors[log.action] || "text-muted-foreground"}`}>
                    {log.action.replace(/_/g, " ")}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">by {log.user}</span>
                </div>
                <p className="text-xs font-mono text-foreground">{log.details}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
