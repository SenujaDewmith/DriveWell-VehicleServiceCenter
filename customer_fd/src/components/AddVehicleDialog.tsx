import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2 } from "lucide-react";
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

interface AddVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVehicleAdded: (vehicle: Vehicle) => void;
}

export function AddVehicleDialog({ open, onOpenChange, onVehicleAdded }: AddVehicleDialogProps) {
  const [makes, setMakes] = useState<VehicleMake[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [types, setTypes] = useState<VehicleTypeOption[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);

  const [makeId, setMakeId] = useState("");
  const [modelId, setModelId] = useState("");
  const [vehicleTypeId, setVehicleTypeId] = useState("");
  const [year, setYear] = useState("");
  const [plateNo, setPlateNo] = useState("");

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingLookups(true);
    Promise.all([vehiclesService.getMakes(), vehiclesService.getVehicleTypes()])
      .then(([{ makes }, { types }]) => {
        setMakes(makes);
        setTypes(types);
      })
      .catch(() => toast.error("Failed to load vehicle data"))
      .finally(() => setLoadingLookups(false));
  }, [open]);

  useEffect(() => {
    if (!makeId) {
      setModels([]);
      setModelId("");
      return;
    }
    setLoadingModels(true);
    setModelId("");
    vehiclesService
      .getModels(parseInt(makeId))
      .then(({ models }) => setModels(models))
      .catch(() => toast.error("Failed to load models"))
      .finally(() => setLoadingModels(false));
  }, [makeId]);

  const handleModelChange = (value: string) => {
    setModelId(value);
    if (formErrors.model_id) setFormErrors({ ...formErrors, model_id: undefined });
    const model = models.find((m) => m.model_id.toString() === value);
    if (model?.vehicle_type_id) {
      setVehicleTypeId(model.vehicle_type_id.toString());
      if (formErrors.vehicle_type_id) setFormErrors({ ...formErrors, vehicle_type_id: undefined });
    }
  };

  const resetForm = () => {
    setMakeId("");
    setModelId("");
    setVehicleTypeId("");
    setYear("");
    setPlateNo("");
    setFormErrors({});
  };

  const close = (nextOpen: boolean) => {
    if (saving) return;
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
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
      const { vehicle } = await vehiclesService.createVehicle(payload);
      toast.success("Vehicle added");
      resetForm();
      onVehicleAdded(vehicle);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add vehicle");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Vehicle</DialogTitle>
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
                <Label htmlFor="add-plate_no">Plate Number <span className="text-destructive">*</span></Label>
                <Input
                  id="add-plate_no"
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
              <Button type="button" variant="outline" disabled={saving} onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-cta text-cta-foreground hover:bg-cta/90" disabled={saving}>
                {saving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding...</>
                ) : (
                  "Add Vehicle"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
