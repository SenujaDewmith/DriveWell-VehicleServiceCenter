import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Plus, Pencil, UserX, UserCheck } from "lucide-react";
import { api } from "@/lib/api";

export const Route = createFileRoute("/dashboard/users")({
  component: UsersPage,
});

interface ApiStaff {
  user_id: number;
  email: string;
  role_id: number;
  account_status: string;
  created_at: string;
  role_name: string;
  full_name: string;
  phone_no: string | null;
}

interface StaffForm {
  email: string;
  password: string;
  full_name: string;
  role_id: number;
  phone_no: string;
}

const ROLE_OPTIONS = [
  { id: 2, label: "Supervisor" },
  { id: 3, label: "Cashier" },
  { id: 4, label: "Service Staff" },
];

function UsersPage() {
  const [members, setMembers] = useState<ApiStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ApiStaff | null>(null);
  const [form, setForm] = useState<StaffForm>({ email: "", password: "", full_name: "", role_id: 4, phone_no: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api
      .get<{ staff: ApiStaff[] }>("/api/users/staff")
      .then((d) => setMembers(d.staff))
      .catch(() => setError("Failed to load staff"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openNew = () => {
    setForm({ email: "", password: "", full_name: "", role_id: 4, phone_no: "" });
    setEditing(null);
    setShowForm(true);
    setError("");
  };

  const openEdit = (m: ApiStaff) => {
    setForm({ email: m.email, password: "", full_name: m.full_name, role_id: m.role_id, phone_no: m.phone_no ?? "" });
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
          password: form.password,
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

  const toggleActive = async (m: ApiStaff) => {
    const next = m.account_status === "active" ? "inactive" : "active";
    setError("");
    try {
      await api.patch(`/api/users/${m.user_id}/status`, { account_status: next });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed");
    }
  };

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
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">{error}</p>
      )}

      {showForm && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-base font-semibold text-foreground">{editing ? "Edit" : "New"} Staff</h3>
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
              <input
                placeholder="Password (min 6 chars)"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            )}
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
              {members.map((m) => (
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
                      className={`text-sm font-medium capitalize ${m.account_status === "active" ? "text-accent" : "text-destructive"}`}
                    >
                      {m.account_status}
                    </span>
                  </td>
                  <td className="py-2 px-3 flex gap-1">
                    <button
                      onClick={() => openEdit(m)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => toggleActive(m)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      {m.account_status === "active" ? (
                        <UserX className="h-3 w-3" />
                      ) : (
                        <UserCheck className="h-3 w-3" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No staff found
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
