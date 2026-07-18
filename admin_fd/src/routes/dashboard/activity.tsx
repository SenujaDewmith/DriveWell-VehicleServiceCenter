import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { DateRangeFilter } from "@/components/reports/DateRangeFilter";
import { DownloadPdfButton } from "@/components/reports/DownloadPdfButton";

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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("limit", "200");
    api
      .get<{ logs: ActivityLog[] }>(`/api/reports/activity?${params.toString()}`)
      .then((d) => setLogs(d.logs))
      .catch(() => setError("Failed to load activity log"))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(load, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Activity Log</h1>
        <DownloadPdfButton elementId="activity-report-content" filename="drivewell-activity-log.pdf" title="Activity Log" />
      </div>

      <DateRangeFilter
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onClear={() => { setFrom(""); setTo(""); }}
      />

      {error && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">{error}</p>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground p-8">Loading...</div>
      ) : (
        <div id="activity-report-content" className="rounded-lg border border-border bg-card">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No activity logged for this period.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log) => (
                <div key={log.log_id} className="flex items-start gap-4 p-4">
                  <div className="min-w-35">
                    <p className="text-sm text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-sm font-medium ${actionColors[log.action] ?? "text-muted-foreground"}`}
                      >
                        {log.action.replace(/_/g, " ")}
                      </span>
                      {log.email && (
                        <span className="text-sm text-muted-foreground">
                          by {log.email}
                        </span>
                      )}
                    </div>
                    {(log.entity_type ?? log.entity_id) && (
                      <p className="text-sm text-foreground">
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
      )}
    </div>
  );
}