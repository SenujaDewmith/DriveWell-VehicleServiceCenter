import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Plus, Pencil, ToggleLeft, ToggleRight, X, ImagePlus, Trash2, Car } from "lucide-react";
import { api, BASE } from "@/lib/api";

export const Route = createFileRoute("/dashboard/packages")({
  component: PackagesPage,
});

interface ApiPackage {
  package_id: number;
  name: string;
  package_code: string | null;
  description: string | null;
  estimated_duration: number;
  price: string;
  image_url: string | null;
  max_capacity: number;
  is_active: boolean;
  created_at: string;
}

interface PackageForm {
  name: string;
  // Holds only the part after "DWP-" — the prefix is locked in the UI and
  // reattached on save, so every code is consistently formatted.
  code_suffix: string;
  description: string;
  estimated_duration: number | "";
  price: number | "";
  max_capacity: number | "";
}

interface FormErrors {
  name?: string;
  code_suffix?: string;
  description?: string;
  estimated_duration?: string;
  price?: string;
  max_capacity?: string;
}

const PACKAGE_CODE_PREFIX = "DWP-";
const EMPTY_FORM: PackageForm = { name: "", code_suffix: "", description: "", estimated_duration: "", price: "", max_capacity: 3 };
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function imageSrc(image_url: string | null) {
  return image_url ? `${BASE}${image_url}` : null;
}

function validate(form: PackageForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.code_suffix.trim()) {
    errors.code_suffix = "Package code is required";
  } else if (!/^[A-Z0-9-]{1,16}$/.test(form.code_suffix.trim())) {
    errors.code_suffix = "Only letters, numbers, and hyphens — max 16 characters";
  }
  if (!form.name.trim()) {
    errors.name = "Name is required";
  } else if (form.name.trim().length > 100) {
    errors.name = "Name must be 100 characters or less";
  }
  if (!form.description.trim()) {
    errors.description = "Description is required";
  }
  if (form.estimated_duration === "" || form.estimated_duration === undefined) {
    errors.estimated_duration = "Duration is required";
  } else if (!Number.isInteger(Number(form.estimated_duration)) || Number(form.estimated_duration) < 30) {
    errors.estimated_duration = "Duration must be at least 30 minutes";
  }
  if (form.price === "" || form.price === undefined) {
    errors.price = "Price is required";
  } else if (Number(form.price) < 1) {
    errors.price = "Price must be at least LKR 1";
  }
  if (form.max_capacity === "" || form.max_capacity === undefined) {
    errors.max_capacity = "Max capacity is required";
  } else if (!Number.isInteger(Number(form.max_capacity)) || Number(form.max_capacity) < 1) {
    errors.max_capacity = "Max capacity must be at least 1";
  }
  return errors;
}

function fmtDuration(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

function PackagesPage() {
  const [packages, setPackages] = useState<ApiPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ApiPackage | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PackageForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState("");
  const [removingImage, setRemovingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [focusToken, setFocusToken] = useState(0);

  const load = () => {
    setLoading(true);
    api
      .get<{ packages: ApiPackage[] }>("/api/packages")
      .then((d) => setPackages(d.packages))
      .catch(() => setPageError("Failed to load packages"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  // Runs after the form has (re)opened — scroll it into view and move focus to
  // the first field, since the panel renders above the table and a click on a
  // row further down would otherwise open it off-screen.
  useEffect(() => {
    if (focusToken === 0) return;
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    nameInputRef.current?.focus();
  }, [focusToken]);

  const resetImageState = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setImageError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openNew = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setEditing(null);
    resetImageState();
    setShowForm(true);
    setPageError("");
    setFocusToken((t) => t + 1);
  };

  const openEdit = (pkg: ApiPackage) => {
    setForm({
      name: pkg.name,
      code_suffix: pkg.package_code?.startsWith(PACKAGE_CODE_PREFIX)
        ? pkg.package_code.slice(PACKAGE_CODE_PREFIX.length)
        : pkg.package_code ?? "",
      description: pkg.description ?? "",
      estimated_duration: pkg.estimated_duration,
      price: parseFloat(pkg.price),
      max_capacity: pkg.max_capacity,
    });
    setFormErrors({});
    resetImageState();
    setEditing(pkg);
    setShowForm(true);
    setPageError("");
    setFocusToken((t) => t + 1);
  };

  const closeForm = () => {
    setShowForm(false);
    setFormErrors({});
    resetImageState();
    setPageError("");
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError("Only JPEG, PNG, WEBP, or GIF images are allowed");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("Image must be 5MB or smaller");
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setImageError("");
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
        package_code: `${PACKAGE_CODE_PREFIX}${form.code_suffix.trim().toUpperCase()}`,
        description: form.description.trim(),
        estimated_duration: Number(form.estimated_duration),
        price: Number(form.price),
        max_capacity: Number(form.max_capacity),
      };

      let packageId = editing?.package_id;
      if (editing) {
        await api.put(`/api/packages/${editing.package_id}`, payload);
      } else {
        const res = await api.post<{ package: ApiPackage }>("/api/packages", payload);
        packageId = res.package.package_id;
      }

      if (imageFile && packageId) {
        const formData = new FormData();
        formData.append("image", imageFile);
        await api.upload(`/api/packages/${packageId}/image`, formData);
      }

      setShowForm(false);
      resetImageState();
      load();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const removeExistingImage = async () => {
    if (!editing) return;
    setRemovingImage(true);
    setPageError("");
    try {
      await api.delete(`/api/packages/${editing.package_id}/image`);
      setEditing({ ...editing, image_url: null });
      load();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Failed to remove image");
    } finally {
      setRemovingImage(false);
    }
  };

  const toggleActive = async (pkg: ApiPackage) => {
    setPageError("");
    try {
      if (pkg.is_active) {
        await api.patch(`/api/packages/${pkg.package_id}/deactivate`);
      } else {
        await api.patch(`/api/packages/${pkg.package_id}/activate`);
      }
      load();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Toggle failed");
    }
  };

  const field = (key: keyof PackageForm) => ({
    value: form[key] as string | number,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm({ ...form, [key]: e.target.value });
      if (formErrors[key]) setFormErrors({ ...formErrors, [key]: undefined });
    },
  });

  const currentImageSrc = imagePreview ?? imageSrc(editing?.image_url ?? null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Service Packages</h1>
        <button
          onClick={openNew}
          className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Package
        </button>
      </div>

      {pageError && (
        <p className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md px-3 py-2">{pageError}</p>
      )}

      {showForm && (
        <div ref={formRef} className="rounded-lg border border-border bg-card p-5 space-y-4 scroll-mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground">{editing ? "Edit Package" : "New Package"}</h3>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Image */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Package Image</label>
            <div className="flex items-start gap-4">
              <div className="h-28 w-40 rounded-lg border border-border bg-background flex items-center justify-center overflow-hidden shrink-0">
                {currentImageSrc ? (
                  <img src={currentImageSrc} alt="Package preview" className="h-full w-full object-cover" />
                ) : (
                  <Car className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleImageSelect}
                  className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-sm file:text-foreground hover:file:border-accent"
                />
                <p className="text-sm text-muted-foreground">JPEG, PNG, WEBP, or GIF — max 5MB</p>
                {imageError && <p className="text-sm text-destructive">{imageError}</p>}
                {editing?.image_url && !imageFile && (
                  <button
                    type="button"
                    onClick={removeExistingImage}
                    disabled={removingImage}
                    className="flex items-center gap-1 rounded-md border border-destructive px-2 py-1 text-sm text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" /> {removingImage ? "Removing..." : "Remove Image"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">
              Package Name <span className="text-destructive">*</span>
            </label>
            <input
              ref={nameInputRef}
              placeholder="e.g. Full Engine Service"
              maxLength={100}
              {...field("name")}
              className={`w-full border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${formErrors.name ? "border-destructive" : "border-border"}`}
            />
            {formErrors.name && (
              <p className="text-sm text-destructive">{formErrors.name}</p>
            )}
          </div>

          {/* Package Code */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">
              Package Code <span className="text-destructive">*</span>
            </label>
            <div className="flex max-w-xs">
              <span className="inline-flex items-center rounded-l-md border border-r-0 border-border bg-muted px-3 text-sm font-mono text-muted-foreground">
                {PACKAGE_CODE_PREFIX}
              </span>
              <input
                placeholder="e.g. 001"
                maxLength={16}
                value={form.code_suffix}
                onChange={(e) => {
                  setForm({ ...form, code_suffix: e.target.value.toUpperCase() });
                  if (formErrors.code_suffix) setFormErrors({ ...formErrors, code_suffix: undefined });
                }}
                className={`flex-1 min-w-0 border rounded-r-md bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${formErrors.code_suffix ? "border-destructive" : "border-border"}`}
              />
            </div>
            {formErrors.code_suffix ? (
              <p className="text-sm text-destructive">{formErrors.code_suffix}</p>
            ) : (
              <p className="text-sm text-muted-foreground">A short reference code shown to customers, e.g. {PACKAGE_CODE_PREFIX}001</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">
              What&apos;s Included / Description <span className="text-destructive">*</span>
            </label>
            <p className="text-sm text-muted-foreground">
              Enter each item on a new line — these will be shown as bullet points to customers
            </p>
            <textarea
              rows={5}
              placeholder={"Oil change & filter replacement\nBrake inspection\nFluid top-up\nTyre pressure check"}
              {...field("description")}
              className={`w-full border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y ${formErrors.description ? "border-destructive" : "border-border"}`}
            />
            {formErrors.description && (
              <p className="text-sm text-destructive">{formErrors.description}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Duration */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">
                Duration (minutes) <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                min={30}
                placeholder="e.g. 90"
                {...field("estimated_duration")}
                className={`w-full border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${formErrors.estimated_duration ? "border-destructive" : "border-border"}`}
              />
              {formErrors.estimated_duration ? (
                <p className="text-sm text-destructive">{formErrors.estimated_duration}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Minimum 30 minutes</p>
              )}
            </div>

            {/* Price */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">
                Price (LKR) <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                min={1}
                placeholder="e.g. 7500"
                {...field("price")}
                className={`w-full border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${formErrors.price ? "border-destructive" : "border-border"}`}
              />
              {formErrors.price ? (
                <p className="text-sm text-destructive">{formErrors.price}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Amount in Sri Lankan Rupees</p>
              )}
            </div>

            {/* Max Capacity */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">
                Max Capacity <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                min={1}
                placeholder="e.g. 3"
                {...field("max_capacity")}
                className={`w-full border rounded-md bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${formErrors.max_capacity ? "border-destructive" : "border-border"}`}
              />
              {formErrors.max_capacity ? (
                <p className="text-sm text-destructive">{formErrors.max_capacity}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Concurrent bookings allowed</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : editing ? "Update Package" : "Create Package"}
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
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Image</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Price (LKR)</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Duration</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Capacity</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.package_id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="py-2 px-3">
                    <div className="h-12 w-16 rounded-md border border-border bg-background flex items-center justify-center overflow-hidden">
                      {pkg.image_url ? (
                        <img src={imageSrc(pkg.image_url)!} alt={pkg.name} className="h-full w-full object-cover" />
                      ) : (
                        <ImagePlus className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    {pkg.package_code && (
                      <p className="mt-1 w-16 text-center text-[11px] font-mono text-muted-foreground">{pkg.package_code}</p>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <p className="text-foreground font-semibold">{pkg.name}</p>
                    {pkg.description && (
                      <p className="text-muted-foreground text-sm mt-0.5 line-clamp-2 max-w-xs">
                        {pkg.description.split("\n").filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-3 text-foreground">
                    {parseFloat(pkg.price).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-foreground">{fmtDuration(pkg.estimated_duration)}</td>
                  <td className="py-3 px-3 text-foreground">{pkg.max_capacity}</td>
                  <td className="py-3 px-3">
                    <span className={`text-sm font-medium ${pkg.is_active ? "text-accent" : "text-muted-foreground"}`}>
                      {pkg.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEdit(pkg)}
                        title="Edit"
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => toggleActive(pkg)}
                        title={pkg.is_active ? "Deactivate" : "Activate"}
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
                        {pkg.is_active ? (
                          <ToggleRight className="h-3 w-3 text-accent" />
                        ) : (
                          <ToggleLeft className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {packages.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No packages found. Click &ldquo;Add Package&rdquo; to create one.
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
