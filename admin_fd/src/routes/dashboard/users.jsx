import { useState, useEffect } from "react";
import { Plus, Pencil, UserX, UserCheck, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
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
  };

  const save = async () => {
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

      {showForm && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-base font-semibold text-foreground">
            {editing ? "Edit" : "New"} Staff
          </h3>
          {!editing && (
            <p className="text-xs text-muted-foreground">
              An email will be sent to set their password. The account stays pending until they do.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Full Name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              placeholder="Phone"
              value={form.phone_no}
              onChange={(e) => setForm({ ...form, phone_no: e.target.value })}
              className="border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {!editing && (
              <select
                value={form.role_id}
                onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })}
                className="border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:border-muted-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : (
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
                  <td className="py-2 px-3 flex gap-1">
                    <button
                      onClick={() => openEdit(m)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
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
                            <AlertDialogTitle>
                              Delete the pending invite for {m.full_name}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              You'll need to recreate the account to send a new invite.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMember(m)}>
                              Delete
                            </AlertDialogAction>
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
                                {m.account_status === "active" ? "Deactivate" : "Activate"}{" "}
                                {m.full_name}?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {m.account_status === "active"
                                  ? "They'll immediately lose access to the staff portal until reactivated."
                                  : "They'll be able to sign in to the staff portal again."}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => toggleActive(m)}>
                                {m.account_status === "active" ? "Deactivate" : "Activate"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        {m.user_id !== userId && (
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
                                <AlertDialogTitle>
                                  Permanently delete {m.full_name}?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This cannot be undone — their account and login access will be
                                  gone for good. Past invoices, service records, and job assignments
                                  keep their name for record-keeping, but nothing links back to a
                                  live account anymore. Use Deactivate instead if this might not be
                                  final.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMember(m)}>
                                  Permanently Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </>
                    )}
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
        )}
      </div>
    </div>
  );
}
