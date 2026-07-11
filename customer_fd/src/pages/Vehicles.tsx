import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { vehiclesService, type Vehicle, type CreateVehiclePayload } from "@/services/vehicles.service";
import { Car, Edit, Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FormData {
  make: string;
  model: string;
  year: string;
  plate_no: string;
  color: string;
}

interface FormErrors {
  make?: string;
  model?: string;
  plate_no?: string;
  year?: string;
}

const EMPTY_FORM: FormData = { make: "", model: "", year: "", plate_no: "", color: "" };

function validateForm(data: FormData): FormErrors {
  const errors: FormErrors = {};
  if (!data.make.trim()) errors.make = "Make is required";
  if (!data.model.trim()) errors.model = "Model is required";
  if (!data.plate_no.trim()) {
    errors.plate_no = "Plate number is required";
  } else if (data.plate_no.trim().length < 2) {
    errors.plate_no = "Enter a valid plate number";
  }
  if (data.year) {
    const y = parseInt(data.year);
    if (isNaN(y) || y < 1900 || y > new Date().getFullYear() + 1) {
      errors.year = `Year must be between 1900 and ${new Date().getFullYear() + 1}`;
    }
  }
  return errors;
}

export default function Vehicles() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    loadVehicles();
  }, [user, navigate]);

  const loadVehicles = () => {
    setLoading(true);
    vehiclesService
      .getVehicles()
      .then(({ vehicles }) => setVehicles(vehicles))
      .catch(() => toast.error("Failed to load vehicles"))
      .finally(() => setLoading(false));
  };

  const openAdd = () => {
    setEditingVehicle(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setDialogOpen(true);
  };

  const openEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setForm({
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year ? String(vehicle.year) : "",
      plate_no: vehicle.plate_no,
      color: vehicle.color ?? "",
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleDelete = async (vehicle: Vehicle) => {
    setDeletingId(vehicle.vehicle_id);
    try {
      await vehiclesService.deleteVehicle(vehicle.vehicle_id);
      setVehicles((prev) => prev.filter((v) => v.vehicle_id !== vehicle.vehicle_id));
      toast.success("Vehicle removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete vehicle");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setSaving(true);
    const payload: CreateVehiclePayload = {
      make: form.make.trim(),
      model: form.model.trim(),
      plate_no: form.plate_no.trim(),
      ...(form.year ? { year: parseInt(form.year) } : {}),
      ...(form.color.trim() ? { color: form.color.trim() } : {}),
    };
    try {
      if (editingVehicle) {
        const { vehicle } = await vehiclesService.updateVehicle(editingVehicle.vehicle_id, payload);
        setVehicles((prev) =>
          prev.map((v) => (v.vehicle_id === editingVehicle.vehicle_id ? vehicle : v))
        );
        toast.success("Vehicle updated");
      } else {
        const { vehicle } = await vehiclesService.createVehicle(payload);
        setVehicles((prev) => [vehicle, ...prev]);
        toast.success("Vehicle added");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save vehicle");
    } finally {
      setSaving(false);
    }
  };

  const setField = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [key]: e.target.value });
    if (formErrors[key as keyof FormErrors]) setFormErrors({ ...formErrors, [key]: undefined });
  };

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">My Vehicles</h1>
          <p className="text-muted-foreground">Manage your registered vehicles</p>
        </div>
        <Button className="bg-cta text-cta-foreground hover:bg-cta/90" onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Vehicle
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-cta" />
        </div>
      ) : vehicles.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Car className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No vehicles yet</h3>
            <p className="text-muted-foreground mb-4">Add your first vehicle to start booking services</p>
            <Button className="bg-cta text-cta-foreground hover:bg-cta/90" onClick={openAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add Vehicle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vehicles.map((vehicle) => (
            <Card key={vehicle.vehicle_id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="h-12 w-12 bg-cta/10 rounded-lg flex items-center justify-center">
                    <Car className="h-6 w-6 text-cta" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(vehicle)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={deletingId === vehicle.vehicle_id}
                      onClick={() => handleDelete(vehicle)}
                    >
                      {deletingId === vehicle.vehicle_id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <h3 className="text-xl font-bold mb-1">{vehicle.make} {vehicle.model}</h3>
                <div className="space-y-1 text-sm mt-3">
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">Plate Number</span>
                    <span className="font-medium">{vehicle.plate_no}</span>
                  </p>
                  {vehicle.year && (
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Year</span>
                      <span className="font-medium">{vehicle.year}</span>
                    </p>
                  )}
                  {vehicle.color && (
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Color</span>
                      <span className="font-medium">{vehicle.color}</span>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!saving) setDialogOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingVehicle ? "Edit Vehicle" : "Add New Vehicle"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="make">Make <span className="text-destructive">*</span></Label>
                <Input
                  id="make"
                  placeholder="e.g. Toyota"
                  value={form.make}
                  onChange={setField("make")}
                  className={formErrors.make ? "border-destructive" : ""}
                />
                {formErrors.make && <p className="text-xs text-destructive">{formErrors.make}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model <span className="text-destructive">*</span></Label>
                <Input
                  id="model"
                  placeholder="e.g. Corolla"
                  value={form.model}
                  onChange={setField("model")}
                  className={formErrors.model ? "border-destructive" : ""}
                />
                {formErrors.model && <p className="text-xs text-destructive">{formErrors.model}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="plate_no">Plate Number <span className="text-destructive">*</span></Label>
                <Input
                  id="plate_no"
                  placeholder="e.g. CAA-1234"
                  value={form.plate_no}
                  onChange={setField("plate_no")}
                  className={formErrors.plate_no ? "border-destructive" : ""}
                />
                {formErrors.plate_no && <p className="text-xs text-destructive">{formErrors.plate_no}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  placeholder="e.g. 2022"
                  value={form.year}
                  onChange={setField("year")}
                  className={formErrors.year ? "border-destructive" : ""}
                />
                {formErrors.year && <p className="text-xs text-destructive">{formErrors.year}</p>}
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  placeholder="e.g. Silver"
                  value={form.color}
                  onChange={setField("color")}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-cta text-cta-foreground hover:bg-cta/90"
                disabled={saving}
              >
                {saving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{editingVehicle ? "Updating..." : "Adding..."}</>
                ) : (
                  editingVehicle ? "Update Vehicle" : "Add Vehicle"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}