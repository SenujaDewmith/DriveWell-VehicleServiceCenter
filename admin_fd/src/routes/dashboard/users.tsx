import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { staff, type StaffMember, type Role } from "@/data/dummyData";
import { Plus, Pencil, UserX, UserCheck } from "lucide-react";

export const Route = createFileRoute("/dashboard/users")({
  component: UsersPage,
});

function UsersPage() {
  const [members, setMembers] = useState(staff);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [form, setForm] = useState({ name: "", role: "staff" as Role, phone: "" });

  const openNew = () => {
    setForm({ name: "", role: "staff", phone: "" });
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (m: StaffMember) => {
    setForm({ name: m.name, role: m.role, phone: m.phone });
    setEditing(m);
    setShowForm(true);
  };

  const save = () => {
    if (editing) {
      setMembers((prev) => prev.map((m) => m.id === editing.id ? { ...m, ...form } : m));
    } else {
      setMembers((prev) => [...prev, { id: `S${String(prev.length + 1).padStart(3, "0")}`, ...form, active: true, joinedDate: new Date().toISOString().slice(0, 10) }]);
    }
    setShowForm(false);
  };

  const toggleActive = (id: string) => {
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, active: !m.active } : m));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tighter">USER MANAGEMENT</h1>
        <button onClick={openNew} className="flex items-center gap-2 border-2 border-accent bg-accent px-3 py-2 text-xs font-mono uppercase font-bold text-accent-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> Add Staff
        </button>
      </div>

      {showForm && (
        <div className="border-2 border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-extrabold uppercase">{editing ? "Edit" : "New"} Staff</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input placeholder="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border-2 border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent" />
            <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="border-2 border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent" />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className="border-2 border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent">
              <option value="manager">Manager</option>
              <option value="supervisor">Supervisor</option>
              <option value="cashier">Cashier</option>
              <option value="staff">Service Staff</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="border-2 border-accent bg-accent px-4 py-2 text-xs font-mono uppercase font-bold text-accent-foreground hover:opacity-90">Save</button>
            <button onClick={() => setShowForm(false)} className="border-2 border-border px-4 py-2 text-xs font-mono uppercase text-muted-foreground hover:border-muted-foreground">Cancel</button>
          </div>
        </div>
      )}

      <div className="border-2 border-border bg-card overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b-2 border-border">
              <th className="text-left py-3 px-3 uppercase text-muted-foreground">ID</th>
              <th className="text-left py-3 px-3 uppercase text-muted-foreground">Name</th>
              <th className="text-left py-3 px-3 uppercase text-muted-foreground">Role</th>
              <th className="text-left py-3 px-3 uppercase text-muted-foreground">Phone</th>
              <th className="text-left py-3 px-3 uppercase text-muted-foreground">Joined</th>
              <th className="text-left py-3 px-3 uppercase text-muted-foreground">Status</th>
              <th className="text-left py-3 px-3 uppercase text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className={`border-b border-border ${!m.active ? "opacity-50" : ""}`}>
                <td className="py-2 px-3 text-muted-foreground">{m.id}</td>
                <td className="py-2 px-3 text-foreground">{m.name}</td>
                <td className="py-2 px-3 text-foreground uppercase">{m.role}</td>
                <td className="py-2 px-3 text-foreground">{m.phone}</td>
                <td className="py-2 px-3 text-foreground">{m.joinedDate}</td>
                <td className="py-2 px-3">
                  <span className={`text-[10px] uppercase font-bold ${m.active ? "text-accent" : "text-destructive"}`}>
                    {m.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="py-2 px-3 flex gap-1">
                  <button onClick={() => openEdit(m)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                  <button onClick={() => toggleActive(m.id)} className="p-1 text-muted-foreground hover:text-foreground">
                    {m.active ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
