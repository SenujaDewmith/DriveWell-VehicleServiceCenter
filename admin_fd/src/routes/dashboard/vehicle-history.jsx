import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Car, Download, Loader2, Wrench, FileText, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge, PaymentBadge } from "@/components/manager/ManagerOverview";
import { BookingDetailModal } from "@/components/bookings/BookingDetailModal";
import { generateVehicleHistoryPdf } from "@/lib/vehicleHistoryPdf";
import { DataCard, DataCardField } from "@/components/ui/data-card";

function fmtDate(d) {
  return d
    ? new Date(d).toLocaleDateString("en-LK", { year: "numeric", month: "long", day: "numeric" })
    : "—";
}

function computeStats(visits) {
  let paidTotal = 0;
  let unpaidTotal = 0;
  let nextServiceOdometer = null;
  for (const v of visits) {
    const amount = v.invoice ? parseFloat(v.invoice.total_amount) : 0;
    if (v.invoice?.payment_status === "Paid") paidTotal += amount;
    else if (v.invoice?.payment_status === "Unpaid") unpaidTotal += amount;
    // Visits are ordered most-recent-first, so the first one carrying a next-service
    // reading is the current one to show — later (older) readings are stale.
    if (nextServiceOdometer === null && v.service_record?.next_service_odometer != null) {
      nextServiceOdometer = v.service_record.next_service_odometer;
    }
  }
  return {
    totalVisits: visits.length,
    paidTotal,
    unpaidTotal,
    lastServiceDate: visits[0]?.service_date ?? null,
    nextServiceOdometer,
  };
}

function VehicleRow({ v, onSelect }) {
  return (
    <button
      onClick={() => onSelect(v)}
      className="w-full text-left p-3 hover:bg-muted transition-colors flex items-center justify-between gap-3"
    >
      <div>
        <p className="font-medium text-foreground">
          {v.plate_no} — {[v.make, v.model].filter(Boolean).join(" ") || "Unregistered"}
          {v.year ? ` (${v.year})` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {v.owner ? `${v.owner.full_name ?? v.owner.email}` : "No current owner"}
          {v.detached_at ? " · Detached" : ""}
        </p>
      </div>
      <Car className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}

function VehicleSearch({ query, setQuery, results, searching, searchError, onSelect }) {
  return (
    <div className="max-w-xl">
      <label className="block text-sm font-medium text-foreground mb-2">
        Find a vehicle by plate number, make, or model
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. CAB-1234, Corolla..."
          className="w-full border border-border rounded-md bg-background pl-9 pr-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {searchError && <p className="mt-2 text-sm text-destructive">{searchError}</p>}

      {query.trim().length >= 2 && (
        <div className="mt-3 rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
          {searching ? (
            <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No vehicles match "{query}"</div>
          ) : (
            results.map((v) => <VehicleRow key={v.vehicle_id} v={v} onSelect={onSelect} />)
          )}
        </div>
      )}
    </div>
  );
}

const RECENT_HEADINGS = {
  today: "Today's Appointments",
  recent: "Recently Serviced Vehicles",
};

function RecentVehicles({ loading, error, source, vehicles, onSelect }) {
  if (loading) {
    return (
      <div className="max-w-xl mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading recent vehicles...
      </div>
    );
  }
  // "none" (no bookings exist anywhere yet) or a load failure — search still works either way,
  // so this just quietly disappears rather than showing an error for a non-essential shortcut.
  if (error || source === "none" || vehicles.length === 0) return null;

  return (
    <div className="max-w-xl mt-6">
      <p className="text-sm font-medium text-foreground mb-2">{RECENT_HEADINGS[source]}</p>
      <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
        {vehicles.map((v) => (
          <VehicleRow key={v.vehicle_id} v={v} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

export function VehicleHistoryPage() {
  const { username } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const vehicleId = searchParams.get("vehicle_id");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [recentVehicles, setRecentVehicles] = useState([]);
  const [recentSource, setRecentSource] = useState(null);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState(false);

  const [vehicle, setVehicle] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [detailsId, setDetailsId] = useState(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearchError("");
      return;
    }
    let cancelled = false;
    setSearching(true);
    setSearchError("");
    const handle = setTimeout(() => {
      api
        .get(`/api/admin/vehicles/search?q=${encodeURIComponent(query.trim())}`)
        .then((d) => {
          if (!cancelled) setResults(d.vehicles);
        })
        .catch(() => {
          if (!cancelled) setSearchError("Failed to search vehicles");
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  // Loaded once on mount — a fixed "default browse" list, not something that needs to
  // react to the search query or track the currently-selected vehicle.
  useEffect(() => {
    let cancelled = false;
    api
      .get("/api/admin/vehicles/recent")
      .then((d) => {
        if (cancelled) return;
        setRecentVehicles(d.vehicles);
        setRecentSource(d.source);
      })
      .catch(() => {
        if (!cancelled) setRecentError(true);
      })
      .finally(() => {
        if (!cancelled) setRecentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!vehicleId) {
      setVehicle(null);
      setVisits([]);
      return;
    }
    let cancelled = false;
    setLoadingHistory(true);
    setHistoryError("");
    Promise.all([
      api.get(`/api/admin/vehicles/${vehicleId}`),
      api.get(`/api/bookings?vehicle_id=${vehicleId}`),
    ])
      .then(async ([vehicleRes, bookingsRes]) => {
        if (cancelled) return;
        setVehicle(vehicleRes.vehicle);
        // Full per-visit detail (odometer, remarks, staff, invoice line items) isn't in the
        // list payload — fetch it for every visit so both the on-screen table and the PDF
        // export read from the same complete data with no extra round trip on download.
        const details = await Promise.all(
          bookingsRes.bookings.map((b) =>
            api.get(`/api/bookings/${b.reservation_id}`).then((r) => r.booking),
          ),
        );
        if (!cancelled) setVisits(details);
      })
      .catch(() => {
        if (!cancelled) setHistoryError("Failed to load this vehicle's service history");
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  const stats = useMemo(() => computeStats(visits), [visits]);

  const selectVehicle = (v) => {
    setQuery("");
    setResults([]);
    setSearchParams({ vehicle_id: String(v.vehicle_id) });
  };

  const clearSelection = () => {
    setSearchParams({});
  };

  const downloadPdf = () => {
    if (!vehicle) return;
    setGeneratingPdf(true);
    try {
      generateVehicleHistoryPdf({ vehicle, visits, stats, generatedBy: username || "Manager" });
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Vehicle History</h1>
        {vehicle && (
          <div className="flex items-center gap-2">
            <button
              onClick={downloadPdf}
              disabled={generatingPdf || loadingHistory}
              className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {generatingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {generatingPdf ? "Generating..." : "Download PDF"}
            </button>
            <button
              onClick={clearSelection}
              className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:border-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" /> Change Vehicle
            </button>
          </div>
        )}
      </div>

      {!vehicleId && (
        <>
          <VehicleSearch
            query={query}
            setQuery={setQuery}
            results={results}
            searching={searching}
            searchError={searchError}
            onSelect={selectVehicle}
          />
          {query.trim().length < 2 && (
            <RecentVehicles
              loading={recentLoading}
              error={recentError}
              source={recentSource}
              vehicles={recentVehicles}
              onSelect={selectVehicle}
            />
          )}
        </>
      )}

      {vehicleId && loadingHistory && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {vehicleId && !loadingHistory && historyError && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
          {historyError}
        </p>
      )}

      {vehicleId && !loadingHistory && !historyError && vehicle && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
            <Car className="h-8 w-8 text-muted-foreground shrink-0" />
            <div>
              <p className="text-lg font-semibold text-foreground">
                {[vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
                  "Unregistered make/model"}
                {vehicle.year ? ` (${vehicle.year})` : ""} — {vehicle.plate_no}
              </p>
              <p className="text-sm text-muted-foreground">
                {vehicle.owner
                  ? `${vehicle.owner.full_name ?? "—"} · ${vehicle.owner.email}${vehicle.owner.phone ? ` · ${vehicle.owner.phone}` : ""}`
                  : "No current owner on record"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Total Visits</p>
              <p className="text-2xl font-bold text-foreground mt-1">{stats.totalVisits}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Paid / Unpaid</p>
              <p className="text-lg font-bold text-foreground mt-1">
                LKR {stats.paidTotal.toLocaleString()}{" "}
                <span className="text-muted-foreground text-sm">/</span> LKR{" "}
                {stats.unpaidTotal.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Last Service</p>
              <p className="text-lg font-bold text-foreground mt-1">
                {fmtDate(stats.lastServiceDate)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Next Service Due</p>
              <p className="text-lg font-bold text-foreground mt-1">
                {stats.nextServiceOdometer != null
                  ? `${stats.nextServiceOdometer.toLocaleString()} km`
                  : "—"}
              </p>
            </div>
          </div>

          {visits.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center">
              <Wrench className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No service history yet</p>
              <p className="text-sm text-muted-foreground">
                This vehicle hasn't had any bookings.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table — lg+ only; below that, the card list further down takes over. */}
              <div className="hidden lg:block rounded-lg border border-border bg-card overflow-x-auto scroll-fade-x">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                        Date
                      </th>
                      <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                        Package
                      </th>
                      <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                        Odometer
                      </th>
                      <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                        Payment
                      </th>
                      <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                        Total
                      </th>
                      <th className="text-left py-3 px-3 font-medium text-muted-foreground">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map((v) => (
                      <tr key={v.reservation_id} className="border-b border-border last:border-0">
                        <td className="py-2 px-3 text-foreground">{fmtDate(v.service_date)}</td>
                        <td className="py-2 px-3 text-foreground">{v.package_name}</td>
                        <td className="py-2 px-3 text-foreground">
                          {v.service_record?.current_odometer != null
                            ? `${v.service_record.current_odometer.toLocaleString()} km`
                            : "—"}
                        </td>
                        <td className="py-2 px-3">
                          <StatusBadge status={v.status} />
                        </td>
                        <td className="py-2 px-3">
                          <PaymentBadge paymentStatus={v.invoice?.payment_status} />
                        </td>
                        <td className="py-2 px-3 text-foreground">
                          {v.invoice
                            ? `LKR ${parseFloat(v.invoice.total_amount).toLocaleString()}`
                            : "—"}
                        </td>
                        <td className="py-2 px-3">
                          <button
                            onClick={() => setDetailsId(v.reservation_id)}
                            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                          >
                            <FileText className="h-3 w-3" /> Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile/tablet card list — lg:hidden, mirrors the table above row-for-row. */}
              <div className="lg:hidden space-y-3">
                {visits.map((v) => (
                  <DataCard key={v.reservation_id}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-foreground">{fmtDate(v.service_date)}</p>
                      <StatusBadge status={v.status} />
                    </div>
                    <DataCardField label="Package" value={v.package_name} />
                    <DataCardField
                      label="Odometer"
                      value={
                        v.service_record?.current_odometer != null
                          ? `${v.service_record.current_odometer.toLocaleString()} km`
                          : "—"
                      }
                    />
                    <DataCardField
                      label="Payment"
                      value={<PaymentBadge paymentStatus={v.invoice?.payment_status} />}
                    />
                    <DataCardField
                      label="Total"
                      value={
                        v.invoice
                          ? `LKR ${parseFloat(v.invoice.total_amount).toLocaleString()}`
                          : "—"
                      }
                    />
                    <div className="pt-2 border-t border-border">
                      <button
                        onClick={() => setDetailsId(v.reservation_id)}
                        className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        <FileText className="h-3 w-3" /> Details
                      </button>
                    </div>
                  </DataCard>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {detailsId && (
        <BookingDetailModal reservationId={detailsId} onClose={() => setDetailsId(null)} />
      )}
    </div>
  );
}
