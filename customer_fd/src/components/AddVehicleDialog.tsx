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
import { isValidSriLankanPlate } from "@/lib/plateNumber";
import { PlateNumberInput } from "@/components/ui/plate-number-input";
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
  useCustomMake: boolean;
  customMake: string;
  modelId: string;
  useCustomModel: boolean;
  customModel: string;
  vehicleTypeId: string;
  plateNo: string;
}): FormErrors {
  const errors: FormErrors = {};
  if (data.useCustomMake) {
    if (!data.customMake.trim()) errors.make_id = "Enter the make";
  } else if (!data.makeId) {
    errors.make_id = "Make is required";
  }
  if (data.useCustomModel) {
    if (!data.customModel.trim()) errors.model_id = "Enter the model";
  } else if (!data.modelId) {
    errors.model_id = "Model is required";
  }
  if (!data.vehicleTypeId) errors.vehicle_type_id = "Vehicle type is required";
  if (!data.plateNo.trim()) {
    errors.plate_no = "Plate number is required";
  } else if (!isValidSriLankanPlate(data.plateNo)) {
    errors.plate_no = "Enter a valid Sri Lankan plate number (e.g. CAB-1234)";
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
  const [useCustomMake, setUseCustomMake] = useState(false);
  const [customMake, setCustomMake] = useState("");
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [customModel, setCustomModel] = useState("");

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

  const enableCustomMake = () => {
    setUseCustomMake(true);
    setMakeId("");
    setUseCustomModel(true);
    setModelId("");
  };

  const disableCustomMake = () => {
    setUseCustomMake(false);
    setCustomMake("");
    setUseCustomModel(false);
    setCustomModel("");
  };

  const enableCustomModel = () => {
    setUseCustomModel(true);
    setModelId("");
  };

  const disableCustomModel = () => {
    setUseCustomModel(false);
    setCustomModel("");
  };

  const resetForm = () => {
    setMakeId("");
    setModelId("");
    setVehicleTypeId("");
    setYear("");
    setPlateNo("");
    setUseCustomMake(false);
    setCustomMake("");
    setUseCustomModel(false);
    setCustomModel("");
    setFormErrors({});
  };

  const close = (nextOpen: boolean) => {
    if (saving) return;
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateForm({ makeId, useCustomMake, customMake, modelId, useCustomModel, customModel, vehicleTypeId, plateNo });
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setSaving(true);
    const payload: CreateVehiclePayload = {
      vehicle_type_id: parseInt(vehicleTypeId),
      plate_no: plateNo.trim(),
      ...(year ? { year: parseInt(year) } : {}),
      ...(useCustomMake ? { custom_make: customMake.trim() } : { make_id: parseInt(makeId) }),
      ...(useCustomModel ? { custom_model: customModel.trim() } : { model_id: parseInt(modelId) }),
    };
    try {
      const { vehicle } = await vehiclesService.createVehicle(payload);
      toast.success(
        vehicle.pending_catalog_review
          ? `Vehicle added — we'll review "${vehicle.make} ${vehicle.model}" and add it to our catalog shortly.`
          : "Vehicle added"
      );
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
                {useCustomMake ? (
                  <Input
                    placeholder="e.g. BYD"
                    value={customMake}
                    onChange={(e) => {
                      setCustomMake(e.target.value);
                      if (formErrors.make_id) setFormErrors({ ...formErrors, make_id: undefined });
                    }}
                    maxLength={100}
                    className={formErrors.make_id ? "border-destructive" : ""}
                  />
                ) : (
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
                )}
                <div className="flex items-center justify-between gap-2">
                  {formErrors.make_id && <p className="text-xs text-destructive">{formErrors.make_id}</p>}
                  <button
                    type="button"
                    onClick={useCustomMake ? disableCustomMake : enableCustomMake}
                    className="text-xs text-cta hover:underline ml-auto"
                  >
                    {useCustomMake ? "Use dropdown instead" : "Can't find your make?"}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Model <span className="text-destructive">*</span></Label>
                {useCustomModel ? (
                  <Input
                    placeholder="e.g. Seal"
                    value={customModel}
                    onChange={(e) => {
                      setCustomModel(e.target.value);
                      if (formErrors.model_id) setFormErrors({ ...formErrors, model_id: undefined });
                    }}
                    maxLength={150}
                    className={formErrors.model_id ? "border-destructive" : ""}
                  />
                ) : (
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
                )}
                <div className="flex items-center justify-between gap-2">
                  {formErrors.model_id && <p className="text-xs text-destructive">{formErrors.model_id}</p>}
                  {!useCustomMake && (
                    <button
                      type="button"
                      onClick={useCustomModel ? disableCustomModel : enableCustomModel}
                      className="text-xs text-cta hover:underline ml-auto"
                    >
                      {useCustomModel ? "Use dropdown instead" : "Can't find your model?"}
                    </button>
                  )}
                </div>
              </div>

              {(useCustomMake || useCustomModel) && (
                <p className="col-span-2 text-xs text-muted-foreground -mt-1">
                  Thanks — we'll review what you entered and add it to our catalog shortly. Your vehicle is saved either way.
                </p>
              )}

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
                <PlateNumberInput
                  id="add-plate_no"
                  value={plateNo}
                  onChange={(next) => {
                    setPlateNo(next);
                    if (formErrors.plate_no) setFormErrors({ ...formErrors, plate_no: undefined });
                  }}
                  onBlur={() => {
                    if (plateNo && !isValidSriLankanPlate(plateNo)) {
                      setFormErrors({ ...formErrors, plate_no: "Enter a valid Sri Lankan plate number (e.g. CAB-1234)" });
                    }
                  }}
                  error={!!formErrors.plate_no}
                />
                {formErrors.plate_no ? (
                  <p className="text-xs text-destructive">{formErrors.plate_no}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Format: 2-3 letters followed by 4 digits (e.g. KA-1234 or CAB-1234)</p>
                )}
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
