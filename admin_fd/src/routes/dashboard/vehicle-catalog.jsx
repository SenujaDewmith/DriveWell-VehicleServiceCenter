import { useState, useEffect, useMemo } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Combobox } from "@/components/ui/combobox";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const inputClass = (hasError) =>
  `w-full border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${hasError ? "border-destructive" : "border-border"}`;

// Fast client-side pre-check so a duplicate name is caught immediately, without a round
// trip — the backend still enforces this authoritatively (case-insensitively, and via a
// DB unique constraint as a backstop), so a stale/incomplete client list can't let a real
// duplicate through, it just means this pre-check occasionally misses one and the save
// request comes back with the same error instead.
const isDuplicateName = (items, name, idField, excludeId) =>
  items.some(
    (item) => item.name.toLowerCase() === name.toLowerCase() && item[idField] !== excludeId,
  );

// ---- Makes tab --------------------------------------------------------------

function MakesTab() {
  const [makes, setMakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [initialName, setInitialName] = useState("");
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");

  const load = () => {
    setLoading(true);
    api
      .get("/api/admin/vehicle-catalog/makes")
      .then((d) => setMakes(d.makes))
      .catch(() => setPageError("Failed to load makes"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openNew = () => {
    setEditing(null);
    setName("");
    setInitialName("");
    setNameError("");
    setShowForm(true);
    setPageError("");
  };

  const openEdit = (make) => {
    setEditing(make);
    setName(make.name);
    setInitialName(make.name);
    setNameError("");
    setShowForm(true);
    setPageError("");
  };

  const isDirty = name !== initialName;

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Name is required");
      return;
    }
    if (isDuplicateName(makes, trimmed, "make_id", editing?.make_id)) {
      setNameError("A make with this name already exists");
      return;
    }
    setSaving(true);
    setPageError("");
    try {
      if (editing) {
        await api.put(`/api/admin/vehicle-catalog/makes/${editing.make_id}`, { name: trimmed });
      } else {
        await api.post("/api/admin/vehicle-catalog/makes", { name: trimmed });
      }
      setShowForm(false);
      load();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (make) => {
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
        <p className="text-sm text-muted-foreground">
          Vehicle makes available to customers when registering a vehicle
        </p>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Make
        </button>
      </div>

      {pageError && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
          {pageError}
        </p>
      )}

      <Dialog open={showForm} onOpenChange={(open) => !saving && setShowForm(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Make" : "New Make"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              placeholder="e.g. Toyota"
              maxLength={100}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError("");
              }}
              className={inputClass(!!nameError)}
            />
            {nameError && <p className="text-sm text-destructive">{nameError}</p>}
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
              disabled={saving || (editing && !isDirty)}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : editing ? "Update Make" : "Create Make"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <tr
                  key={make.make_id}
                  className="border-b border-border last:border-0 hover:bg-muted/20"
                >
                  <td className="py-3 px-3 text-foreground font-semibold">{make.name}</td>
                  <td className="py-3 px-3 text-foreground">{make.model_count}</td>
                  <td className="py-3 px-3 text-foreground">{make.vehicle_count}</td>
                  <td className="py-3 px-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEdit(make)}
                        title="Edit"
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
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
                            <AlertDialogAction onClick={() => remove(make)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
              {makes.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    No makes yet.
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

// ---- Types tab --------------------------------------------------------------

function TypesTab() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [initialName, setInitialName] = useState("");
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");

  const load = () => {
    setLoading(true);
    api
      .get("/api/admin/vehicle-catalog/types")
      .then((d) => setTypes(d.types))
      .catch(() => setPageError("Failed to load types"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openNew = () => {
    setEditing(null);
    setName("");
    setInitialName("");
    setNameError("");
    setShowForm(true);
    setPageError("");
  };

  const openEdit = (type) => {
    setEditing(type);
    setName(type.name);
    setInitialName(type.name);
    setNameError("");
    setShowForm(true);
    setPageError("");
  };

  const isDirty = name !== initialName;

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Name is required");
      return;
    }
    if (isDuplicateName(types, trimmed, "type_id", editing?.type_id)) {
      setNameError("A type with this name already exists");
      return;
    }
    setSaving(true);
    setPageError("");
    try {
      if (editing) {
        await api.put(`/api/admin/vehicle-catalog/types/${editing.type_id}`, { name: trimmed });
      } else {
        await api.post("/api/admin/vehicle-catalog/types", { name: trimmed });
      }
      setShowForm(false);
      load();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (type) => {
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
        <p className="text-sm text-muted-foreground">
          Vehicle body/category types — includes types hidden from the customer app
        </p>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Type
        </button>
      </div>

      {pageError && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
          {pageError}
        </p>
      )}

      <Dialog open={showForm} onOpenChange={(open) => !saving && setShowForm(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Type" : "New Type"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              placeholder="e.g. Van & Minivan"
              maxLength={50}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError("");
              }}
              className={inputClass(!!nameError)}
            />
            {nameError && <p className="text-sm text-destructive">{nameError}</p>}
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
              disabled={saving || (editing && !isDirty)}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : editing ? "Update Type" : "Create Type"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <tr
                  key={type.type_id}
                  className="border-b border-border last:border-0 hover:bg-muted/20"
                >
                  <td className="py-3 px-3 text-foreground font-semibold">{type.name}</td>
                  <td className="py-3 px-3 text-foreground">{type.model_count}</td>
                  <td className="py-3 px-3 text-foreground">{type.vehicle_count}</td>
                  <td className="py-3 px-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEdit(type)}
                        title="Edit"
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
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
                            <AlertDialogAction onClick={() => remove(type)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
              {types.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    No types yet.
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

// ---- Models tab -------------------------------------------------------------

const EMPTY_MODEL_FORM = {
  name: "",
  make_id: "",
  vehicle_type_id: "",
  start_year: "",
  end_year: "",
};

function ModelsTab() {
  const [models, setModels] = useState([]);
  const [makes, setMakes] = useState([]);
  const [types, setTypes] = useState([]);
  const [makeFilter, setMakeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_MODEL_FORM);
  const [initialForm, setInitialForm] = useState(EMPTY_MODEL_FORM);
  const [nameError, setNameError] = useState("");
  const [makeError, setMakeError] = useState("");
  const [typeError, setTypeError] = useState("");
  const [yearError, setYearError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");

  const loadLookups = () => {
    Promise.all([
      api.get("/api/admin/vehicle-catalog/makes"),
      api.get("/api/admin/vehicle-catalog/types"),
    ])
      .then(([m, t]) => {
        setMakes(m.makes);
        setTypes(t.types);
      })
      .catch(() => setPageError("Failed to load makes/types"));
  };

  const loadModels = () => {
    setLoading(true);
    const query = makeFilter ? `?make_id=${makeFilter}` : "";
    api
      .get(`/api/admin/vehicle-catalog/models${query}`)
      .then((d) => setModels(d.models))
      .catch(() => setPageError("Failed to load models"))
      .finally(() => setLoading(false));
  };

  useEffect(loadLookups, []);
  useEffect(loadModels, [makeFilter]);

  const makeOptions = makes.map((m) => ({ value: m.make_id.toString(), label: m.name }));
  const typeOptions = types.map((t) => ({ value: t.type_id.toString(), label: t.name }));

  const openNew = () => {
    setEditing(null);
    const initial = { ...EMPTY_MODEL_FORM, make_id: makeFilter };
    setForm(initial);
    setInitialForm(initial);
    setNameError("");
    setMakeError("");
    setTypeError("");
    setYearError("");
    setShowForm(true);
    setPageError("");
  };

  const openEdit = (model) => {
    setEditing(model);
    const initial = {
      name: model.name,
      make_id: model.make_id.toString(),
      vehicle_type_id: model.vehicle_type_id?.toString() ?? "",
      start_year: model.start_year?.toString() ?? "",
      end_year: model.end_year?.toString() ?? "",
    };
    setForm(initial);
    setInitialForm(initial);
    setNameError("");
    setMakeError("");
    setTypeError("");
    setYearError("");
    setShowForm(true);
    setPageError("");
  };

  const isDirty = Object.keys(EMPTY_MODEL_FORM).some((key) => form[key] !== initialForm[key]);

  const save = async () => {
    let hasError = false;
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setNameError("Name is required");
      hasError = true;
    } else if (
      isDuplicateName(
        models.filter((m) => m.make_id === parseInt(form.make_id)),
        trimmedName,
        "model_id",
        editing?.model_id,
      )
    ) {
      setNameError("A model with this name already exists for this make");
      hasError = true;
    }
    if (!form.make_id) {
      setMakeError("Make is required");
      hasError = true;
    }
    if (!form.vehicle_type_id) {
      setTypeError("Vehicle type is required");
      hasError = true;
    }
    if (form.start_year && form.end_year && parseInt(form.start_year) > parseInt(form.end_year)) {
      setYearError("Start year must be before or equal to end year");
      hasError = true;
    }
    if (hasError) return;

    setSaving(true);
    setPageError("");
    const payload = {
      name: trimmedName,
      make_id: parseInt(form.make_id),
      vehicle_type_id: parseInt(form.vehicle_type_id),
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

  const remove = async (model) => {
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
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
          {pageError}
        </p>
      )}

      <Dialog open={showForm} onOpenChange={(open) => !saving && setShowForm(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Model" : "New Model"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">
                Name <span className="text-destructive">*</span>
              </label>
              <input
                placeholder="e.g. Corolla"
                maxLength={150}
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  if (nameError) setNameError("");
                }}
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
                onValueChange={(v) => {
                  setForm({ ...form, make_id: v });
                  if (makeError) setMakeError("");
                }}
                placeholder="Select make"
                searchPlaceholder="Search makes..."
                emptyText="No make found."
                className={makeError ? "border-destructive" : ""}
              />
              {makeError && <p className="text-sm text-destructive">{makeError}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">
                Vehicle Type <span className="text-destructive">*</span>
              </label>
              <Combobox
                options={typeOptions}
                value={form.vehicle_type_id}
                onValueChange={(v) => {
                  setForm({ ...form, vehicle_type_id: v });
                  if (typeError) setTypeError("");
                }}
                placeholder="Select type"
                searchPlaceholder="Search types..."
                emptyText="No type found."
                className={typeError ? "border-destructive" : ""}
              />
              {typeError && <p className="text-sm text-destructive">{typeError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Start Year</label>
                <input
                  type="number"
                  min="1900"
                  placeholder="e.g. 2018"
                  value={form.start_year}
                  onChange={(e) => {
                    setForm({ ...form, start_year: e.target.value });
                    if (yearError) setYearError("");
                  }}
                  className={inputClass(!!yearError)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">End Year</label>
                <input
                  type="number"
                  min="1900"
                  placeholder="e.g. 2023"
                  value={form.end_year}
                  onChange={(e) => {
                    setForm({ ...form, end_year: e.target.value });
                    if (yearError) setYearError("");
                  }}
                  className={inputClass(!!yearError)}
                />
              </div>
              {yearError && <p className="col-span-2 text-sm text-destructive">{yearError}</p>}
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
              disabled={saving || (editing && !isDirty)}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : editing ? "Update Model" : "Create Model"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <tr
                  key={model.model_id}
                  className="border-b border-border last:border-0 hover:bg-muted/20"
                >
                  <td className="py-3 px-3 text-foreground font-semibold">{model.name}</td>
                  <td className="py-3 px-3 text-foreground">{model.make_name}</td>
                  <td className="py-3 px-3 text-foreground">{model.vehicle_type_name ?? "—"}</td>
                  <td className="py-3 px-3 text-foreground">
                    {model.start_year || model.end_year
                      ? `${model.start_year ?? ""}–${model.end_year ?? ""}`
                      : "—"}
                  </td>
                  <td className="py-3 px-3 text-foreground">{model.vehicle_count}</td>
                  <td className="py-3 px-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEdit(model)}
                        title="Edit"
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
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
                            <AlertDialogAction onClick={() => remove(model)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
              {models.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No models found.
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

// ---- Pending submissions tab --------------------------------------------------

function groupPending(submissions) {
  const groups = new Map();
  for (const s of submissions) {
    const key = `${s.make_id ?? `custom:${s.custom_make}`}|${s.custom_model}`;
    const existing = groups.get(key);
    const customerLabel = s.customer_name ?? s.customer_email ?? "Unknown customer";
    if (existing) {
      existing.vehicleIds.push(s.vehicle_id);
      existing.plates.push(s.plate_no);
      if (!existing.customers.includes(customerLabel)) existing.customers.push(customerLabel);
      if (s.year != null) existing.years.push(s.year);
    } else {
      groups.set(key, {
        key,
        makeId: s.make_id,
        makeName: s.make_name,
        customMake: s.custom_make,
        customModel: s.custom_model ?? "",
        // Vehicle type is a required field on every vehicle submission (never
        // custom-typed), so we can carry it straight through to a new model —
        // it's the type the customer already picked, not a guess.
        vehicleTypeId: s.vehicle_type_id,
        vehicleTypeName: s.vehicle_type,
        years: s.year != null ? [s.year] : [],
        vehicleIds: [s.vehicle_id],
        plates: [s.plate_no],
        customers: [customerLabel],
      });
    }
  }
  return Array.from(groups.values());
}

function PendingGroupCard({ group, makes, onMakeCreated, onResolved }) {
  const [selectedMakeId, setSelectedMakeId] = useState(group.makeId ? group.makeId.toString() : "");
  const [models, setModels] = useState([]);
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
      .get(`/api/admin/vehicle-catalog/models?make_id=${selectedMakeId}`)
      .then((d) => setModels(d.models))
      .catch(() => setError("Failed to load models"))
      .finally(() => setLoadingModels(false));
  }, [selectedMakeId]);

  const makeOptions = makes.map((m) => ({ value: m.make_id.toString(), label: m.name }));
  const modelOptions = models.map((m) => ({ value: m.model_id.toString(), label: m.name }));

  const createMake = async (label) => {
    setError("");
    try {
      const { make } = await api.post("/api/admin/vehicle-catalog/makes", { name: label });
      onMakeCreated(make);
      setSelectedMakeId(make.make_id.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create make");
    }
  };

  const createModel = async (label) => {
    if (!selectedMakeId) return;
    setError("");
    try {
      // Carry over the type/year the customer already supplied on their vehicle
      // submission, instead of leaving a freshly-created model blank.
      const { model } = await api.post("/api/admin/vehicle-catalog/models", {
        name: label,
        make_id: parseInt(selectedMakeId),
        vehicle_type_id: group.vehicleTypeId ?? null,
        start_year: group.years.length ? Math.min(...group.years) : null,
        end_year: group.years.length ? Math.max(...group.years) : null,
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
            {group.vehicleIds.length} vehicle{group.vehicleIds.length > 1 ? "s" : ""}:{" "}
            {group.plates.join(", ")}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Submitted by {group.customers.join(", ")} • Type: {group.vehicleTypeName}
            {group.years.length > 0 && (
              <>
                {" "}
                • Year: {Math.min(...group.years)}
                {Math.max(...group.years) !== Math.min(...group.years) &&
                  `–${Math.max(...group.years)}`}
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground/70">
            Applied automatically if a new model is created below
          </p>
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
            // Seeds the search box with what the customer typed so the admin can fix a
            // typo or accept it as-is, instead of retyping the make from scratch.
            defaultSearch={!group.makeId ? (group.customMake ?? "") : ""}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Resolve to model</label>
          <Combobox
            options={modelOptions}
            value={selectedModelId}
            onValueChange={setSelectedModelId}
            placeholder={
              !selectedMakeId
                ? "Select make first"
                : loadingModels
                  ? "Loading..."
                  : "Select or create model"
            }
            searchPlaceholder="Search models..."
            emptyText="No model found."
            disabled={!selectedMakeId || loadingModels}
            onCreateOption={selectedMakeId ? createModel : undefined}
            defaultSearch={group.customModel}
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
  const [submissions, setSubmissions] = useState([]);
  const [makes, setMakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/api/admin/vehicle-catalog/pending-submissions"),
      api.get("/api/admin/vehicle-catalog/makes"),
    ])
      .then(([s, m]) => {
        setSubmissions(s.submissions);
        setMakes(m.makes);
      })
      .catch(() => setPageError("Failed to load pending submissions"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const groups = useMemo(() => groupPending(submissions), [submissions]);

  const handleResolved = (vehicleIds) => {
    setSubmissions((prev) => prev.filter((s) => !vehicleIds.includes(s.vehicle_id)));
  };

  const handleMakeCreated = (make) => {
    setMakes((prev) => [...prev, make].sort((a, b) => a.name.localeCompare(b.name)));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Vehicles whose make/model a customer typed manually because it wasn't in the catalog.
        Resolve each one by picking (or creating) the matching make and model — every vehicle in the
        group updates at once.
      </p>

      {pageError && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">
          {pageError}
        </p>
      )}

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading...
        </div>
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

export function VehicleCatalogPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Vehicle Catalog</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage the make/model/type catalog customers pick from, and resolve custom values they've
          typed in
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
