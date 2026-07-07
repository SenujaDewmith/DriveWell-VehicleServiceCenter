import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Plus, Pencil, ToggleLeft, ToggleRight } from "lucide-react";
import { api } from "@/lib/api";

export const Route = createFileRoute("/dashboard/packages")({
  component: PackagesPage,
});

interface ApiPackage {
  package_id: number;
  name: string;
  description: string | null;
  estimated_duration: number;
  price: string;
  is_active: boolean;
  created_at: string;
}

interface PackageForm {
  name: string;
  description: string;
  estimated_duration: number;
  price: number;
}

function PackagesPage() {
  const [packages, setPackages] = useState<ApiPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ApiPackage | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PackageForm>({ name: "", description: "", estimated_duration: 60, price: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api
      .get<{ packages: ApiPackage[] }>("/api/packages")
      .then((d) => setPackages(d.packages))
      .catch(() => setError("Failed to load packages"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openNew = () => {
    setForm({ name: "", description: "", estimated_duration: 60, price: 0 });
    setEditing(null);
    setShowForm(true);
    setError("");
  };

  const openEdit = (pkg: ApiPackage) => {
    setForm({
      name: pkg.name,
      description: pkg.description ?? "",
      estimated_duration: pkg.estimated_duration,
      price: parseFloat(pkg.price),
    });
    setEditing(pkg);
    setShowForm(true);
    setError("");
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await api.put(`/api/packages/${editing.package_id}`, form);
      } else {
        await api.post("/api/packages", form);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (pkg: ApiPackage) => {
    setError("");
    try {
      if (pkg.is_active) {
        await api.patch(`/api/packages/${pkg.package_id}/deactivate`);
      } else {
        await api.patch(`/api/packages/${pkg.package_id}/activate`);
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Toggle failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tighter">SERVICE PACKAGES</h1>
        <button
          onClick={openNew}
          className="flex items-center gap-2 border-2 border-accent bg-accent px-3 py-2 text-xs font-mono uppercase font-bold text-accent-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add Package
        </button>
      </div>

      {error && (
        <p className="text-xs font-mono text-destructive border border-destructive px-3 py-2">{error}</p>
      )}

      {showForm && (
        <div className="border-2 border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-extrabold uppercase">{editing ? "Edit" : "New"} Package</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border-2 border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
            />
            <input
              placeholder="Duration (minutes)"
              type="number"
              value={form.estimated_duration}
              onChange={(e) => setForm({ ...form, estimated_duration: Number(e.target.value) })}
              className="border-2 border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
            />
            <input
              placeholder="Price (LKR)"
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              className="border-2 border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
            />
            <input
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="border-2 border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="border-2 border-accent bg-accent px-4 py-2 text-xs font-mono uppercase font-bold text-accent-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="border-2 border-border px-4 py-2 text-xs font-mono uppercase text-muted-foreground hover:border-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="border-2 border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-xs font-mono text-muted-foreground">Loading...</div>
        ) : (
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
                <tr key={pkg.package_id} className="border-b border-border">
                  <td className="py-2 px-3 text-muted-foreground">{pkg.package_id}</td>
                  <td className="py-2 px-3 text-foreground">{pkg.name}</td>
                  <td className="py-2 px-3 text-foreground">
                    {parseFloat(pkg.price).toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-foreground">{pkg.estimated_duration} min</td>
                  <td className="py-2 px-3">
                    <span
                      className={`text-[10px] uppercase font-bold ${pkg.is_active ? "text-accent" : "text-muted-foreground"}`}
                    >
                      {pkg.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-2 px-3 flex gap-1">
                    <button
                      onClick={() => openEdit(pkg)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => toggleActive(pkg)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      {pkg.is_active ? (
                        <ToggleRight className="h-3 w-3 text-accent" />
                      ) : (
                        <ToggleLeft className="h-3 w-3" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
              {packages.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No packages found
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
