import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";

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

interface ActivityLog {
  log_id: number;
  user_id: number | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  created_at: string;
  email: string | null;
}

function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<{ logs: ActivityLog[] }>("/api/reports/activity")
      .then((d) => setLogs(d.logs))
      .catch(() => setError("Failed to load activity log"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-xs font-mono text-muted-foreground p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tighter">ACTIVITY LOG</h1>

      {error && (
        <p className="text-xs font-mono text-destructive border border-destructive px-3 py-2">{error}</p>
      )}

      <div className="border-2 border-border bg-card">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-muted-foreground">
            No activity logged yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map((log) => (
              <div key={log.log_id} className="flex items-start gap-4 p-4">
                <div className="min-w-35">
                  <p className="text-[10px] font-mono text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-mono uppercase font-bold ${actionColors[log.action] ?? "text-muted-foreground"}`}
                    >
                      {log.action.replace(/_/g, " ")}
                    </span>
                    {log.email && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        by {log.email}
                      </span>
                    )}
                  </div>
                  {(log.entity_type ?? log.entity_id) && (
                    <p className="text-xs font-mono text-foreground">
                      {log.entity_type}
                      {log.entity_id != null && ` #${log.entity_id}`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
