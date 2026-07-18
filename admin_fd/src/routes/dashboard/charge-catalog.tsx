import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Plus, Pencil, ToggleLeft, ToggleRight, X } from "lucide-react";
import { api } from "@/lib/api";

export const Route = createFileRoute("/dashboard/charge-catalog")({
  component: ChargeCatalogPage,
});

interface ApiChargeItem {
  catalog_item_id: number;
  name: string;
  description: string | null;
  default_price: string;
  category: string | null;
  is_active: boolean;
}

interface ItemForm {
  name: string;
  description: string;
  default_price: number | "";
  category: string;
}

interface FormErrors {
  name?: string;
  default_price?: string;
}

const EMPTY_FORM: ItemForm = { name: "", description: "", default_price: "", category: "" };

function validate(form: ItemForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = "Name is required";
  else if (form.name.trim().length > 150) errors.name = "Name must be 150 characters or less";
  if (form.default_price === "" || form.default_price === undefined) errors.default_price = "Default price is required";
  else if (Number(form.default_price) < 0) errors.default_price = "Price cannot be negative";
  return errors;
}

function ChargeCatalogPage() {
  const [items, setItems] = useState<ApiChargeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ApiChargeItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ItemForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");

  const load = () => {
    setLoading(true);
    api
      .get<{ items: ApiChargeItem[] }>("/api/charge-catalog")
      .then((d) => setItems(d.items))
      .catch(() => setPageError("Failed to load charge catalog"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setEditing(null);
    setShowForm(true);
    setPageError("");
  };

  const openEdit = (item: ApiChargeItem) => {
    setForm({
      name: item.name,
      description: item.description ?? "",
      default_price: parseFloat(item.default_price),
      category: item.category ?? "",
    });
    setFormErrors({});
    setEditing(item);
    setShowForm(true);
    setPageError("");
  };

  const closeForm = () => {
    setShowForm(false);
    setFormErrors({});
    setPageError("");
  };

  const save = async () => {
    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setSaving(true);
    setPageError("");
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        default_price: Number(form.default_price),
        category: form.category.trim() || null,
      };
      if (editing) {
        await api.put(`/api/charge-catalog/${editing.catalog_item_id}`, payload);
      } else {
        await api.post("/api/charge-catalog", payload);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: ApiChargeItem) => {
    setPageError("");
    try {
      if (item.is_active) {
        await api.patch(`/api/charge-catalog/${item.catalog_item_id}/deactivate`);
      } else {
        await api.patch(`/api/charge-catalog/${item.catalog_item_id}/activate`);
      }
      load();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Toggle failed");
    }
  };

  const field = (key: keyof ItemForm) => ({
    value: form[key] as string | number,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm({ ...form, [key]: e.target.value });
      if (key in formErrors) setFormErrors({ ...formErrors, [key]: undefined });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Charge Catalog</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reference price list for additional repairs/parts — used by cashiers when itemizing invoices
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Charge
        </button>
      </div>

      {pageError && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">{pageError}</p>
      )}

      {showForm && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">{editing ? "Edit Charge" : "New Charge"}</h3>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              placeholder="e.g. Brake Pad Replacement (Front)"
              maxLength={150}
              {...field("name")}
              className={`w-full border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${formErrors.name ? "border-destructive" : "border-border"}`}
            />
            {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Description</label>
            <textarea
              rows={2}
              placeholder="Optional notes for cashiers/supervisors"
              {...field("description")}
              className="w-full border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">
                Default Price (LKR) <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                min={0}
                placeholder="e.g. 3500"
                {...field("default_price")}
                className={`w-full border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${formErrors.default_price ? "border-destructive" : "border-border"}`}
              />
              {formErrors.default_price ? (
                <p className="text-sm text-destructive">{formErrors.default_price}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Suggested price — cashier can still adjust per invoice</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Category</label>
              <input
                placeholder="e.g. Parts, Labor, Add-on"
                {...field("category")}
                className="w-full border border-border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : editing ? "Update Charge" : "Create Charge"}
            </button>
            <button
              onClick={closeForm}
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
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Category</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Default Price (LKR)</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.catalog_item_id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="py-3 px-3">
                    <p className="text-foreground font-semibold">{item.name}</p>
                    {item.description && (
                      <p className="text-muted-foreground text-sm mt-0.5 max-w-xs">{item.description}</p>
                    )}
                  </td>
                  <td className="py-3 px-3 text-foreground">{item.category ?? "—"}</td>
                  <td className="py-3 px-3 text-foreground">{parseFloat(item.default_price).toLocaleString()}</td>
                  <td className="py-3 px-3">
                    <span className={`text-sm font-medium ${item.is_active ? "text-accent" : "text-muted-foreground"}`}>
                      {item.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(item)} title="Edit" className="p-1 text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => toggleActive(item)}
                        title={item.is_active ? "Deactivate" : "Activate"}
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
                        {item.is_active ? <ToggleRight className="h-3 w-3 text-accent" /> : <ToggleLeft className="h-3 w-3" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No charge catalog items yet. Click &ldquo;Add Charge&rdquo; to create one.
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
