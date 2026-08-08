import { useState, useEffect } from "react";
import { Plus, Pencil, UserX, UserCheck, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { DataCard, DataCardField } from "@/components/ui/data-card";
import { PhoneNumberInput } from "@/components/ui/phone-number-input";
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

const ROLE_OPTIONS = [
  { id: 2, label: "Supervisor" },
  { id: 3, label: "Cashier" },
  { id: 4, label: "Service Staff" },
];

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
// list's action row, so the confirmation copy only lives in one place.
function MemberActions({ member: m, currentUserId, onEdit, onToggleActive, onDelete }) {
  return (
    <div className="flex gap-1">
      <button onClick={() => onEdit(m)} className="p-1 text-muted-foreground hover:text-foreground">
        <Pencil className="h-3 w-3" />
      </button>
      {m.account_status === "pending" ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              className="p-1 text-muted-foreground hover:text-destructive"
              title="Delete pending invite"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete the pending invite for {m.full_name}?</AlertDialogTitle>
              <AlertDialogDescription>
                You'll need to recreate the account to send a new invite.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(m)}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="p-1 text-muted-foreground hover:text-foreground">
                {m.account_status === "active" ? (
                  <UserX className="h-3 w-3" />
                ) : (
                  <UserCheck className="h-3 w-3" />
                )}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {m.account_status === "active" ? "Deactivate" : "Activate"} {m.full_name}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {m.account_status === "active"
                    ? "They'll immediately lose access to the staff portal until reactivated."
                    : "They'll be able to sign in to the staff portal again."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onToggleActive(m)}>
                  {m.account_status === "active" ? "Deactivate" : "Activate"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {m.user_id !== currentUserId && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="p-1 text-muted-foreground hover:text-destructive"
                  title="Permanently delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Permanently delete {m.full_name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This cannot be undone — their account and login access will be gone for good.
                    Past invoices, service records, and job assignments keep their name for
                    record-keeping, but nothing links back to a live account anymore. Use
                    Deactivate instead if this might not be final.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(m)}>
                    Permanently Delete
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

export function UsersPage() {
  const { userId } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    role_id: 4,
    phone_no: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const load = () => {
    setLoading(true);
    api
      .get("/api/users/staff")
      .then((d) => setMembers(d.staff))
      .catch(() => setError("Failed to load staff"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openNew = () => {
    setForm({ email: "", full_name: "", role_id: 4, phone_no: "" });
    setEditing(null);
    setShowForm(true);
    setError("");
    setNameError("");
    setEmailError("");
    setPhoneError("");
  };

  const openEdit = (m) => {
    setForm({
      email: m.email,
      full_name: m.full_name,
      role_id: m.role_id,
      phone_no: m.phone_no ?? "",
    });
    setEditing(m);
    setShowForm(true);
    setError("");
    setNameError("");
    setEmailError("");
    setPhoneError("");
  };

  const save = async () => {
    const nameOk = form.full_name.trim().length > 0;
    const emailOk = EMAIL_REGEX.test(form.email);
    const phoneOk = Boolean(form.phone_no);
    setNameError(nameOk ? "" : "Full name is required");
    setEmailError(emailOk ? "" : "Enter a valid email address");
    setPhoneError(phoneOk ? "" : "Phone number is required");
    if (!nameOk || !emailOk || !phoneOk) return;

    setSaving(true);
    setError("");
    try {
      if (editing) {
        await api.put(`/api/users/staff/${editing.user_id}`, {
          full_name: form.full_name,
          phone_no: form.phone_no || null,
          email: form.email,
        });
      } else {
        await api.post("/api/users/staff", {
          email: form.email,
          full_name: form.full_name,
          role_id: form.role_id,
          phone_no: form.phone_no || null,
        });
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (m) => {
    const next = m.account_status === "active" ? "inactive" : "active";
    setError("");
    try {
      await api.patch(`/api/users/${m.user_id}/status`, { account_status: next });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed");
    }
  };

  const deleteMember = async (m) => {
    setError("");
    try {
      await api.delete(`/api/users/staff/${m.user_id}`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const filtered =
    statusFilter === "All" ? members : members.filter((m) => m.account_status === statusFilter);

  // Counts reflect every status regardless of which tab is active, so switching
  // tabs never changes another tab's own count.
  const statusCounts = STATUS_FILTERS.reduce((acc, { value }) => {
    acc[value] = members.filter((m) => m.account_status === value).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Staff Management</h1>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Staff
        </button>
      </div>

      {error && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => setStatusFilter("All")}
          className={`rounded-md border px-2 py-1.5 text-sm font-medium transition-colors ${
            statusFilter === "All"
              ? "border-accent bg-accent text-accent-foreground"
              : "border-border text-muted-foreground"
          }`}
        >
          All ({members.length})
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

      <Dialog open={showForm} onOpenChange={(open) => !saving && setShowForm(open)}>
        <DialogContent overlayClassName="bg-black/50">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "New"} Staff</DialogTitle>
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
                <RequiredLabel>Phone</RequiredLabel>
                <PhoneNumberInput
                  value={form.phone_no}
                  error={!!phoneError}
                  onChange={(v) => {
                    setForm({ ...form, phone_no: v });
                    if (phoneError) setPhoneError("");
                  }}
                />
                {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
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
              {!editing && (
                <div className="space-y-1">
                  <RequiredLabel>Role</RequiredLabel>
                  <select
                    value={form.role_id}
                    onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })}
                    className="w-full border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Role</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Phone</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Joined</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr
                  key={m.user_id}
                  className={`border-b border-border last:border-0 ${m.account_status !== "active" ? "opacity-50" : ""}`}
                >
                  <td className="py-2 px-3 text-muted-foreground">{m.user_id}</td>
                  <td className="py-2 px-3 text-foreground">{m.full_name}</td>
                  <td className="py-2 px-3 text-foreground">{m.role_name}</td>
                  <td className="py-2 px-3 text-foreground">{m.email}</td>
                  <td className="py-2 px-3 text-foreground">{m.phone_no ?? "—"}</td>
                  <td className="py-2 px-3 text-foreground">
                    {new Date(m.created_at).toISOString().slice(0, 10)}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`text-sm font-medium capitalize ${
                        m.account_status === "active"
                          ? "text-accent"
                          : m.account_status === "pending"
                            ? "text-amber-500"
                            : "text-destructive"
                      }`}
                    >
                      {m.account_status === "pending" ? "Pending (invite sent)" : m.account_status}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <MemberActions
                      member={m}
                      currentUserId={userId}
                      onEdit={openEdit}
                      onToggleActive={toggleActive}
                      onDelete={deleteMember}
                    />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    {members.length === 0 ? "No staff found" : "No staff match this filter"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
      </div>

      {/* Mobile/tablet card list — lg:hidden, mirrors the table above row-for-row. */}
      <div className="lg:hidden space-y-3">
        {filtered.map((m) => (
          <DataCard
            key={m.user_id}
            className={m.account_status !== "active" ? "opacity-50" : ""}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-foreground">{m.full_name}</p>
                <p className="text-xs text-muted-foreground">{m.role_name}</p>
              </div>
              <span
                className={`text-sm font-medium capitalize text-right shrink-0 ${
                  m.account_status === "active"
                    ? "text-accent"
                    : m.account_status === "pending"
                      ? "text-amber-500"
                      : "text-destructive"
                }`}
              >
                {m.account_status === "pending" ? "Pending" : m.account_status}
              </span>
            </div>

            <DataCardField label="ID" value={m.user_id} />
            <DataCardField label="Email" value={m.email} />
            <DataCardField label="Phone" value={m.phone_no ?? "—"} />
            <DataCardField
              label="Joined"
              value={new Date(m.created_at).toISOString().slice(0, 10)}
            />

            <div className="pt-2 border-t border-border">
              <MemberActions
                member={m}
                currentUserId={userId}
                onEdit={openEdit}
                onToggleActive={toggleActive}
                onDelete={deleteMember}
              />
            </div>
          </DataCard>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {members.length === 0 ? "No staff found" : "No staff match this filter"}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}
