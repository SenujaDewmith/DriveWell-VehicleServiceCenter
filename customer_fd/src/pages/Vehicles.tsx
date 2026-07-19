import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import {
  vehiclesService,
  type Vehicle,
  type CreateVehiclePayload,
  type VehicleMake,
  type VehicleModel,
  type VehicleTypeOption,
} from "@/services/vehicles.service";
import { YEAR_OPTIONS } from "@/lib/vehicleYears";
import { Car, Edit, Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FormErrors {
  make_id?: string;
  model_id?: string;
  vehicle_type_id?: string;
  plate_no?: string;
}

function validateForm(data: {
  makeId: string;
  modelId: string;
  vehicleTypeId: string;
  plateNo: string;
}): FormErrors {
  const errors: FormErrors = {};
  if (!data.makeId) errors.make_id = "Make is required";
  if (!data.modelId) errors.model_id = "Model is required";
  if (!data.vehicleTypeId) errors.vehicle_type_id = "Vehicle type is required";
  if (!data.plateNo.trim()) {
    errors.plate_no = "Plate number is required";
  } else if (data.plateNo.trim().length < 2) {
    errors.plate_no = "Enter a valid plate number";
  }
  return errors;
}

export default function Vehicles() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const vehiclesQuery = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => vehiclesService.getVehicles().then((r) => r.vehicles),
    enabled: !!user,
  });
  const vehicles = vehiclesQuery.data ?? [];
  const loading = vehiclesQuery.isPending;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [makes, setMakes] = useState<VehicleMake[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [types, setTypes] = useState<VehicleTypeOption[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [pendingModelId, setPendingModelId] = useState<string | null>(null);

  const [makeId, setMakeId] = useState("");
  const [modelId, setModelId] = useState("");
  const [vehicleTypeId, setVehicleTypeId] = useState("");
  const [year, setYear] = useState("");
  const [plateNo, setPlateNo] = useState("");

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  useEffect(() => {
    if (vehiclesQuery.isError) toast.error("Failed to load vehicles");
  }, [vehiclesQuery.isError]);

  useEffect(() => {
    if (!dialogOpen) return;
    setLoadingLookups(true);
    Promise.all([vehiclesService.getMakes(), vehiclesService.getVehicleTypes()])
      .then(([{ makes }, { types }]) => {
        setMakes(makes);
        setTypes(types);
      })
      .catch(() => toast.error("Failed to load vehicle data"))
      .finally(() => setLoadingLookups(false));
  }, [dialogOpen]);

  useEffect(() => {
    if (!makeId) {
      setModels([]);
      setModelId("");
      return;
    }
    setLoadingModels(true);
    vehiclesService
      .getModels(parseInt(makeId))
      .then(({ models }) => {
        setModels(models);
        if (pendingModelId && models.some((m) => m.model_id.toString() === pendingModelId)) {
          setModelId(pendingModelId);
        } else {
          setModelId("");
        }
        setPendingModelId(null);
      })
      .catch(() => toast.error("Failed to load models"))
      .finally(() => setLoadingModels(false));
  }, [makeId]);

  const resetForm = () => {
    setMakeId("");
    setModelId("");
    setVehicleTypeId("");
    setYear("");
    setPlateNo("");
    setFormErrors({});
    setPendingModelId(null);
  };

  const openAdd = () => {
    setEditingVehicle(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormErrors({});
    setPendingModelId(vehicle.model_id.toString());
    setMakeId(vehicle.make_id.toString());
    setVehicleTypeId(vehicle.vehicle_type_id.toString());
    setYear(vehicle.year ? String(vehicle.year) : "");
    setPlateNo(vehicle.plate_no);
    setDialogOpen(true);
  };

  const closeDialog = (open: boolean) => {
    if (saving) return;
    if (!open) resetForm();
    setDialogOpen(open);
  };

  const handleModelChange = (value: string) => {
    setModelId(value);
    if (formErrors.model_id) setFormErrors({ ...formErrors, model_id: undefined });
    const model = models.find((m) => m.model_id.toString() === value);
    if (model?.vehicle_type_id) {
      setVehicleTypeId(model.vehicle_type_id.toString());
      if (formErrors.vehicle_type_id) setFormErrors({ ...formErrors, vehicle_type_id: undefined });
    }
  };

  const handleDelete = async (vehicle: Vehicle) => {
    setDeletingId(vehicle.vehicle_id);
    try {
      await vehiclesService.deleteVehicle(vehicle.vehicle_id);
      queryClient.setQueryData<Vehicle[]>(["vehicles"], (prev) =>
        (prev ?? []).filter((v) => v.vehicle_id !== vehicle.vehicle_id)
      );
      toast.success("Vehicle removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete vehicle");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateForm({ makeId, modelId, vehicleTypeId, plateNo });
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setSaving(true);
    const payload: CreateVehiclePayload = {
      make_id: parseInt(makeId),
      model_id: parseInt(modelId),
      vehicle_type_id: parseInt(vehicleTypeId),
      plate_no: plateNo.trim(),
      ...(year ? { year: parseInt(year) } : {}),
    };
    try {
      if (editingVehicle) {
        const { vehicle } = await vehiclesService.updateVehicle(editingVehicle.vehicle_id, payload);
        queryClient.setQueryData<Vehicle[]>(["vehicles"], (prev) =>
          (prev ?? []).map((v) => (v.vehicle_id === editingVehicle.vehicle_id ? vehicle : v))
        );
        toast.success("Vehicle updated");
      } else {
        const { vehicle } = await vehiclesService.createVehicle(payload);
        queryClient.setQueryData<Vehicle[]>(["vehicles"], (prev) => [vehicle, ...(prev ?? [])]);
        toast.success("Vehicle added");
      }
      setDialogOpen(false);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save vehicle");
    } finally {
      setSaving(false);
    }
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
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium">{vehicle.vehicle_type}</span>
                  </p>
                  {vehicle.year && (
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Year</span>
                      <span className="font-medium">{vehicle.year}</span>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingVehicle ? "Edit Vehicle" : "Add New Vehicle"}</DialogTitle>
          </DialogHeader>
          {loadingLookups ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-cta" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Make <span className="text-destructive">*</span></Label>
                  <Combobox
                    options={makes.map((m) => ({ value: m.make_id.toString(), label: m.name }))}
                    value={makeId}
                    onValueChange={(v) => {
                      setMakeId(v);
                      if (formErrors.make_id) setFormErrors({ ...formErrors, make_id: undefined });
                    }}
                    placeholder="Select make"
                    searchPlaceholder="Search makes..."
                    emptyText="No make found."
                    className={formErrors.make_id ? "border-destructive" : ""}
                  />
                  {formErrors.make_id && <p className="text-xs text-destructive">{formErrors.make_id}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Model <span className="text-destructive">*</span></Label>
                  <Combobox
                    options={models.map((m) => ({ value: m.model_id.toString(), label: m.name }))}
                    value={modelId}
                    onValueChange={handleModelChange}
                    placeholder={!makeId ? "Select make first" : loadingModels ? "Loading..." : "Select model"}
                    searchPlaceholder="Search models..."
                    emptyText="No model found."
                    disabled={!makeId || loadingModels}
                    className={formErrors.model_id ? "border-destructive" : ""}
                  />
                  {formErrors.model_id && <p className="text-xs text-destructive">{formErrors.model_id}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Vehicle Type <span className="text-destructive">*</span></Label>
                  <Combobox
                    options={types.map((t) => ({ value: t.type_id.toString(), label: t.name }))}
                    value={vehicleTypeId}
                    onValueChange={(v) => {
                      setVehicleTypeId(v);
                      if (formErrors.vehicle_type_id) setFormErrors({ ...formErrors, vehicle_type_id: undefined });
                    }}
                    placeholder="Select type"
                    searchPlaceholder="Search types..."
                    emptyText="No type found."
                    className={formErrors.vehicle_type_id ? "border-destructive" : ""}
                  />
                  {formErrors.vehicle_type_id && <p className="text-xs text-destructive">{formErrors.vehicle_type_id}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Year of Manufacture (YOM)</Label>
                  <Combobox
                    options={YEAR_OPTIONS}
                    value={year}
                    onValueChange={setYear}
                    placeholder="Select year"
                    searchPlaceholder="Search year..."
                    emptyText="No year found."
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="plate_no">Plate Number <span className="text-destructive">*</span></Label>
                  <Input
                    id="plate_no"
                    placeholder="e.g. CAA-1234"
                    value={plateNo}
                    onChange={(e) => {
                      setPlateNo(e.target.value);
                      if (formErrors.plate_no) setFormErrors({ ...formErrors, plate_no: undefined });
                    }}
                    className={formErrors.plate_no ? "border-destructive" : ""}
                  />
                  {formErrors.plate_no && <p className="text-xs text-destructive">{formErrors.plate_no}</p>}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => closeDialog(false)}
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
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
