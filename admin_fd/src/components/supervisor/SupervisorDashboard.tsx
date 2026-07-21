import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/manager/ManagerOverview";
import { Combobox } from "@/components/ui/combobox";
import { Check, CheckCircle, ChevronLeft, ChevronRight, Loader2, Play, Trash2, X } from "lucide-react";

const AUTOSAVE_DELAY_MS = 800;

type SaveStatus = "idle" | "saving" | "saved" | "error";

function SaveStatusLabel({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving...
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="flex items-center gap-1 text-xs text-chart-1">
        <Check className="h-3 w-3" /> Saved
      </span>
    );
  }
  if (status === "error") {
    return <span className="text-xs text-destructive">Failed to save</span>;
  }
  return null;
}

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
  has_oil_change: boolean;
  current_odometer: number | null;
  next_service_odometer: number | null;
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

const ACTIVE_STATUSES: BookingStatus[] = ["Booked", "Started", "In Progress", "Completed"];
const STAFF_SLOT_COUNT = 3;

// The Supervisor-facing flow has exactly 3 states — Started/In Progress collapse
// into one step, both on the step bar and on the advance button, so a booking
// only ever needs two clicks (Booked → Started, Started → Completed) to finish.
const DISPLAY_STEPS = ["Booked", "Started / In Progress", "Completed"] as const;
const STEP_TARGET_STATUS: BookingStatus[] = ["Booked", "Started", "Completed"];

function stepIndexForStatus(status: BookingStatus): number {
  if (status === "Booked") return 0;
  if (status === "Completed") return 2;
  return 1; // Started or In Progress
}

function StatusStepBar({ status }: { status: BookingStatus }) {
  const currentStep = stepIndexForStatus(status);
  const isFinished = currentStep === DISPLAY_STEPS.length - 1;
  return (
    <div className="flex items-start">
      {DISPLAY_STEPS.map((label, idx) => {
        // Once the flow reaches its last step, that step is done too — not just "current".
        const isDone = idx < currentStep || (isFinished && idx === currentStep);
        const isCurrent = idx === currentStep && !isFinished;
        return (
          <div key={label} className={`flex items-center ${idx < DISPLAY_STEPS.length - 1 ? "flex-1" : ""}`}>
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold border-2 ${
                  isDone
                    ? "bg-chart-1 border-chart-1 text-white"
                    : isCurrent
                      ? "border-accent text-accent bg-accent/10"
                      : "border-border text-muted-foreground"
                }`}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : idx + 1}
              </div>
              <span className={`text-[11px] text-center leading-tight w-16 ${isCurrent ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {label}
              </span>
            </div>
            {idx < DISPLAY_STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 mt-3 ${isDone ? "bg-chart-1" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

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
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [remarksStatus, setRemarksStatus] = useState<SaveStatus>("idle");
  const [noteStatus, setNoteStatus] = useState<Record<number, SaveStatus>>({});
  const [editMode, setEditMode] = useState(false);
  const [oilChangeChecked, setOilChangeChecked] = useState(false);
  const [currentOdoDraft, setCurrentOdoDraft] = useState("");
  const [nextOdoDraft, setNextOdoDraft] = useState("");
  const [odoStatus, setOdoStatus] = useState<SaveStatus>("idle");
  const [odoValidationError, setOdoValidationError] = useState("");

  const remarksTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remarksSavingValueRef = useRef<string | null>(null);
  const noteTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const noteSavingValueRef = useRef<Record<number, string>>({});
  const odoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = bookings.find((b) => b.reservation_id === selectedId);
  const currentStepIdx = selected ? stepIndexForStatus(selected.status) : -1;
  const nextStatus = currentStepIdx >= 0 && currentStepIdx < STEP_TARGET_STATUS.length - 1 ? STEP_TARGET_STATUS[currentStepIdx + 1] : null;
  // If an oil change was flagged, both odometer readings must be saved too —
  // checked against the saved record, not the local draft, since that's the
  // same truth the backend itself enforces before allowing "Completed".
  const odometerIncomplete = (record?.has_oil_change ?? false) && (record?.current_odometer == null || record?.next_service_odometer == null);
  // Completing a service is the sign-off point — quality check must happen first.
  const advanceBlocked = nextStatus === "Completed" && (!(record?.quality_checked ?? false) || odometerIncomplete);
  // Once Completed (the last step), the record is finalized and read-only for good.
  const isLocked = currentStepIdx >= DISPLAY_STEPS.length - 1;
  const viewMode = isLocked || ((record?.quality_checked ?? false) && !editMode);

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
        setOilChangeChecked(d.record.has_oil_change);
        setCurrentOdoDraft(d.record.current_odometer != null ? String(d.record.current_odometer) : "");
        setNextOdoDraft(d.record.next_service_odometer != null ? String(d.record.next_service_odometer) : "");
        setOdoValidationError("");
        const drafts: Record<number, string> = {};
        d.assignments.forEach((a) => { drafts[a.assignment_id] = a.work_note ?? ""; });
        setNoteDrafts(drafts);
      })
      .catch(() => {
        setRecord(null);
        setAssignments([]);
        setRemarksDraft("");
        setNoteDrafts({});
        setOilChangeChecked(false);
        setCurrentOdoDraft("");
        setNextOdoDraft("");
      })
      .finally(() => setRecordLoading(false));
  };

  useEffect(() => {
    // Clear stale data immediately on switching bookings so we never show one
    // booking's remarks/items/staff under another booking's header — but this
    // effect only fires on booking switches, not on in-place refreshes after a
    // mutation, so those refreshes keep the existing content visible (no flash).
    // Drop any pending debounced save — it belongs to whichever booking was
    // open before this switch, and its onBlur already flushed it synchronously.
    if (remarksTimerRef.current) {
      clearTimeout(remarksTimerRef.current);
      remarksTimerRef.current = null;
    }
    Object.values(noteTimersRef.current).forEach(clearTimeout);
    noteTimersRef.current = {};
    if (odoTimerRef.current) {
      clearTimeout(odoTimerRef.current);
      odoTimerRef.current = null;
    }

    setEditMode(false);

    if (selectedId != null) {
      setRecord(null);
      setAssignments([]);
      setRemarksDraft("");
      setNoteDrafts({});
      setRemarksStatus("idle");
      setNoteStatus({});
      setOilChangeChecked(false);
      setCurrentOdoDraft("");
      setNextOdoDraft("");
      setOdoStatus("idle");
      setOdoValidationError("");
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
    if (!selectedId || !nextStatus || advanceBlocked) return;
    setError("");
    setAdvancing(true);
    try {
      await api.patch(`/api/service-records/${selectedId}/status`, { status: nextStatus });
      loadBookings();
      loadRecord(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setAdvancing(false);
    }
  };

  // updateServiceRecord is a full-replace endpoint, not a partial patch — every
  // call must resend the odometer fields too, or they'd silently get wiped
  // back to false/null by whichever field-level save fires next.
  const odometerPayload = (r: ServiceRecordData) => ({
    has_oil_change: r.has_oil_change,
    current_odometer: r.current_odometer,
    next_service_odometer: r.next_service_odometer,
  });

  const saveRemarks = async (value: string) => {
    if (!selectedId || !record) return;
    // Skip no-op saves and duplicate calls for a value already in flight
    // (debounce timer firing right as onBlur also flushes the same edit).
    if (value === (record.remarks ?? "") || value === remarksSavingValueRef.current) return;
    remarksSavingValueRef.current = value;
    setRemarksStatus("saving");
    try {
      await api.put(`/api/service-records/${selectedId}`, { remarks: value, quality_checked: record.quality_checked, ...odometerPayload(record) });
      setRecord((prev) => (prev ? { ...prev, remarks: value } : prev));
      setRemarksStatus("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save remarks");
      setRemarksStatus("error");
    } finally {
      if (remarksSavingValueRef.current === value) remarksSavingValueRef.current = null;
    }
  };

  const handleRemarksChange = (value: string) => {
    setRemarksDraft(value);
    setRemarksStatus("idle");
    if (remarksTimerRef.current) clearTimeout(remarksTimerRef.current);
    remarksTimerRef.current = setTimeout(() => saveRemarks(value), AUTOSAVE_DELAY_MS);
  };

  const flushRemarks = () => {
    if (remarksTimerRef.current) {
      clearTimeout(remarksTimerRef.current);
      remarksTimerRef.current = null;
    }
    saveRemarks(remarksDraft);
  };

  const toggleQuality = async () => {
    if (!selectedId || !record || isLocked) return;
    const next = !record.quality_checked;
    try {
      await api.put(`/api/service-records/${selectedId}`, { remarks: record.remarks ?? "", quality_checked: next, ...odometerPayload(record) });
      setRecord({ ...record, quality_checked: next });
      // Checking QC switches the fields above into the read-only summary view.
      if (next) setEditMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update quality check");
    }
  };

  function validateOdoLocal(hasOilChange: boolean, current: string, next: string): string {
    if (!hasOilChange) return "";
    if (!current.trim() || !next.trim()) return "Both odometer readings are required for an oil change";
    const c = Number(current);
    const n = Number(next);
    if (!Number.isFinite(c) || !Number.isFinite(n) || c < 0 || n < 0) return "Enter valid, non-negative odometer readings";
    if (n <= c) return "Next service reading must be greater than the current reading";
    return "";
  }

  const saveOdometer = async (hasOilChange: boolean, current: string, next: string) => {
    if (!selectedId || !record) return;
    const currentNum = hasOilChange && current.trim() ? Number(current) : null;
    const nextNum = hasOilChange && next.trim() ? Number(next) : null;
    const unchanged =
      hasOilChange === record.has_oil_change &&
      currentNum === record.current_odometer &&
      nextNum === record.next_service_odometer;
    if (unchanged) return;

    setOdoStatus("saving");
    setError("");
    try {
      await api.put(`/api/service-records/${selectedId}`, {
        remarks: record.remarks ?? "",
        quality_checked: record.quality_checked,
        has_oil_change: hasOilChange,
        current_odometer: currentNum,
        next_service_odometer: nextNum,
      });
      setRecord((prev) => (prev ? { ...prev, has_oil_change: hasOilChange, current_odometer: currentNum, next_service_odometer: nextNum } : prev));
      setOdoStatus("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save odometer reading");
      setOdoStatus("error");
    }
  };

  const attemptSaveOdo = (current: string, next: string) => {
    const validationMsg = validateOdoLocal(true, current, next);
    setOdoValidationError(validationMsg);
    if (validationMsg) {
      setOdoStatus("idle");
      return;
    }
    saveOdometer(true, current, next);
  };

  const handleOilChangeToggle = (checked: boolean) => {
    setOilChangeChecked(checked);
    setOdoValidationError("");
    if (odoTimerRef.current) {
      clearTimeout(odoTimerRef.current);
      odoTimerRef.current = null;
    }
    if (!checked) {
      // Unchecking is unambiguous — clear and save immediately, no validation needed.
      setCurrentOdoDraft("");
      setNextOdoDraft("");
      saveOdometer(false, "", "");
    }
    // Checking it doesn't save yet — wait for both readings to be entered.
  };

  const handleOdoFieldChange = (field: "current" | "next", value: string) => {
    if (field === "current") setCurrentOdoDraft(value);
    else setNextOdoDraft(value);
    setOdoStatus("idle");
    setOdoValidationError("");
    if (odoTimerRef.current) clearTimeout(odoTimerRef.current);
    const nextCurrent = field === "current" ? value : currentOdoDraft;
    const nextNext = field === "next" ? value : nextOdoDraft;
    odoTimerRef.current = setTimeout(() => attemptSaveOdo(nextCurrent, nextNext), AUTOSAVE_DELAY_MS);
  };

  const flushOdo = () => {
    if (odoTimerRef.current) {
      clearTimeout(odoTimerRef.current);
      odoTimerRef.current = null;
    }
    if (oilChangeChecked) attemptSaveOdo(currentOdoDraft, nextOdoDraft);
  };

  const addItem = async (catalogItemId: string) => {
    if (!selectedId || !catalogItemId) return;
    setNewItemCatalogId(catalogItemId);
    try {
      await api.post(`/api/service-records/${selectedId}/items`, { catalog_item_id: Number(catalogItemId) });
      loadRecord(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setNewItemCatalogId("");
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

  const saveSlotNote = async (assignmentId: number, value: string) => {
    const current = assignments.find((a) => a.assignment_id === assignmentId);
    if (!current) return;
    if (value === (current.work_note ?? "") || value === noteSavingValueRef.current[assignmentId]) return;
    noteSavingValueRef.current[assignmentId] = value;
    setNoteStatus((prev) => ({ ...prev, [assignmentId]: "saving" }));
    setError("");
    try {
      await api.put(`/api/service-records/assignments/${assignmentId}`, { work_note: value });
      setAssignments((prev) => prev.map((a) => (a.assignment_id === assignmentId ? { ...a, work_note: value } : a)));
      setNoteStatus((prev) => ({ ...prev, [assignmentId]: "saved" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save work note");
      setNoteStatus((prev) => ({ ...prev, [assignmentId]: "error" }));
    } finally {
      if (noteSavingValueRef.current[assignmentId] === value) delete noteSavingValueRef.current[assignmentId];
    }
  };

  const handleNoteChange = (assignmentId: number, value: string) => {
    setNoteDrafts((prev) => ({ ...prev, [assignmentId]: value }));
    setNoteStatus((prev) => ({ ...prev, [assignmentId]: "idle" }));
    if (noteTimersRef.current[assignmentId]) clearTimeout(noteTimersRef.current[assignmentId]);
    noteTimersRef.current[assignmentId] = setTimeout(() => saveSlotNote(assignmentId, value), AUTOSAVE_DELAY_MS);
  };

  const flushSlotNote = (assignmentId: number) => {
    if (noteTimersRef.current[assignmentId]) {
      clearTimeout(noteTimersRef.current[assignmentId]);
      delete noteTimersRef.current[assignmentId];
    }
    saveSlotNote(assignmentId, noteDrafts[assignmentId] ?? "");
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      {/* Detail popup */}
      {selected && (
        <div
          className="fixed inset-0 bg-background/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-lg border border-border bg-card p-4 space-y-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
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
            </div>

            <StatusStepBar status={selected.status} />

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
                {nextStatus && (
                  <div>
                    <button
                      onClick={advanceStatus}
                      disabled={advancing || advanceBlocked}
                      className="w-full flex items-center justify-center gap-2 rounded-md bg-accent py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {advancing ? "Updating..." : `Advance to ${nextStatus}`}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    {advanceBlocked && (
                      <p className="text-xs text-muted-foreground mt-1 text-center">
                        {!record.quality_checked
                          ? "Complete the quality check before marking this service as Completed."
                          : "Enter both odometer readings before marking this service as Completed."}
                      </p>
                    )}
                  </div>
                )}

                {/* Meter Reading (ODO) — only relevant when an oil change was done */}
                <div className="rounded-md border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Meter Reading (ODO)</span>
                    {!viewMode && <SaveStatusLabel status={odoStatus} />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Only applicable if an oil change (engine oil or gear oil — ATF/CVT/Manual) was done during this service — not for services like body washes.
                  </p>

                  {viewMode ? (
                    record.has_oil_change ? (
                      <p className="text-sm text-foreground">
                        Current: <span className="font-medium">{record.current_odometer?.toLocaleString() ?? "—"} km</span>
                        {" → "}Next service due at <span className="font-medium">{record.next_service_odometer?.toLocaleString() ?? "—"} km</span>
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">No oil change performed for this service</p>
                    )
                  ) : (
                    <>
                      <label className="flex items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={oilChangeChecked}
                          onChange={(e) => handleOilChangeToggle(e.target.checked)}
                          className="h-4 w-4 rounded border-border accent-accent"
                        />
                        This service included an oil change (engine or gear oil)
                      </label>

                      {oilChangeChecked && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div>
                            <label className="text-xs text-muted-foreground">Current Reading (km)</label>
                            <input
                              type="number"
                              min={0}
                              value={currentOdoDraft}
                              onChange={(e) => handleOdoFieldChange("current", e.target.value)}
                              onBlur={flushOdo}
                              placeholder="e.g. 45000"
                              className="w-full mt-0.5 border border-border rounded-md bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Next Service Due At (km)</label>
                            <input
                              type="number"
                              min={0}
                              value={nextOdoDraft}
                              onChange={(e) => handleOdoFieldChange("next", e.target.value)}
                              onBlur={flushOdo}
                              placeholder="e.g. 50000"
                              className="w-full mt-0.5 border border-border rounded-md bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>
                        </div>
                      )}
                      {odoValidationError && (
                        <p className="text-xs text-destructive">{odoValidationError}</p>
                      )}
                    </>
                  )}
                </div>

                {viewMode ? (
                  <div className="space-y-3 text-sm rounded-md border border-border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Service Details</span>
                      {!isLocked && (
                        <button onClick={() => setEditMode(true)} className="text-xs font-medium text-accent hover:underline">
                          Edit
                        </button>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Remarks</p>
                      <p className="text-foreground whitespace-pre-wrap">{record.remarks?.trim() ? record.remarks : "—"}</p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Additional Work / Parts Needed</p>
                      {record.items.length === 0 ? (
                        <p className="text-muted-foreground">None noted</p>
                      ) : (
                        <ul className="list-disc list-inside text-foreground">
                          {record.items.map((it) => (
                            <li key={it.item_id}>
                              {it.description} {it.quantity > 1 ? `×${it.quantity}` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Staff Contributions</p>
                      {assignments.length === 0 ? (
                        <p className="text-muted-foreground">None assigned</p>
                      ) : (
                        <ul className="space-y-1 text-foreground">
                          {assignments.map((a) => (
                            <li key={a.assignment_id}>
                              <span className="font-medium">{a.staff_name ?? `Staff #${a.staff_id}`}</span>
                              {a.work_note ? ` — ${a.work_note}` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {record.quality_checked && !isLocked && (
                      <div className="flex justify-end">
                        <button onClick={() => setEditMode(false)} className="text-xs font-medium text-accent hover:underline">
                          Done editing — back to summary
                        </button>
                      </div>
                    )}

                    {/* Remarks */}
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-muted-foreground">Remarks</label>
                        <SaveStatusLabel status={remarksStatus} />
                      </div>
                      <textarea
                        value={remarksDraft}
                        onChange={(e) => handleRemarksChange(e.target.value)}
                        onBlur={flushRemarks}
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
                      <div className="mt-2">
                        <Combobox
                          options={catalog.map((c) => ({
                            value: String(c.catalog_item_id),
                            label: c.name,
                            disabled: record.items.some((it) => it.catalog_item_id === c.catalog_item_id),
                          }))}
                          value={newItemCatalogId}
                          onValueChange={addItem}
                          placeholder="Search parts / work items to add..."
                          searchPlaceholder="Search..."
                          className="text-sm h-9"
                        />
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
                                <>
                                  <input
                                    value={noteDrafts[assignment.assignment_id] ?? ""}
                                    onChange={(e) => handleNoteChange(assignment.assignment_id, e.target.value)}
                                    onBlur={() => flushSlotNote(assignment.assignment_id)}
                                    placeholder="What did they work on? e.g. Interior vacuum & dashboard cleaning"
                                    className="w-full border border-border rounded-md bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                  />
                                  <SaveStatusLabel status={noteStatus[assignment.assignment_id] ?? "idle"} />
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {/* Quality check */}
                <button
                  onClick={toggleQuality}
                  disabled={isLocked}
                  className={`w-full flex items-center justify-center gap-2 rounded-md border py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
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
        </div>
      )}
    </div>
  );
}
