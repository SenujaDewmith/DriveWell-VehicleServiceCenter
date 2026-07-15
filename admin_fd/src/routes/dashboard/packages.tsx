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
  description: string | null;
  estimated_duration: number;
  price: string;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

interface PackageForm {
  name: string;
  description: string;
  estimated_duration: number | "";
  price: number | "";
}

interface FormErrors {
  name?: string;
  description?: string;
  estimated_duration?: string;
  price?: string;
}

const EMPTY_FORM: PackageForm = { name: "", description: "", estimated_duration: "", price: "" };
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function imageSrc(image_url: string | null) {
  return image_url ? `${BASE}${image_url}` : null;
}

function validate(form: PackageForm): FormErrors {
  const errors: FormErrors = {};
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
  };

  const openEdit = (pkg: ApiPackage) => {
    setForm({
      name: pkg.name,
      description: pkg.description ?? "",
      estimated_duration: pkg.estimated_duration,
      price: parseFloat(pkg.price),
    });
    setFormErrors({});
    resetImageState();
    setEditing(pkg);
    setShowForm(true);
    setPageError("");
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
        description: form.description.trim(),
        estimated_duration: Number(form.estimated_duration),
        price: Number(form.price),
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
        <h1 className="text-2xl font-extrabold tracking-tighter">SERVICE PACKAGES</h1>
        <button
          onClick={openNew}
          className="flex items-center gap-2 border-2 border-accent bg-accent px-3 py-2 text-xs font-mono uppercase font-bold text-accent-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add Package
        </button>
      </div>

      {pageError && (
        <p className="text-xs font-mono text-destructive border border-destructive px-3 py-2">{pageError}</p>
      )}

      {showForm && (
        <div className="border-2 border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold uppercase">{editing ? "Edit Package" : "New Package"}</h3>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Image */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase text-muted-foreground">Package Image</label>
            <div className="flex items-start gap-4">
              <div className="h-28 w-40 border-2 border-border bg-background flex items-center justify-center overflow-hidden shrink-0">
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
                  className="text-[10px] font-mono text-muted-foreground file:mr-3 file:border-2 file:border-border file:bg-card file:px-3 file:py-1.5 file:text-[10px] file:font-mono file:uppercase file:text-foreground hover:file:border-accent"
                />
                <p className="text-[10px] font-mono text-muted-foreground">JPEG, PNG, WEBP, or GIF — max 5MB</p>
                {imageError && <p className="text-[10px] font-mono text-destructive">{imageError}</p>}
                {editing?.image_url && !imageFile && (
                  <button
                    type="button"
                    onClick={removeExistingImage}
                    disabled={removingImage}
                    className="flex items-center gap-1 border-2 border-destructive px-2 py-1 text-[10px] font-mono uppercase text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" /> {removingImage ? "Removing..." : "Remove Image"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase text-muted-foreground">
              Package Name <span className="text-destructive">*</span>
            </label>
            <input
              placeholder="e.g. Full Engine Service"
              maxLength={100}
              {...field("name")}
              className={`w-full border-2 bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent ${formErrors.name ? "border-destructive" : "border-border"}`}
            />
            {formErrors.name && (
              <p className="text-[10px] font-mono text-destructive">{formErrors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase text-muted-foreground">
              What&apos;s Included / Description <span className="text-destructive">*</span>
            </label>
            <p className="text-[10px] font-mono text-muted-foreground">
              Enter each item on a new line — these will be shown as bullet points to customers
            </p>
            <textarea
              rows={5}
              placeholder={"Oil change & filter replacement\nBrake inspection\nFluid top-up\nTyre pressure check"}
              {...field("description")}
              className={`w-full border-2 bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent resize-y ${formErrors.description ? "border-destructive" : "border-border"}`}
            />
            {formErrors.description && (
              <p className="text-[10px] font-mono text-destructive">{formErrors.description}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Duration */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-muted-foreground">
                Duration (minutes) <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                min={30}
                placeholder="e.g. 90"
                {...field("estimated_duration")}
                className={`w-full border-2 bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent ${formErrors.estimated_duration ? "border-destructive" : "border-border"}`}
              />
              {formErrors.estimated_duration ? (
                <p className="text-[10px] font-mono text-destructive">{formErrors.estimated_duration}</p>
              ) : (
                <p className="text-[10px] font-mono text-muted-foreground">Minimum 30 minutes</p>
              )}
            </div>

            {/* Price */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-muted-foreground">
                Price (LKR) <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                min={1}
                placeholder="e.g. 7500"
                {...field("price")}
                className={`w-full border-2 bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-accent ${formErrors.price ? "border-destructive" : "border-border"}`}
              />
              {formErrors.price ? (
                <p className="text-[10px] font-mono text-destructive">{formErrors.price}</p>
              ) : (
                <p className="text-[10px] font-mono text-muted-foreground">Amount in Sri Lankan Rupees</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="border-2 border-accent bg-accent px-4 py-2 text-xs font-mono uppercase font-bold text-accent-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving..." : editing ? "Update Package" : "Create Package"}
            </button>
            <button
              onClick={closeForm}
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
                <th className="text-left py-3 px-3 uppercase text-muted-foreground">Image</th>
                <th className="text-left py-3 px-3 uppercase text-muted-foreground">Name</th>
                <th className="text-left py-3 px-3 uppercase text-muted-foreground">Price (LKR)</th>
                <th className="text-left py-3 px-3 uppercase text-muted-foreground">Duration</th>
                <th className="text-left py-3 px-3 uppercase text-muted-foreground">Status</th>
                <th className="text-left py-3 px-3 uppercase text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.package_id} className="border-b border-border hover:bg-muted/20">
                  <td className="py-2 px-3">
                    <div className="h-12 w-16 border border-border bg-background flex items-center justify-center overflow-hidden">
                      {pkg.image_url ? (
                        <img src={imageSrc(pkg.image_url)!} alt={pkg.name} className="h-full w-full object-cover" />
                      ) : (
                        <ImagePlus className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <p className="text-foreground font-bold">{pkg.name}</p>
                    {pkg.description && (
                      <p className="text-muted-foreground text-[10px] mt-0.5 line-clamp-2 max-w-xs">
                        {pkg.description.split("\n").filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-3 text-foreground">
                    {parseFloat(pkg.price).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-foreground">{fmtDuration(pkg.estimated_duration)}</td>
                  <td className="py-3 px-3">
                    <span className={`text-[10px] uppercase font-bold ${pkg.is_active ? "text-accent" : "text-muted-foreground"}`}>
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
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
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
