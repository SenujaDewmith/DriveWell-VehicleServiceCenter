import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/manager/ManagerOverview";
import { Combobox } from "@/components/ui/combobox";
import { CheckCircle, ChevronLeft, ChevronRight, Play, Plus, Trash2, X } from "lucide-react";

type BookingStatus = "Booked" | "Started" | "In Progress" | "Completed" | "Ready for Pickup" | "Cancelled" | "No-show";

interface ApiBooking {
  reservation_id: number;
  booking_ref: string | null;
  service_date: string;
  status: BookingStatus;
  customer_name: string;
  plate_no: string;
  make: string;
  model: string;
  vehicle_type: string;
  package_name: string;
  slot_time: string | null;
}

interface RecordItem {
  item_id: number;
  catalog_item_id: number | null;
  catalog_item_name: string | null;
  description: string;
  quantity: number;
}

interface Assignment {
  assignment_id: number;
  staff_id: number;
  staff_name: string | null;
  work_note: string | null;
}

interface ServiceRecordData {
  record_id: number;
  reservation_id: number;
  remarks: string | null;
  quality_checked: boolean;
  items: RecordItem[];
}

interface StaffOption {
  user_id: number;
  full_name: string | null;
}

interface CatalogItem {
  catalog_item_id: number;
  name: string;
  is_active: boolean;
}

const statusFlow: BookingStatus[] = ["Booked", "Started", "In Progress", "Completed", "Ready for Pickup"];
const ACTIVE_STATUSES: BookingStatus[] = ["Booked", "Started", "In Progress", "Completed", "Ready for Pickup"];
const STAFF_SLOT_COUNT = 3;

function dateKeyOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayKey() {
  return dateKeyOf(new Date());
}

function shiftDateKey(key: string, deltaDays: number) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d + deltaDays);
  return dateKeyOf(date);
}

function formatDisplayDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function SupervisorDashboard() {
  const [viewDate, setViewDate] = useState(todayKey());
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [record, setRecord] = useState<ServiceRecordData | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [recordLoading, setRecordLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [remarksDraft, setRemarksDraft] = useState("");
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [newItemCatalogId, setNewItemCatalogId] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [error, setError] = useState("");

  const selected = bookings.find((b) => b.reservation_id === selectedId);

  const loadBookings = () => {
    setLoading(true);
    api
      .get<{ bookings: ApiBooking[] }>(`/api/bookings?from=${viewDate}&to=${viewDate}`)
      .then((d) => setBookings(d.bookings.filter((b) => ACTIVE_STATUSES.includes(b.status))))
      .catch(() => setError("Failed to load bookings for this date"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBookings();
    setSelectedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewDate]);

  useEffect(() => {
    api.get<{ staff: StaffOption[] }>("/api/service-records/staff-options").then((d) => setStaffOptions(d.staff)).catch(() => {});
    api.get<{ items: CatalogItem[] }>("/api/charge-catalog").then((d) => setCatalog(d.items.filter((i) => i.is_active))).catch(() => {});
  }, []);

  const loadRecord = (reservationId: number) => {
    setRecordLoading(true);
    setError("");
    api
      .get<{ record: ServiceRecordData; assignments: Assignment[] }>(`/api/service-records/${reservationId}`)
      .then((d) => {
        setRecord(d.record);
        setAssignments(d.assignments);
        setRemarksDraft(d.record.remarks ?? "");
        const drafts: Record<number, string> = {};
        d.assignments.forEach((a) => { drafts[a.assignment_id] = a.work_note ?? ""; });
        setNoteDrafts(drafts);
      })
      .catch(() => {
        setRecord(null);
        setAssignments([]);
        setRemarksDraft("");
        setNoteDrafts({});
      })
      .finally(() => setRecordLoading(false));
  };

  useEffect(() => {
    // Clear stale data immediately on switching bookings so we never show one
    // booking's remarks/items/staff under another booking's header — but this
    // effect only fires on booking switches, not on in-place refreshes after a
    // mutation, so those refreshes keep the existing content visible (no flash).
    if (selectedId != null) {
      setRecord(null);
      setAssignments([]);
      setRemarksDraft("");
      setNoteDrafts({});
      loadRecord(selectedId);
    } else {
      setRecord(null);
      setAssignments([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const startService = async () => {
    if (!selectedId) return;
    setStarting(true);
    setError("");
    try {
      await api.post(`/api/service-records/${selectedId}`, { remarks: "" });
      loadBookings();
      loadRecord(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start service");
    } finally {
      setStarting(false);
    }
  };

  const advanceStatus = async () => {
    if (!selectedId || !selected) return;
    const idx = statusFlow.indexOf(selected.status);
    if (idx < 0 || idx >= statusFlow.length - 1) return;
    const next = statusFlow[idx + 1];
    setError("");
    setAdvancing(true);
    try {
      await api.patch(`/api/service-records/${selectedId}/status`, { status: next });
      loadBookings();
      loadRecord(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setAdvancing(false);
    }
  };

  const saveRemarks = async () => {
    if (!selectedId || !record) return;
    try {
      await api.put(`/api/service-records/${selectedId}`, { remarks: remarksDraft, quality_checked: record.quality_checked });
      setRecord({ ...record, remarks: remarksDraft });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save remarks");
    }
  };

  const toggleQuality = async () => {
    if (!selectedId || !record) return;
    const next = !record.quality_checked;
    try {
      await api.put(`/api/service-records/${selectedId}`, { remarks: record.remarks ?? "", quality_checked: next });
      setRecord({ ...record, quality_checked: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update quality check");
    }
  };

  const addItem = async () => {
    if (!selectedId) return;
    if (!newItemCatalogId && !newItemDescription.trim()) return;
    try {
      const payload: Record<string, unknown> = { quantity: newItemQty };
      if (newItemCatalogId) payload.catalog_item_id = Number(newItemCatalogId);
      if (newItemDescription.trim()) payload.description = newItemDescription.trim();
      await api.post(`/api/service-records/${selectedId}/items`, payload);
      setNewItemCatalogId("");
      setNewItemDescription("");
      setNewItemQty(1);
      loadRecord(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    }
  };

  const removeItem = async (itemId: number) => {
    if (!selectedId) return;
    try {
      await api.delete(`/api/service-records/items/${itemId}`);
      loadRecord(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove item");
    }
  };

  const assignStaffToSlot = async (staffId: string) => {
    if (!selectedId || !staffId) return;
    setError("");
    try {
      await api.post(`/api/service-records/${selectedId}/staff`, { staff_id: Number(staffId) });
      loadRecord(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign staff");
    }
  };

  const changeSlotStaff = async (assignmentId: number, staffId: string) => {
    if (!staffId) return;
    setError("");
    try {
      await api.put(`/api/service-records/assignments/${assignmentId}`, { staff_id: Number(staffId) });
      if (selectedId) loadRecord(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update staff assignment");
    }
  };

  const saveSlotNote = async (assignmentId: number) => {
    setError("");
    try {
      await api.put(`/api/service-records/assignments/${assignmentId}`, { work_note: noteDrafts[assignmentId] ?? "" });
      setAssignments((prev) => prev.map((a) => (a.assignment_id === assignmentId ? { ...a, work_note: noteDrafts[assignmentId] ?? "" } : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save work note");
    }
  };

  const removeAssignment = async (assignmentId: number) => {
    setError("");
    try {
      await api.delete(`/api/service-records/assignments/${assignmentId}`);
      if (selectedId) loadRecord(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove assignment");
    }
  };

  const isToday = viewDate === todayKey();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Reservations</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewDate((d) => shiftDateKey(d, -1))}
            className="p-2 rounded-md border border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground transition-colors"
            title="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="date"
            value={viewDate}
            onChange={(e) => e.target.value && setViewDate(e.target.value)}
            className="border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={() => setViewDate((d) => shiftDateKey(d, 1))}
            className="p-2 rounded-md border border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground transition-colors"
            title="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {!isToday && (
            <button
              onClick={() => setViewDate(todayKey())}
              className="rounded-md border border-accent px-3 py-2 text-sm font-medium text-accent hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Today
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground -mt-4">
        {isToday ? "Today — " : ""}{formatDisplayDate(viewDate)}
      </p>

      {error && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">{error}</p>
      )}

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Cards list */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {loading && bookings.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-2 py-8 text-center">Loading...</p>
          )}
          {!loading && bookings.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-2 py-8 text-center">No reservations scheduled for this date</p>
          )}
          {bookings.map((b) => (
            <button
              key={b.reservation_id}
              onClick={() => setSelectedId(b.reservation_id)}
              className={`text-left rounded-lg border p-4 transition-colors ${
                selectedId === b.reservation_id
                  ? "border-accent bg-accent/10"
                  : "border-border bg-card hover:border-muted-foreground"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm text-muted-foreground">
                  {b.booking_ref ?? `#${b.reservation_id}`} · {b.slot_time?.slice(0, 5) ?? "—"}
                </span>
                <StatusBadge status={b.status} />
              </div>
              <p className="text-sm font-semibold text-foreground">{b.customer_name}</p>
              <p className="text-sm text-muted-foreground">
                {b.plate_no} — {b.make} {b.model} ({b.vehicle_type})
              </p>
              <p className="text-sm text-accent mt-1">{b.package_name}</p>
            </button>
          ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-full lg:w-96 rounded-lg border border-border bg-card p-4 space-y-4 h-fit">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-foreground">{selected.booking_ref ?? `#${selected.reservation_id}`} — Detail</h3>
              <button onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Customer:</span> {selected.customer_name}</p>
              <p><span className="text-muted-foreground">Vehicle:</span> {selected.plate_no} — {selected.make} {selected.model} ({selected.vehicle_type})</p>
              <p><span className="text-muted-foreground">Package:</span> {selected.package_name}</p>
              <p><span className="text-muted-foreground">Status:</span> <StatusBadge status={selected.status} /></p>
            </div>

            {recordLoading && !record && (
              <p className="text-sm text-muted-foreground">Loading service record...</p>
            )}

            {!recordLoading && selected.status === "Booked" && isToday && (
              <button
                onClick={startService}
                disabled={starting}
                className="w-full flex items-center justify-center gap-2 rounded-md bg-accent py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                {starting ? "Starting..." : "Start Service"}
              </button>
            )}

            {!recordLoading && selected.status === "Booked" && !isToday && (
              <p className="text-sm text-muted-foreground border border-border rounded-md px-3 py-2">
                {viewDate > todayKey()
                  ? "This service is scheduled for a future date — come back on that day to start it."
                  : "This booking's scheduled date has passed without being started."}
              </p>
            )}

            {record && (
              <>
                {statusFlow.indexOf(selected.status) >= 0 && statusFlow.indexOf(selected.status) < statusFlow.length - 1 && (
                  <button
                    onClick={advanceStatus}
                    disabled={advancing}
                    className="w-full flex items-center justify-center gap-2 rounded-md bg-accent py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
                  >
                    {advancing ? "Updating..." : `Advance to ${statusFlow[statusFlow.indexOf(selected.status) + 1]}`}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}

                {/* Remarks */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Remarks</label>
                  <textarea
                    value={remarksDraft}
                    onChange={(e) => setRemarksDraft(e.target.value)}
                    onBlur={saveRemarks}
                    placeholder="General condition notes from inspection..."
                    className="w-full mt-1 border border-border rounded-md bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none h-16"
                  />
                </div>

                {/* Additional work / parts notes */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Additional Work / Parts Needed</label>
                  <div className="space-y-1 mt-1">
                    {record.items.length === 0 && (
                      <p className="text-sm text-muted-foreground">None noted</p>
                    )}
                    {record.items.map((it) => (
                      <div key={it.item_id} className="flex items-center justify-between rounded-md border border-border px-2 py-1">
                        <span className="text-sm text-foreground">
                          {it.description} {it.quantity > 1 ? `×${it.quantity}` : ""}
                        </span>
                        <button onClick={() => removeItem(it.item_id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1 mt-2">
                    <select
                      value={newItemCatalogId}
                      onChange={(e) => setNewItemCatalogId(e.target.value)}
                      className="border border-border rounded-md bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">— Custom note (type below) —</option>
                      {catalog.map((c) => (
                        <option key={c.catalog_item_id} value={c.catalog_item_id}>{c.name}</option>
                      ))}
                    </select>
                    {!newItemCatalogId && (
                      <input
                        value={newItemDescription}
                        onChange={(e) => setNewItemDescription(e.target.value)}
                        placeholder="e.g. Rear brake pads worn"
                        className="border border-border rounded-md bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    )}
                    <div className="flex gap-1">
                      <input
                        type="number"
                        min={1}
                        value={newItemQty}
                        onChange={(e) => setNewItemQty(Number(e.target.value) || 1)}
                        className="w-16 border border-border rounded-md bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        onClick={addItem}
                        className="flex-1 flex items-center justify-center gap-1 rounded-md border border-accent px-2 py-1 text-sm font-medium text-accent hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        <Plus className="h-3 w-3" /> Add Note
                      </button>
                    </div>
                  </div>
                </div>

                {/* Staff contributions — up to 3 staff members, each with a note on what they did */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Staff Contributions ({assignments.length}/{STAFF_SLOT_COUNT})
                  </label>
                  <div className="space-y-2 mt-1">
                    {Array.from({ length: STAFF_SLOT_COUNT }).map((_, idx) => {
                      const assignment = assignments[idx];
                      const takenIds = new Set(assignments.filter((a) => a !== assignment).map((a) => a.staff_id));
                      const options = staffOptions
                        .filter((s) => !takenIds.has(s.user_id))
                        .map((s) => ({ value: String(s.user_id), label: s.full_name ?? `Staff #${s.user_id}` }));

                      return (
                        <div key={assignment?.assignment_id ?? `empty-${idx}`} className="rounded-md border border-border p-2 space-y-1.5">
                          <div className="flex items-center gap-1">
                            <div className="flex-1">
                              <Combobox
                                options={options}
                                value={assignment ? String(assignment.staff_id) : ""}
                                onValueChange={(v) =>
                                  assignment ? changeSlotStaff(assignment.assignment_id, v) : assignStaffToSlot(v)
                                }
                                placeholder={`Slot ${idx + 1} — select staff`}
                                searchPlaceholder="Search staff..."
                                className="text-sm h-8"
                              />
                            </div>
                            {assignment && (
                              <button onClick={() => removeAssignment(assignment.assignment_id)} className="text-muted-foreground hover:text-destructive shrink-0">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          {assignment && (
                            <input
                              value={noteDrafts[assignment.assignment_id] ?? ""}
                              onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [assignment.assignment_id]: e.target.value }))}
                              onBlur={() => saveSlotNote(assignment.assignment_id)}
                              placeholder="What did they work on? e.g. Interior vacuum & dashboard cleaning"
                              className="w-full border border-border rounded-md bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quality check */}
                <button
                  onClick={toggleQuality}
                  className={`w-full flex items-center justify-center gap-2 rounded-md border py-2 text-sm font-semibold transition-colors ${
                    record.quality_checked
                      ? "border-chart-1 bg-chart-1/10 text-chart-1"
                      : "border-border text-muted-foreground hover:border-muted-foreground"
                  }`}
                >
                  <CheckCircle className="h-4 w-4" />
                  {record.quality_checked ? "QC Passed ✓" : "Mark Quality Check"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
