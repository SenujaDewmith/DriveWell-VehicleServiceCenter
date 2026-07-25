import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
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

export const Route = createFileRoute("/dashboard/vehicle-catalog")({
  component: VehicleCatalogPage,
});

interface ApiMake {
  make_id: number;
  name: string;
  model_count: number;
  vehicle_count: number;
}

interface ApiModel {
  model_id: number;
  name: string;
  make_id: number;
  make_name: string;
  vehicle_type_id: number | null;
  vehicle_type_name: string | null;
  start_year: number | null;
  end_year: number | null;
  vehicle_count: number;
}

interface ApiType {
  type_id: number;
  name: string;
  model_count: number;
  vehicle_count: number;
}

interface ApiPendingSubmission {
  vehicle_id: number;
  plate_no: string;
  make_id: number | null;
  make_name: string | null;
  custom_make: string | null;
  custom_model: string | null;
  vehicle_type: string;
  year: number | null;
  customer_name: string | null;
  customer_email: string | null;
  created_at: string;
}

const inputClass = (hasError?: boolean) =>
  `w-full border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${hasError ? "border-destructive" : "border-border"}`;

// ---- Makes tab --------------------------------------------------------------

function MakesTab() {
  const [makes, setMakes] = useState<ApiMake[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ApiMake | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");

  const load = () => {
    setLoading(true);
    api
      .get<{ makes: ApiMake[] }>("/api/admin/vehicle-catalog/makes")
      .then((d) => setMakes(d.makes))
      .catch(() => setPageError("Failed to load makes"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openNew = () => {
    setEditing(null);
    setName("");
    setNameError("");
    setShowForm(true);
    setPageError("");
  };

  const openEdit = (make: ApiMake) => {
    setEditing(make);
    setName(make.name);
    setNameError("");
    setShowForm(true);
    setPageError("");
  };

  const save = async () => {
    if (!name.trim()) {
      setNameError("Name is required");
      return;
    }
    setSaving(true);
    setPageError("");
    try {
      if (editing) {
        await api.put(`/api/admin/vehicle-catalog/makes/${editing.make_id}`, { name: name.trim() });
      } else {
        await api.post("/api/admin/vehicle-catalog/makes", { name: name.trim() });
      }
      setShowForm(false);
      load();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (make: ApiMake) => {
    setPageError("");
    try {
      await api.delete(`/api/admin/vehicle-catalog/makes/${make.make_id}`);
      load();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Vehicle makes available to customers when registering a vehicle</p>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Make
        </button>
      </div>

      {pageError && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">{pageError}</p>
      )}

      {showForm && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">{editing ? "Edit Make" : "New Make"}</h3>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              placeholder="e.g. Toyota"
              maxLength={100}
              value={name}
              onChange={(e) => { setName(e.target.value); if (nameError) setNameError(""); }}
              className={inputClass(!!nameError)}
            />
            {nameError && <p className="text-sm text-destructive">{nameError}</p>}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : editing ? "Update Make" : "Create Make"}
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
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Models</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Vehicles</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {makes.map((make) => (
                <tr key={make.make_id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="py-3 px-3 text-foreground font-semibold">{make.name}</td>
                  <td className="py-3 px-3 text-foreground">{make.model_count}</td>
                  <td className="py-3 px-3 text-foreground">{make.vehicle_count}</td>
                  <td className="py-3 px-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(make)} title="Edit" className="p-1 text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            title="Delete"
                            disabled={make.model_count > 0 || make.vehicle_count > 0}
                            className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:hover:text-muted-foreground"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete "{make.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(make)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
              {makes.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">No makes yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---- Types tab --------------------------------------------------------------

function TypesTab() {
  const [types, setTypes] = useState<ApiType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ApiType | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");

  const load = () => {
    setLoading(true);
    api
      .get<{ types: ApiType[] }>("/api/admin/vehicle-catalog/types")
      .then((d) => setTypes(d.types))
      .catch(() => setPageError("Failed to load types"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openNew = () => {
    setEditing(null);
    setName("");
    setNameError("");
    setShowForm(true);
    setPageError("");
  };

  const openEdit = (type: ApiType) => {
    setEditing(type);
    setName(type.name);
    setNameError("");
    setShowForm(true);
    setPageError("");
  };

  const save = async () => {
    if (!name.trim()) {
      setNameError("Name is required");
      return;
    }
    setSaving(true);
    setPageError("");
    try {
      if (editing) {
        await api.put(`/api/admin/vehicle-catalog/types/${editing.type_id}`, { name: name.trim() });
      } else {
        await api.post("/api/admin/vehicle-catalog/types", { name: name.trim() });
      }
      setShowForm(false);
      load();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (type: ApiType) => {
    setPageError("");
    try {
      await api.delete(`/api/admin/vehicle-catalog/types/${type.type_id}`);
      load();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Vehicle body/category types — includes types hidden from the customer app</p>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Type
        </button>
      </div>

      {pageError && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">{pageError}</p>
      )}

      {showForm && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">{editing ? "Edit Type" : "New Type"}</h3>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              placeholder="e.g. Van & Minivan"
              maxLength={50}
              value={name}
              onChange={(e) => { setName(e.target.value); if (nameError) setNameError(""); }}
              className={inputClass(!!nameError)}
            />
            {nameError && <p className="text-sm text-destructive">{nameError}</p>}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : editing ? "Update Type" : "Create Type"}
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
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Models</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Vehicles</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {types.map((type) => (
                <tr key={type.type_id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="py-3 px-3 text-foreground font-semibold">{type.name}</td>
                  <td className="py-3 px-3 text-foreground">{type.model_count}</td>
                  <td className="py-3 px-3 text-foreground">{type.vehicle_count}</td>
                  <td className="py-3 px-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(type)} title="Edit" className="p-1 text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            title="Delete"
                            disabled={type.model_count > 0 || type.vehicle_count > 0}
                            className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:hover:text-muted-foreground"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete "{type.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(type)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
              {types.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">No types yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---- Models tab -------------------------------------------------------------

interface ModelForm {
  name: string;
  make_id: string;
  vehicle_type_id: string;
  start_year: string;
  end_year: string;
}

const EMPTY_MODEL_FORM: ModelForm = { name: "", make_id: "", vehicle_type_id: "", start_year: "", end_year: "" };

function ModelsTab() {
  const [models, setModels] = useState<ApiModel[]>([]);
  const [makes, setMakes] = useState<ApiMake[]>([]);
  const [types, setTypes] = useState<ApiType[]>([]);
  const [makeFilter, setMakeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ApiModel | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ModelForm>(EMPTY_MODEL_FORM);
  const [nameError, setNameError] = useState("");
  const [makeError, setMakeError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");

  const loadLookups = () => {
    Promise.all([
      api.get<{ makes: ApiMake[] }>("/api/admin/vehicle-catalog/makes"),
      api.get<{ types: ApiType[] }>("/api/admin/vehicle-catalog/types"),
    ])
      .then(([m, t]) => { setMakes(m.makes); setTypes(t.types); })
      .catch(() => setPageError("Failed to load makes/types"));
  };

  const loadModels = () => {
    setLoading(true);
    const query = makeFilter ? `?make_id=${makeFilter}` : "";
    api
      .get<{ models: ApiModel[] }>(`/api/admin/vehicle-catalog/models${query}`)
      .then((d) => setModels(d.models))
      .catch(() => setPageError("Failed to load models"))
      .finally(() => setLoading(false));
  };

  useEffect(loadLookups, []);
  useEffect(loadModels, [makeFilter]);

  const makeOptions: ComboboxOption[] = makes.map((m) => ({ value: m.make_id.toString(), label: m.name }));
  const typeOptions: ComboboxOption[] = types.map((t) => ({ value: t.type_id.toString(), label: t.name }));

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY_MODEL_FORM, make_id: makeFilter });
    setNameError("");
    setMakeError("");
    setShowForm(true);
    setPageError("");
  };

  const openEdit = (model: ApiModel) => {
    setEditing(model);
    setForm({
      name: model.name,
      make_id: model.make_id.toString(),
      vehicle_type_id: model.vehicle_type_id?.toString() ?? "",
      start_year: model.start_year?.toString() ?? "",
      end_year: model.end_year?.toString() ?? "",
    });
    setNameError("");
    setMakeError("");
    setShowForm(true);
    setPageError("");
  };

  const save = async () => {
    let hasError = false;
    if (!form.name.trim()) { setNameError("Name is required"); hasError = true; }
    if (!form.make_id) { setMakeError("Make is required"); hasError = true; }
    if (hasError) return;

    setSaving(true);
    setPageError("");
    const payload = {
      name: form.name.trim(),
      make_id: parseInt(form.make_id),
      vehicle_type_id: form.vehicle_type_id ? parseInt(form.vehicle_type_id) : null,
      start_year: form.start_year ? parseInt(form.start_year) : null,
      end_year: form.end_year ? parseInt(form.end_year) : null,
    };
    try {
      if (editing) {
        await api.put(`/api/admin/vehicle-catalog/models/${editing.model_id}`, payload);
      } else {
        await api.post("/api/admin/vehicle-catalog/models", payload);
      }
      setShowForm(false);
      loadModels();
      loadLookups();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (model: ApiModel) => {
    setPageError("");
    try {
      await api.delete(`/api/admin/vehicle-catalog/models/${model.model_id}`);
      loadModels();
      loadLookups();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="w-64">
          <Combobox
            options={makeOptions}
            value={makeFilter}
            onValueChange={setMakeFilter}
            placeholder="Filter by make"
            searchPlaceholder="Search makes..."
            emptyText="No make found."
          />
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Model
        </button>
      </div>

      {pageError && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">{pageError}</p>
      )}

      {showForm && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">{editing ? "Edit Model" : "New Model"}</h3>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">
                Name <span className="text-destructive">*</span>
              </label>
              <input
                placeholder="e.g. Corolla"
                maxLength={150}
                value={form.name}
                onChange={(e) => { setForm({ ...form, name: e.target.value }); if (nameError) setNameError(""); }}
                className={inputClass(!!nameError)}
              />
              {nameError && <p className="text-sm text-destructive">{nameError}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">
                Make <span className="text-destructive">*</span>
              </label>
              <Combobox
                options={makeOptions}
                value={form.make_id}
                onValueChange={(v) => { setForm({ ...form, make_id: v }); if (makeError) setMakeError(""); }}
                placeholder="Select make"
                searchPlaceholder="Search makes..."
                emptyText="No make found."
                className={makeError ? "border-destructive" : ""}
              />
              {makeError && <p className="text-sm text-destructive">{makeError}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Vehicle Type</label>
              <Combobox
                options={typeOptions}
                value={form.vehicle_type_id}
                onValueChange={(v) => setForm({ ...form, vehicle_type_id: v })}
                placeholder="Select type"
                searchPlaceholder="Search types..."
                emptyText="No type found."
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Start Year</label>
                <input
                  type="number"
                  placeholder="e.g. 2018"
                  value={form.start_year}
                  onChange={(e) => setForm({ ...form, start_year: e.target.value })}
                  className={inputClass()}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">End Year</label>
                <input
                  type="number"
                  placeholder="e.g. 2023"
                  value={form.end_year}
                  onChange={(e) => setForm({ ...form, end_year: e.target.value })}
                  className={inputClass()}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : editing ? "Update Model" : "Create Model"}
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
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Make</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Years</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Vehicles</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => (
                <tr key={model.model_id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="py-3 px-3 text-foreground font-semibold">{model.name}</td>
                  <td className="py-3 px-3 text-foreground">{model.make_name}</td>
                  <td className="py-3 px-3 text-foreground">{model.vehicle_type_name ?? "—"}</td>
                  <td className="py-3 px-3 text-foreground">
                    {model.start_year || model.end_year ? `${model.start_year ?? ""}–${model.end_year ?? ""}` : "—"}
                  </td>
                  <td className="py-3 px-3 text-foreground">{model.vehicle_count}</td>
                  <td className="py-3 px-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(model)} title="Edit" className="p-1 text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            title="Delete"
                            disabled={model.vehicle_count > 0}
                            className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:hover:text-muted-foreground"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete "{model.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(model)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
              {models.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">No models found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---- Pending submissions tab --------------------------------------------------

interface PendingGroup {
  key: string;
  makeId: number | null;
  makeName: string | null;
  customMake: string | null;
  customModel: string;
  vehicleIds: number[];
  plates: string[];
  customers: string[];
}

function groupPending(submissions: ApiPendingSubmission[]): PendingGroup[] {
  const groups = new Map<string, PendingGroup>();
  for (const s of submissions) {
    const key = `${s.make_id ?? `custom:${s.custom_make}`}|${s.custom_model}`;
    const existing = groups.get(key);
    const customerLabel = s.customer_name ?? s.customer_email ?? "Unknown customer";
    if (existing) {
      existing.vehicleIds.push(s.vehicle_id);
      existing.plates.push(s.plate_no);
      if (!existing.customers.includes(customerLabel)) existing.customers.push(customerLabel);
    } else {
      groups.set(key, {
        key,
        makeId: s.make_id,
        makeName: s.make_name,
        customMake: s.custom_make,
        customModel: s.custom_model ?? "",
        vehicleIds: [s.vehicle_id],
        plates: [s.plate_no],
        customers: [customerLabel],
      });
    }
  }
  return Array.from(groups.values());
}

function PendingGroupCard({
  group,
  makes,
  onMakeCreated,
  onResolved,
}: {
  group: PendingGroup;
  makes: ApiMake[];
  onMakeCreated: (make: ApiMake) => void;
  onResolved: (vehicleIds: number[]) => void;
}) {
  const [selectedMakeId, setSelectedMakeId] = useState(group.makeId ? group.makeId.toString() : "");
  const [models, setModels] = useState<ApiModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedMakeId) {
      setModels([]);
      setSelectedModelId("");
      return;
    }
    setLoadingModels(true);
    api
      .get<{ models: ApiModel[] }>(`/api/admin/vehicle-catalog/models?make_id=${selectedMakeId}`)
      .then((d) => setModels(d.models))
      .catch(() => setError("Failed to load models"))
      .finally(() => setLoadingModels(false));
  }, [selectedMakeId]);

  const makeOptions: ComboboxOption[] = makes.map((m) => ({ value: m.make_id.toString(), label: m.name }));
  const modelOptions: ComboboxOption[] = models.map((m) => ({ value: m.model_id.toString(), label: m.name }));

  const createMake = async (label: string) => {
    setError("");
    try {
      const { make } = await api.post<{ make: ApiMake }>("/api/admin/vehicle-catalog/makes", { name: label });
      onMakeCreated(make);
      setSelectedMakeId(make.make_id.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create make");
    }
  };

  const createModel = async (label: string) => {
    if (!selectedMakeId) return;
    setError("");
    try {
      const { model } = await api.post<{ model: ApiModel }>("/api/admin/vehicle-catalog/models", {
        name: label,
        make_id: parseInt(selectedMakeId),
      });
      setModels((prev) => [...prev, model]);
      setSelectedModelId(model.model_id.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create model");
    }
  };

  const resolve = async () => {
    if (!selectedMakeId || !selectedModelId) return;
    setResolving(true);
    setError("");
    try {
      await api.post("/api/admin/vehicle-catalog/pending-submissions/resolve", {
        vehicle_ids: group.vehicleIds,
        make_id: parseInt(selectedMakeId),
        model_id: parseInt(selectedModelId),
      });
      onResolved(group.vehicleIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resolve failed");
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-semibold text-foreground">
            {group.makeName ?? group.customMake} — {group.customModel}
          </p>
          <p className="text-sm text-muted-foreground">
            {group.vehicleIds.length} vehicle{group.vehicleIds.length > 1 ? "s" : ""}: {group.plates.join(", ")}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Submitted by {group.customers.join(", ")}</p>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Resolve to make</label>
          <Combobox
            options={makeOptions}
            value={selectedMakeId}
            onValueChange={(v) => setSelectedMakeId(v)}
            placeholder="Select or create make"
            searchPlaceholder="Search makes..."
            emptyText="No make found."
            onCreateOption={createMake}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Resolve to model</label>
          <Combobox
            options={modelOptions}
            value={selectedModelId}
            onValueChange={setSelectedModelId}
            placeholder={!selectedMakeId ? "Select make first" : loadingModels ? "Loading..." : "Select or create model"}
            searchPlaceholder="Search models..."
            emptyText="No model found."
            disabled={!selectedMakeId || loadingModels}
            onCreateOption={selectedMakeId ? createModel : undefined}
          />
        </div>
        <button
          onClick={resolve}
          disabled={!selectedMakeId || !selectedModelId || resolving}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {resolving ? "Resolving..." : "Resolve"}
        </button>
      </div>
    </div>
  );
}

function PendingSubmissionsTab() {
  const [submissions, setSubmissions] = useState<ApiPendingSubmission[]>([]);
  const [makes, setMakes] = useState<ApiMake[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<{ submissions: ApiPendingSubmission[] }>("/api/admin/vehicle-catalog/pending-submissions"),
      api.get<{ makes: ApiMake[] }>("/api/admin/vehicle-catalog/makes"),
    ])
      .then(([s, m]) => { setSubmissions(s.submissions); setMakes(m.makes); })
      .catch(() => setPageError("Failed to load pending submissions"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const groups = useMemo(() => groupPending(submissions), [submissions]);

  const handleResolved = (vehicleIds: number[]) => {
    setSubmissions((prev) => prev.filter((s) => !vehicleIds.includes(s.vehicle_id)));
  };

  const handleMakeCreated = (make: ApiMake) => {
    setMakes((prev) => [...prev, make].sort((a, b) => a.name.localeCompare(b.name)));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Vehicles whose make/model a customer typed manually because it wasn't in the catalog. Resolve each one by
        picking (or creating) the matching make and model — every vehicle in the group updates at once.
      </p>

      {pageError && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">{pageError}</p>
      )}

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading...</div>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No pending customer submissions right now.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <PendingGroupCard
              key={group.key}
              group={group}
              makes={makes}
              onMakeCreated={handleMakeCreated}
              onResolved={handleResolved}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Page ---------------------------------------------------------------

function VehicleCatalogPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Vehicle Catalog</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage the make/model/type catalog customers pick from, and resolve custom values they've typed in
        </p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending Submissions</TabsTrigger>
          <TabsTrigger value="makes">Makes</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="types">Types</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <PendingSubmissionsTab />
        </TabsContent>
        <TabsContent value="makes">
          <MakesTab />
        </TabsContent>
        <TabsContent value="models">
          <ModelsTab />
        </TabsContent>
        <TabsContent value="types">
          <TypesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
