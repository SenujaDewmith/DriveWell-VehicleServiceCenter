import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { servicePackages, type ServicePackage } from "@/data/dummyData";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/dashboard/packages")({
  component: PackagesPage,
});

function PackagesPage() {
  const [packages, setPackages] = useState(servicePackages);
  const [editing, setEditing] = useState<ServicePackage | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", basePrice: 0, duration: "", active: true });

  const openNew = () => {
    setForm({ name: "", description: "", basePrice: 0, duration: "", active: true });
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (pkg: ServicePackage) => {
    setForm({ name: pkg.name, description: pkg.description, basePrice: pkg.basePrice, duration: pkg.duration, active: pkg.active });
    setEditing(pkg);
    setShowForm(true);
  };

  const save = () => {
    if (editing) {
      setPackages((prev) => prev.map((p) => p.id === editing.id ? { ...p, ...form } : p));
    } else {
      setPackages((prev) => [...prev, { id: `PKG${String(prev.length + 1).padStart(3, "0")}`, ...form }]);
    }
    setShowForm(false);
  };

  const remove = (id: string) => setPackages((prev) => prev.filter((p) => p.id !== id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tighter">SERVICE PACKAGES</h1>
        <button onClick={openNew} className="flex items-center gap-2 border-2 border-accent bg-accent px-3 py-2 text-xs font-mono uppercase font-bold text-accent-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> Add Package
        </button>
      </div>

      {showForm && (
        <div className="border-2 border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-extrabold uppercase">{editing ? "Edit" : "New"} Package</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border-2 border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent" />
            <input placeholder="Duration" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} className="border-2 border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent" />
            <input placeholder="Base Price" type="number" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: Number(e.target.value) })} className="border-2 border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent" />
            <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="border-2 border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent" />
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
              <th className="text-left py-3 px-3 uppercase text-muted-foreground">Price (LKR)</th>
              <th className="text-left py-3 px-3 uppercase text-muted-foreground">Duration</th>
              <th className="text-left py-3 px-3 uppercase text-muted-foreground">Status</th>
              <th className="text-left py-3 px-3 uppercase text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((pkg) => (
              <tr key={pkg.id} className="border-b border-border">
                <td className="py-2 px-3 text-muted-foreground">{pkg.id}</td>
                <td className="py-2 px-3 text-foreground">{pkg.name}</td>
                <td className="py-2 px-3 text-foreground">{pkg.basePrice.toLocaleString()}</td>
                <td className="py-2 px-3 text-foreground">{pkg.duration}</td>
                <td className="py-2 px-3">
                  <span className={`text-[10px] uppercase font-bold ${pkg.active ? "text-accent" : "text-muted-foreground"}`}>
                    {pkg.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="py-2 px-3 flex gap-1">
                  <button onClick={() => openEdit(pkg)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                  <button onClick={() => remove(pkg.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
