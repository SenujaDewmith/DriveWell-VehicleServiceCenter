import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollFade } from "@/components/ScrollFade";
import { type Vehicle } from "@/services/vehicles.service";
import { Car, CheckCircle, Loader2, Plus } from "lucide-react";

interface VehicleStepProps {
  vehicles: Vehicle[];
  dataLoading: boolean;
  selectedVehicleId: number | null;
  onSelect: (vehicleId: number) => void;
  onAddVehicle: () => void;
  onBack: () => void;
  onContinue: () => void;
}

export function VehicleStep({
  vehicles,
  dataLoading,
  selectedVehicleId,
  onSelect,
  onAddVehicle,
  onBack,
  onContinue,
}: VehicleStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Car className="h-5 w-5" />
          Select Your Vehicle
        </CardTitle>
        <CardDescription>Choose which vehicle you'd like to service</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {dataLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-cta" />
          </div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">You haven't added any vehicles yet</p>
            <Button onClick={onAddVehicle} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add a Vehicle
            </Button>
          </div>
        ) : (
          // Capped to viewport height so long vehicle lists scroll internally
          // and the Continue button below stays reachable without page scrolling.
          <ScrollFade
            className="grid gap-4 sm:grid-cols-2 max-h-[min(50vh,26rem)] overflow-y-auto overscroll-contain -m-1 p-1"
            deps={[vehicles.length]}
          >
            {vehicles.map((v) => (
              <Card
                key={v.vehicle_id}
                className={`cursor-pointer transition-all ${selectedVehicleId === v.vehicle_id ? "border-cta border-2 bg-cta/5" : "hover:border-cta/50"}`}
                onClick={() => onSelect(v.vehicle_id)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="h-12 w-12 bg-cta/10 rounded-lg flex items-center justify-center">
                    <Car className="h-6 w-6 text-cta" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{v.make} {v.model}</p>
                    <p className="text-sm text-muted-foreground">
                      {v.plate_no}{v.year ? ` • ${v.year}` : ""} • {v.vehicle_type}
                    </p>
                  </div>
                  {selectedVehicleId === v.vehicle_id && (
                    <CheckCircle className="h-6 w-6 text-cta" />
                  )}
                </CardContent>
              </Card>
            ))}
            <Card
              className="cursor-pointer border-dashed hover:border-cta/50 transition-all"
              onClick={onAddVehicle}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-12 w-12 bg-muted rounded-lg flex items-center justify-center">
                  <Plus className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-semibold text-muted-foreground">Add New Vehicle</p>
              </CardContent>
            </Card>
          </ScrollFade>
        )}
        {/* Sticky action bar — keeps Back/Continue visible even when the card
            overflows short viewports (e.g. mobile). */}
        <div className="sticky bottom-0 -mx-6 -mb-6 rounded-b-lg border-t bg-card px-6 py-4 flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1">Back</Button>
          <Button
            className="flex-1 bg-cta text-cta-foreground hover:bg-cta/90"
            onClick={onContinue}
            disabled={!selectedVehicleId}
          >
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
