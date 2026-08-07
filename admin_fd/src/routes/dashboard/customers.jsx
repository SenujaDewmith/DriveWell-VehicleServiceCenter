import { useState, useEffect } from "react";
import { Plus, Pencil, UserX, UserCheck, Eye, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { DataCard, DataCardField } from "@/components/ui/data-card";
import { PhoneNumberInput } from "@/components/ui/phone-number-input";
import { CustomerDetailModal } from "@/components/customers/CustomerDetailModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const STATUS_FILTERS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "pending", label: "Pending" },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const blockSpaceKey = (e) => {
  if (e.key === " ") e.preventDefault();
};
// Full name accepts letters and spaces only — anything else (digits, symbols)
// is silently dropped as the manager types, rather than rejected after the fact.
const lettersAndSpacesOnly = (value) => value.replace(/[^a-zA-Z\s]/g, "");

function RequiredLabel({ children }) {
  return (
    <label className="text-xs font-medium text-muted-foreground">
      {children} <span className="text-destructive">*</span>
    </label>
  );
}

// Shared between the desktop table's Actions column and the mobile/tablet card
// list's action row, so the confirmation copy only lives in one place. Supervisors
// get `canManage: false` — read-only lookup during a walk-in/call, nothing that
// touches a customer's contact info or account access.
function CustomerActions({ customer: c, onView, onEdit, onToggleActive, canManage }) {
  return (
    <div className="flex gap-1">
      <button onClick={() => onView(c)} className="p-1 text-muted-foreground hover:text-foreground">
        <Eye className="h-3 w-3" />
      </button>
      {!canManage ? null : (
        <>
          <button
            onClick={() => onEdit(c)}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3 w-3" />
          </button>
          {c.account_status !== "pending" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="p-1 text-muted-foreground hover:text-foreground">
                  {c.account_status === "active" ? (
                    <UserX className="h-3 w-3" />
                  ) : (
                    <UserCheck className="h-3 w-3" />
                  )}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {c.account_status === "active" ? "Deactivate" : "Activate"} {c.full_name}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {c.account_status === "active"
                      ? "They'll immediately lose access to their DriveWell account until reactivated."
                      : "They'll be able to sign in to their DriveWell account again."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onToggleActive(c)}>
                    {c.account_status === "active" ? "Deactivate" : "Activate"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </>
      )}
    </div>
  );
}

const EMPTY_FORM = { email: "", full_name: "", phone: "", secondary_phone: "", address: "" };

export function CustomersPage() {
  const { role } = useAuth();
  const canManage = role === "manager";
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const load = () => {
    setLoading(true);
    api
      .get("/api/users/customers")
      .then((d) => setCustomers(d.customers))
      .catch(() => setError("Failed to load customers"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowForm(true);
    setError("");
    setNameError("");
    setEmailError("");
    setPhoneError("");
  };

  const openEdit = (c) => {
    setForm({
      email: c.email,
      full_name: c.full_name,
      phone: c.phone ?? "",
      secondary_phone: c.secondary_phone ?? "",
      address: c.address ?? "",
    });
    setEditing(c);
    setShowForm(true);
    setError("");
    setNameError("");
    setEmailError("");
    setPhoneError("");
  };

  const save = async () => {
    const nameOk = form.full_name.trim().length > 0;
    const emailOk = EMAIL_REGEX.test(form.email);
    const phoneOk = Boolean(form.phone);
    setNameError(nameOk ? "" : "Full name is required");
    setEmailError(emailOk ? "" : "Enter a valid email address");
    setPhoneError(phoneOk ? "" : "Phone number is required");
    if (!nameOk || !emailOk || !phoneOk) return;

    setSaving(true);
    setError("");
    try {
      const payload = {
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || null,
        secondary_phone: form.secondary_phone || null,
        address: form.address || null,
      };
      if (editing) {
        await api.put(`/api/users/customers/${editing.user_id}`, payload);
      } else {
        await api.post("/api/users/customers", payload);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c) => {
    const next = c.account_status === "active" ? "inactive" : "active";
    setError("");
    try {
      await api.patch(`/api/users/${c.user_id}/status`, { account_status: next });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed");
    }
  };

  const statusFiltered =
    statusFilter === "All" ? customers : customers.filter((c) => c.account_status === statusFilter);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? statusFiltered.filter(
        (c) =>
          c.full_name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q),
      )
    : statusFiltered;

  // Counts reflect every status regardless of which tab is active, so switching
  // tabs never changes another tab's own count.
  const statusCounts = STATUS_FILTERS.reduce((acc, { value }) => {
    acc[value] = customers.filter((c) => c.account_status === value).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Customer Management</h1>
        {canManage && (
          <button
            onClick={openNew}
            className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Customer
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setStatusFilter("All")}
            className={`rounded-md border px-2 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === "All"
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            All ({customers.length})
          </button>
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`rounded-md border px-2 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === value
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {label} ({statusCounts[value]})
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <input
            placeholder="Search name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-border rounded-md bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <Dialog open={canManage && showForm} onOpenChange={(open) => !saving && setShowForm(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "New"} Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {!editing && (
              <p className="text-xs text-muted-foreground">
                An email will be sent to set their password. The account stays pending until they
                do.
              </p>
            )}
            {error && (
              <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
                {error}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <RequiredLabel>Full Name</RequiredLabel>
                <input
                  placeholder="Full Name"
                  value={form.full_name}
                  onChange={(e) => {
                    setForm({ ...form, full_name: lettersAndSpacesOnly(e.target.value) });
                    if (nameError) setNameError("");
                  }}
                  className={`w-full border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${
                    nameError ? "border-destructive" : "border-border"
                  }`}
                />
                {nameError && <p className="text-xs text-destructive">{nameError}</p>}
              </div>
              <div className="space-y-1">
                <RequiredLabel>Email</RequiredLabel>
                <input
                  placeholder="Email"
                  type="email"
                  value={form.email}
                  onKeyDown={blockSpaceKey}
                  onChange={(e) => {
                    setForm({ ...form, email: e.target.value.replace(/\s/g, "") });
                    if (emailError) setEmailError("");
                  }}
                  onBlur={() => {
                    if (form.email && !EMAIL_REGEX.test(form.email))
                      setEmailError("Enter a valid email address");
                  }}
                  className={`w-full border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${
                    emailError ? "border-destructive" : "border-border"
                  }`}
                />
                {emailError && <p className="text-xs text-destructive">{emailError}</p>}
              </div>
              <div className="space-y-1">
                <RequiredLabel>Phone</RequiredLabel>
                <PhoneNumberInput
                  value={form.phone}
                  error={!!phoneError}
                  onChange={(v) => {
                    setForm({ ...form, phone: v });
                    if (phoneError) setPhoneError("");
                  }}
                />
                {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Secondary Phone (optional)
                </label>
                <input
                  placeholder="Secondary Phone"
                  value={form.secondary_phone}
                  onChange={(e) => setForm({ ...form, secondary_phone: e.target.value })}
                  className="w-full border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Address (optional)
                </label>
                <input
                  placeholder="Address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowForm(false)}
              disabled={saving}
              className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:border-muted-foreground transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading...
        </div>
      ) : (
        <>
          {/* Desktop table — lg+ only; below that, the card list further down takes over. */}
          <div className="hidden lg:block rounded-lg border border-border bg-card overflow-x-auto scroll-fade-x">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">ID</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">Email</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">Phone</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">Address</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.user_id}
                    className={`border-b border-border last:border-0 ${c.account_status !== "active" ? "opacity-50" : ""}`}
                  >
                    <td className="py-2 px-3 text-muted-foreground">{c.user_id}</td>
                    <td className="py-2 px-3 text-foreground">{c.full_name}</td>
                    <td className="py-2 px-3 text-foreground">{c.email}</td>
                    <td className="py-2 px-3 text-foreground">{c.phone ?? "—"}</td>
                    <td className="py-2 px-3 text-foreground max-w-[16rem] truncate">
                      {c.address ?? "—"}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`text-sm font-medium capitalize ${
                          c.account_status === "active"
                            ? "text-accent"
                            : c.account_status === "pending"
                              ? "text-amber-500"
                              : "text-destructive"
                        }`}
                      >
                        {c.account_status === "pending"
                          ? "Pending (invite sent)"
                          : c.account_status}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <CustomerActions
                        customer={c}
                        onView={(c) => setViewingId(c.user_id)}
                        onEdit={openEdit}
                        onToggleActive={toggleActive}
                        canManage={canManage}
                      />
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      {customers.length === 0
                        ? "No customers found"
                        : "No customers match this filter"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile/tablet card list — lg:hidden, mirrors the table above row-for-row. */}
          <div className="lg:hidden space-y-3">
            {filtered.map((c) => (
              <DataCard
                key={c.user_id}
                className={c.account_status !== "active" ? "opacity-50" : ""}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{c.full_name}</p>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                  </div>
                  <span
                    className={`text-sm font-medium capitalize text-right shrink-0 ${
                      c.account_status === "active"
                        ? "text-accent"
                        : c.account_status === "pending"
                          ? "text-amber-500"
                          : "text-destructive"
                    }`}
                  >
                    {c.account_status === "pending" ? "Pending" : c.account_status}
                  </span>
                </div>

                <DataCardField label="ID" value={c.user_id} />
                <DataCardField label="Phone" value={c.phone ?? "—"} />
                <DataCardField label="Address" value={c.address ?? "—"} />

                <div className="pt-2 border-t border-border">
                  <CustomerActions
                    customer={c}
                    onView={(c) => setViewingId(c.user_id)}
                    onEdit={openEdit}
                    onToggleActive={toggleActive}
                    canManage={canManage}
                  />
                </div>
              </DataCard>
            ))}
            {filtered.length === 0 && (
              <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                {customers.length === 0 ? "No customers found" : "No customers match this filter"}
              </div>
            )}
          </div>
        </>
      )}

      {viewingId && (
        <CustomerDetailModal customerId={viewingId} onClose={() => setViewingId(null)} />
      )}
    </div>
  );
}
