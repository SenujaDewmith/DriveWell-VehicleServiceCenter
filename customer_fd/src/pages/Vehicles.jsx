import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/components/ui/alert-dialog";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { vehiclesService, } from "@/services/vehicles.service";
import { YEAR_OPTIONS } from "@/lib/vehicleYears";
import { isValidSriLankanPlate } from "@/lib/plateNumber";
import { PlateNumberInput } from "@/components/ui/plate-number-input";
import { Car, Edit, Trash2, Plus, Loader2, Wrench, ChevronRight, RotateCcw, FileUp } from "lucide-react";
import { toast } from "sonner";
function TransferRequestStatusBadge({ status }) {
    if (status === "Approved") {
        return <Badge variant="outline" className="text-green-600 border-green-600">Approved</Badge>;
    }
    if (status === "Rejected") {
        return <Badge variant="destructive">Rejected</Badge>;
    }
    return <Badge variant="outline" className="text-amber-600 border-amber-600">Pending Review</Badge>;
}
function validateForm(data) {
    const errors = {};
    if (data.useCustomMake) {
        if (!data.customMake.trim())
            errors.make_id = "Enter the make";
    }
    else if (!data.makeId) {
        errors.make_id = "Make is required";
    }
    if (data.useCustomModel) {
        if (!data.customModel.trim())
            errors.model_id = "Enter the model";
    }
    else if (!data.modelId) {
        errors.model_id = "Model is required";
    }
    if (!data.vehicleTypeId)
        errors.vehicle_type_id = "Vehicle type is required";
    if (!data.plateNo.trim()) {
        errors.plate_no = "Plate number is required";
    }
    else if (!isValidSriLankanPlate(data.plateNo)) {
        errors.plate_no = "Enter a valid Sri Lankan plate number (e.g. CAB-1234)";
    }
    return errors;
}
export default function Vehicles() {
    const { user, updateProfile: updateAuthProfile } = useAuth();
    const navigate = useNavigate();
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [detachedVehicles, setDetachedVehicles] = useState([]);
    const [myTransferRequests, setMyTransferRequests] = useState([]);
    const loadDetached = () => vehiclesService.getDetachedVehicles().then((r) => setDetachedVehicles(r.vehicles));
    const loadTransferRequests = () => vehiclesService.getMyTransferRequests().then((r) => setMyTransferRequests(r.requests));
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [vehicleToDelete, setVehicleToDelete] = useState(null);
    const [restoringId, setRestoringId] = useState(null);
    const [claimPrompt, setClaimPrompt] = useState(null);
    const [claiming, setClaiming] = useState(false);
    const [lookingUpPlate, setLookingUpPlate] = useState(false);
    const [plateBlockedElsewhere, setPlateBlockedElsewhere] = useState(false);
    const [transferRequestDialogOpen, setTransferRequestDialogOpen] = useState(false);
    const [transferRequestPlate, setTransferRequestPlate] = useState("");
    const [logbookFile, setLogbookFile] = useState(null);
    const [nicFile, setNicFile] = useState(null);
    const [submittingTransferRequest, setSubmittingTransferRequest] = useState(false);
    const [transferRequestError, setTransferRequestError] = useState("");
    const [contactPhoneChoice, setContactPhoneChoice] = useState("new");
    const [newContactPhone, setNewContactPhone] = useState("");
    const [makes, setMakes] = useState([]);
    const [models, setModels] = useState([]);
    const [types, setTypes] = useState([]);
    const [loadingLookups, setLoadingLookups] = useState(false);
    const [loadingModels, setLoadingModels] = useState(false);
    const [pendingModelId, setPendingModelId] = useState(null);
    const [makeId, setMakeId] = useState("");
    const [modelId, setModelId] = useState("");
    const [vehicleTypeId, setVehicleTypeId] = useState("");
    const [year, setYear] = useState("");
    const [plateNo, setPlateNo] = useState("");
    const [useCustomMake, setUseCustomMake] = useState(false);
    const [customMake, setCustomMake] = useState("");
    const [useCustomModel, setUseCustomModel] = useState(false);
    const [customModel, setCustomModel] = useState("");
    const [formErrors, setFormErrors] = useState({});
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        if (!user)
            navigate("/login");
    }, [user, navigate]);
    useEffect(() => {
        if (!user)
            return;
        let cancelled = false;
        setLoading(true);
        vehiclesService
            .getVehicles()
            .then((r) => {
            if (!cancelled)
                setVehicles(r.vehicles);
        })
            .catch(() => {
            if (!cancelled)
                toast.error("Failed to load vehicles");
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [user]);
    useEffect(() => {
        if (!user)
            return;
        loadDetached().catch(() => {});
        loadTransferRequests().catch(() => {});
    }, [user]);
    useEffect(() => {
        if (!dialogOpen)
            return;
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
            }
            else {
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
        setUseCustomMake(false);
        setCustomMake("");
        setUseCustomModel(false);
        setCustomModel("");
        setFormErrors({});
        setPendingModelId(null);
        setPlateBlockedElsewhere(false);
    };
    const openAdd = () => {
        setEditingVehicle(null);
        resetForm();
        setDialogOpen(true);
    };
    const openEdit = (vehicle) => {
        setEditingVehicle(vehicle);
        setFormErrors({});
        setVehicleTypeId(vehicle.vehicle_type_id.toString());
        setYear(vehicle.year ? String(vehicle.year) : "");
        setPlateNo(vehicle.plate_no);
        if (vehicle.pending_catalog_review) {
            setPendingModelId(null);
            setUseCustomModel(true);
            setCustomModel(vehicle.custom_model ?? "");
            if (vehicle.make_id) {
                setUseCustomMake(false);
                setCustomMake("");
                setMakeId(vehicle.make_id.toString());
            }
            else {
                setUseCustomMake(true);
                setCustomMake(vehicle.custom_make ?? "");
                setMakeId("");
            }
        }
        else {
            setUseCustomMake(false);
            setCustomMake("");
            setUseCustomModel(false);
            setCustomModel("");
            setPendingModelId(vehicle.model_id.toString());
            setMakeId(vehicle.make_id.toString());
        }
        setDialogOpen(true);
    };
    const closeDialog = (open) => {
        if (saving || lookingUpPlate)
            return;
        if (!open)
            resetForm();
        setDialogOpen(open);
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
    const handleModelChange = (value) => {
        setModelId(value);
        if (formErrors.model_id)
            setFormErrors({ ...formErrors, model_id: undefined });
        const model = models.find((m) => m.model_id.toString() === value);
        if (model?.vehicle_type_id) {
            setVehicleTypeId(model.vehicle_type_id.toString());
            if (formErrors.vehicle_type_id)
                setFormErrors({ ...formErrors, vehicle_type_id: undefined });
        }
    };
    const confirmDelete = async () => {
        if (!vehicleToDelete)
            return;
        const vehicle = vehicleToDelete;
        setDeletingId(vehicle.vehicle_id);
        try {
            const { permanent } = await vehiclesService.deleteVehicle(vehicle.vehicle_id);
            setVehicles((prev) => prev.filter((v) => v.vehicle_id !== vehicle.vehicle_id));
            loadDetached().catch(() => {});
            toast.success(permanent ? "Vehicle permanently deleted" : "Ownership removed");
            setVehicleToDelete(null);
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to delete vehicle");
        }
        finally {
            setDeletingId(null);
        }
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        const errors = validateForm({ makeId, useCustomMake, customMake, modelId, useCustomModel, customModel, vehicleTypeId, plateNo });
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        const payload = {
            vehicle_type_id: parseInt(vehicleTypeId),
            plate_no: plateNo.trim(),
            ...(year ? { year: parseInt(year) } : {}),
            ...(useCustomMake ? { custom_make: customMake.trim() } : { make_id: parseInt(makeId) }),
            ...(useCustomModel ? { custom_model: customModel.trim() } : { model_id: parseInt(modelId) }),
        };
        if (!editingVehicle) {
            setLookingUpPlate(true);
            try {
                const lookup = await vehiclesService.lookupPlate(plateNo.trim());
                if (lookup.found && lookup.status === "claimable") {
                    setClaimPrompt(lookup.vehicle);
                    return;
                }
                if (lookup.found && lookup.status === "active_elsewhere") {
                    setPlateBlockedElsewhere(true);
                    setFormErrors({ ...errors, plate_no: "This plate is already registered to another active account." });
                    return;
                }
                setPlateBlockedElsewhere(false);
            }
            catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed to look up plate number");
                return;
            }
            finally {
                setLookingUpPlate(false);
            }
        }
        setSaving(true);
        try {
            if (editingVehicle) {
                const { vehicle } = await vehiclesService.updateVehicle(editingVehicle.vehicle_id, payload);
                setVehicles((prev) => prev.map((v) => (v.vehicle_id === editingVehicle.vehicle_id ? vehicle : v)));
                toast.success(vehicle.pending_catalog_review
                    ? `Vehicle updated — we'll review "${vehicle.make} ${vehicle.model}" and add it to our catalog shortly.`
                    : "Vehicle updated");
            }
            else {
                const { vehicle } = await vehiclesService.createVehicle(payload);
                setVehicles((prev) => [vehicle, ...prev]);
                toast.success(vehicle.pending_catalog_review
                    ? `Vehicle added — we'll review "${vehicle.make} ${vehicle.model}" and add it to our catalog shortly.`
                    : "Vehicle added");
            }
            setDialogOpen(false);
            resetForm();
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to save vehicle");
        }
        finally {
            setSaving(false);
        }
    };
    const confirmClaim = async () => {
        if (!claimPrompt)
            return;
        setClaiming(true);
        try {
            const { vehicle } = await vehiclesService.claimVehicle(claimPrompt.plate_no);
            setVehicles((prev) => [vehicle, ...prev]);
            toast.success("Vehicle claimed successfully");
            setClaimPrompt(null);
            setDialogOpen(false);
            resetForm();
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to claim vehicle");
        }
        finally {
            setClaiming(false);
        }
    };
    const resolvedContactPhone = contactPhoneChoice === "primary"
        ? user?.phone ?? ""
        : contactPhoneChoice === "secondary"
            ? user?.secondaryPhone ?? ""
            : newContactPhone.trim();
    const submitTransferRequest = async () => {
        if (!logbookFile || !nicFile) {
            setTransferRequestError("Both a logbook photo and an NIC photo are required");
            return;
        }
        if (!resolvedContactPhone) {
            setTransferRequestError("A contact phone number is required");
            return;
        }
        setSubmittingTransferRequest(true);
        setTransferRequestError("");
        try {
            const { profile_updated } = await vehiclesService.submitTransferRequest(transferRequestPlate, logbookFile, nicFile, resolvedContactPhone);
            toast.success(profile_updated
                ? "Transfer request submitted — this number was also saved to your profile as a secondary contact number"
                : "Transfer request submitted — you'll be notified once it's reviewed");
            if (profile_updated)
                updateAuthProfile({ secondaryPhone: resolvedContactPhone });
            setTransferRequestDialogOpen(false);
            setDialogOpen(false);
            resetForm();
            loadTransferRequests().catch(() => {});
        }
        catch (err) {
            setTransferRequestError(err instanceof Error ? err.message : "Failed to submit transfer request");
        }
        finally {
            setSubmittingTransferRequest(false);
        }
    };
    const restoreDetached = async (vehicle) => {
        setRestoringId(vehicle.vehicle_id);
        try {
            const { vehicle: restored } = await vehiclesService.restoreVehicle(vehicle.vehicle_id);
            setVehicles((prev) => [restored, ...prev]);
            setDetachedVehicles((prev) => prev.filter((v) => v.vehicle_id !== vehicle.vehicle_id));
            toast.success("Vehicle restored");
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to restore vehicle");
            loadDetached().catch(() => {});
        }
        finally {
            setRestoringId(null);
        }
    };
    if (!user)
        return null;
    return (<div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">My Vehicles</h1>
          <p className="text-muted-foreground">Manage your registered vehicles</p>
        </div>
        <Button className="bg-cta text-cta-foreground hover:bg-cta/90" onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4"/>
          Add Vehicle
        </Button>
      </div>

      {loading ? (<div className="flex justify-center items-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-cta"/>
        </div>) : vehicles.length === 0 ? (<Card className="text-center py-12">
          <CardContent>
            <Car className="h-16 w-16 text-muted-foreground mx-auto mb-4"/>
            <h3 className="text-xl font-semibold mb-2">No vehicles yet</h3>
            <p className="text-muted-foreground mb-4">Add your first vehicle to start booking services</p>
            <Button className="bg-cta text-cta-foreground hover:bg-cta/90" onClick={openAdd}>
              <Plus className="mr-2 h-4 w-4"/>
              Add Vehicle
            </Button>
          </CardContent>
        </Card>) : (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vehicles.map((vehicle) => (<Card key={vehicle.vehicle_id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/vehicles/${vehicle.vehicle_id}/history`)}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="h-12 w-12 bg-cta/10 rounded-lg flex items-center justify-center">
                    <Car className="h-6 w-6 text-cta"/>
                  </div>
                  <div className="flex gap-2">
                    <Button size="icon" variant="ghost" onClick={(e) => {
                    e.stopPropagation();
                    openEdit(vehicle);
                }}>
                      <Edit className="h-4 w-4"/>
                    </Button>
                    <Button size="icon" variant="ghost" disabled={deletingId === vehicle.vehicle_id} onClick={(e) => {
                    e.stopPropagation();
                    setVehicleToDelete(vehicle);
                }}>
                      {deletingId === vehicle.vehicle_id ? (<Loader2 className="h-4 w-4 animate-spin"/>) : (<Trash2 className="h-4 w-4 text-destructive"/>)}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-bold">{vehicle.make} {vehicle.model}</h3>
                  {vehicle.pending_catalog_review && (<Badge variant="outline" className="text-amber-600 border-amber-600">Pending Review</Badge>)}
                </div>
                <div className="space-y-1 text-sm mt-3">
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">Plate Number</span>
                    <span className="font-medium">{vehicle.plate_no}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium">{vehicle.vehicle_type}</span>
                  </p>
                  {vehicle.year && (<p className="flex justify-between">
                      <span className="text-muted-foreground">Year</span>
                      <span className="font-medium">{vehicle.year}</span>
                    </p>)}
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t text-sm text-cta font-medium">
                  <span className="flex items-center gap-1.5">
                    <Wrench className="h-4 w-4"/>
                    Service History
                  </span>
                  <ChevronRight className="h-4 w-4"/>
                </div>
              </CardContent>
            </Card>))}
        </div>)}

      {detachedVehicles.length > 0 && (<div className="mt-10">
          <h2 className="text-lg font-semibold mb-3">Recently Removed</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {detachedVehicles.map((vehicle) => (<Card key={vehicle.vehicle_id} className="bg-muted/40">
                <CardContent className="pt-6">
                  <h3 className="font-semibold">{vehicle.make} {vehicle.model}</h3>
                  <p className="text-sm text-muted-foreground">{vehicle.plate_no}</p>
                  {vehicle.detached_at && (<p className="text-xs text-muted-foreground mt-1">
                      Removed on {new Date(vehicle.detached_at).toLocaleDateString()}
                    </p>)}
                  <Button size="sm" variant="outline" className="mt-3 w-full" disabled={restoringId === vehicle.vehicle_id} onClick={() => restoreDetached(vehicle)}>
                    {restoringId === vehicle.vehicle_id ? (<Loader2 className="mr-2 h-4 w-4 animate-spin"/>) : (<RotateCcw className="mr-2 h-4 w-4"/>)}
                    Restore
                  </Button>
                </CardContent>
              </Card>))}
          </div>
        </div>)}

      {myTransferRequests.length > 0 && (<div className="mt-10">
          <h2 className="text-lg font-semibold mb-3">My Transfer Requests</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myTransferRequests.map((request) => (<Card key={request.request_id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{request.make} {request.model}</h3>
                      <p className="text-sm text-muted-foreground">{request.plate_no}</p>
                    </div>
                    <TransferRequestStatusBadge status={request.status}/>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Submitted {new Date(request.created_at).toLocaleDateString()}
                  </p>
                  {request.status === "Rejected" && request.rejection_reason && (<p className="text-xs text-destructive mt-1">Reason: {request.rejection_reason}</p>)}
                </CardContent>
              </Card>))}
          </div>
        </div>)}

      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingVehicle ? "Edit Vehicle" : "Add New Vehicle"}</DialogTitle>
          </DialogHeader>
          {loadingLookups ? (<div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-cta"/>
            </div>) : (<form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Make <span className="text-destructive">*</span></Label>
                  {useCustomMake ? (<Input placeholder="e.g. BYD" value={customMake} onChange={(e) => {
                    setCustomMake(e.target.value);
                    if (formErrors.make_id)
                        setFormErrors({ ...formErrors, make_id: undefined });
                }} maxLength={100} className={formErrors.make_id ? "border-destructive" : ""}/>) : (<Combobox options={makes.map((m) => ({ value: m.make_id.toString(), label: m.name }))} value={makeId} onValueChange={(v) => {
                    setMakeId(v);
                    if (formErrors.make_id)
                        setFormErrors({ ...formErrors, make_id: undefined });
                }} placeholder="Select make" searchPlaceholder="Search makes..." emptyText="No make found." className={formErrors.make_id ? "border-destructive" : ""}/>)}
                  <div className="flex items-center justify-between gap-2">
                    {formErrors.make_id && <p className="text-xs text-destructive">{formErrors.make_id}</p>}
                    <button type="button" onClick={useCustomMake ? disableCustomMake : enableCustomMake} className="text-xs text-cta hover:underline ml-auto">
                      {useCustomMake ? "Use dropdown instead" : "Can't find your make?"}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Model <span className="text-destructive">*</span></Label>
                  {useCustomModel ? (<Input placeholder="e.g. Seal" value={customModel} onChange={(e) => {
                    setCustomModel(e.target.value);
                    if (formErrors.model_id)
                        setFormErrors({ ...formErrors, model_id: undefined });
                }} maxLength={150} className={formErrors.model_id ? "border-destructive" : ""}/>) : (<Combobox options={models.map((m) => ({ value: m.model_id.toString(), label: m.name }))} value={modelId} onValueChange={handleModelChange} placeholder={!makeId ? "Select make first" : loadingModels ? "Loading..." : "Select model"} searchPlaceholder="Search models..." emptyText="No model found." disabled={!makeId || loadingModels} className={formErrors.model_id ? "border-destructive" : ""}/>)}
                  <div className="flex items-center justify-between gap-2">
                    {formErrors.model_id && <p className="text-xs text-destructive">{formErrors.model_id}</p>}
                    {!useCustomMake && (<button type="button" onClick={useCustomModel ? disableCustomModel : enableCustomModel} className="text-xs text-cta hover:underline ml-auto">
                        {useCustomModel ? "Use dropdown instead" : "Can't find your model?"}
                      </button>)}
                  </div>
                </div>

                {(useCustomMake || useCustomModel) && (<p className="col-span-2 text-xs text-muted-foreground -mt-1">
                    Thanks — we'll review what you entered and add it to our catalog shortly. Your vehicle is saved either way.
                  </p>)}

                <div className="space-y-2">
                  <Label>Vehicle Type <span className="text-destructive">*</span></Label>
                  <Combobox options={types.map((t) => ({ value: t.type_id.toString(), label: t.name }))} value={vehicleTypeId} onValueChange={(v) => {
                setVehicleTypeId(v);
                if (formErrors.vehicle_type_id)
                    setFormErrors({ ...formErrors, vehicle_type_id: undefined });
            }} placeholder="Select type" searchPlaceholder="Search types..." emptyText="No type found." className={formErrors.vehicle_type_id ? "border-destructive" : ""}/>
                  {formErrors.vehicle_type_id && <p className="text-xs text-destructive">{formErrors.vehicle_type_id}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Year of Manufacture (YOM)</Label>
                  <Combobox options={YEAR_OPTIONS} value={year} onValueChange={setYear} placeholder="Select year" searchPlaceholder="Search year..." emptyText="No year found."/>
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="plate_no">Plate Number <span className="text-destructive">*</span></Label>
                  <PlateNumberInput id="plate_no" value={plateNo} onChange={(next) => {
                setPlateNo(next);
                if (formErrors.plate_no)
                    setFormErrors({ ...formErrors, plate_no: undefined });
                if (plateBlockedElsewhere)
                    setPlateBlockedElsewhere(false);
            }} onBlur={() => {
                if (plateNo && !isValidSriLankanPlate(plateNo)) {
                    setFormErrors({ ...formErrors, plate_no: "Enter a valid Sri Lankan plate number (e.g. CAB-1234)" });
                }
            }} error={!!formErrors.plate_no}/>
                  {formErrors.plate_no ? (<p className="text-xs text-destructive">{formErrors.plate_no}</p>) : (<p className="text-xs text-muted-foreground">Format: 2-3 letters/digits, then 4 digits (e.g. KA-1234, CAB-1234)</p>)}
                  {plateBlockedElsewhere && (<Button type="button" variant="outline" size="sm" className="mt-1" onClick={() => {
                    setTransferRequestPlate(plateNo.trim());
                    setLogbookFile(null);
                    setNicFile(null);
                    setTransferRequestError("");
                    setNewContactPhone("");
                    setContactPhoneChoice(user?.phone ? "primary" : user?.secondaryPhone ? "secondary" : "new");
                    setTransferRequestDialogOpen(true);
                }}>
                      <FileUp className="mr-2 h-4 w-4"/>
                      Request Ownership Transfer
                    </Button>)}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" disabled={saving || lookingUpPlate} onClick={() => closeDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-cta text-cta-foreground hover:bg-cta/90" disabled={saving || lookingUpPlate}>
                  {saving || lookingUpPlate ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>{lookingUpPlate ? "Checking plate..." : editingVehicle ? "Updating..." : "Adding..."}</>) : (editingVehicle ? "Update Vehicle" : "Add Vehicle")}
                </Button>
              </div>
            </form>)}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!vehicleToDelete} onOpenChange={(open) => {
            if (deletingId)
                return;
            if (!open)
                setVehicleToDelete(null);
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {vehicleToDelete?.has_booking_history
            ? `Remove ${vehicleToDelete?.make} ${vehicleToDelete?.model}?`
            : `Permanently delete ${vehicleToDelete?.make} ${vehicleToDelete?.model}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {vehicleToDelete?.has_booking_history
            ? `This will remove your ownership of ${vehicleToDelete?.plate_no}. It won't be deleted — you can restore it from Recently Removed any time before someone else claims it.`
            : `${vehicleToDelete?.plate_no} has no service history, so this will permanently delete it. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setVehicleToDelete(null)} disabled={!!deletingId}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={!!deletingId}>
              {deletingId && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              {deletingId
            ? "Removing..."
            : vehicleToDelete?.has_booking_history
                ? "Remove Ownership"
                : "Delete Permanently"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!claimPrompt} onOpenChange={(open) => {
            if (claiming)
                return;
            if (!open)
                setClaimPrompt(null);
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Claim this vehicle?</AlertDialogTitle>
            <AlertDialogDescription>
              {claimPrompt?.plate_no} ({claimPrompt?.make} {claimPrompt?.model}
              {claimPrompt?.year ? `, ${claimPrompt.year}` : ""}) is already registered in DriveWell but
              currently has no owner. Claiming it will link it to your account along with its full service
              history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setClaimPrompt(null)} disabled={claiming}>
              Cancel
            </Button>
            <Button className="bg-cta text-cta-foreground hover:bg-cta/90" onClick={confirmClaim} disabled={claiming}>
              {claiming && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              {claiming ? "Claiming..." : "Claim Vehicle"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={transferRequestDialogOpen} onOpenChange={(open) => {
            if (submittingTransferRequest)
                return;
            setTransferRequestDialogOpen(open);
        }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Ownership Transfer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {transferRequestPlate} is currently registered to another DriveWell account. Upload your vehicle
              logbook and NIC as verification — a manager will review them before any transfer happens, and the
              current owner will be notified that a request was filed.
            </p>
            {transferRequestError && (<p className="text-sm text-destructive">{transferRequestError}</p>)}

            <div className="space-y-2">
              <Label>Contact Phone Number <span className="text-destructive">*</span></Label>
              <p className="text-xs text-muted-foreground">
                DriveWell staff will use this number to reach you about this request.
              </p>
              <div className="space-y-2">
                {user?.phone && (<label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="contact_phone_choice" checked={contactPhoneChoice === "primary"} onChange={() => setContactPhoneChoice("primary")}/>
                    Primary: {user.phone}
                  </label>)}
                {user?.secondaryPhone && (<label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="contact_phone_choice" checked={contactPhoneChoice === "secondary"} onChange={() => setContactPhoneChoice("secondary")}/>
                    Secondary: {user.secondaryPhone}
                  </label>)}
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="contact_phone_choice" checked={contactPhoneChoice === "new"} onChange={() => setContactPhoneChoice("new")}/>
                  Use a different number
                </label>
                {contactPhoneChoice === "new" && (<Input type="tel" placeholder="e.g. 077-1234567" value={newContactPhone} onChange={(e) => setNewContactPhone(e.target.value)} className="mt-1"/>)}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="logbook_photo">Vehicle Logbook Photo <span className="text-destructive">*</span></Label>
              <Input id="logbook_photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setLogbookFile(e.target.files?.[0] ?? null)}/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nic_photo">Your NIC Photo <span className="text-destructive">*</span></Label>
              <Input id="nic_photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setNicFile(e.target.files?.[0] ?? null)}/>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" disabled={submittingTransferRequest} onClick={() => setTransferRequestDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-cta text-cta-foreground hover:bg-cta/90" disabled={submittingTransferRequest} onClick={submitTransferRequest}>
              {submittingTransferRequest && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              {submittingTransferRequest ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>);
}
