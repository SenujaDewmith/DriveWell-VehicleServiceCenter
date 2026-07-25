import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollFade } from "@/components/ScrollFade";
import { fmtDuration, imageSrc } from "@/lib/packageFormat";
import { type ServicePackage } from "@/services/services.service";
import { Car, CheckCircle } from "lucide-react";

interface PackageStepProps {
  packages: ServicePackage[];
  selectedPackageId: number | null;
  onSelect: (packageId: number) => void;
  onContinue: () => void;
}

export function PackageStep({ packages, selectedPackageId, onSelect, onContinue }: PackageStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Select Service Package
        </CardTitle>
        <CardDescription>Choose the service package that fits your needs</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Same viewport-capped scroll pattern as the vehicle step, so the
            actions below stay reachable however large the catalog grows. */}
        <ScrollFade
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[min(52vh,28rem)] overflow-y-auto overscroll-contain -m-1 p-1"
          deps={[packages.length]}
        >
          {packages.map((p) => {
            const isSelected = selectedPackageId === p.package_id;
            return (
              <Card
                key={p.package_id}
                className={`cursor-pointer transition-all overflow-hidden flex flex-col ${isSelected ? "border-cta border-2 bg-cta/5" : "hover:border-cta/50"}`}
                onClick={() => onSelect(p.package_id)}
              >
                {/* Fixed 128px thumbnail strip — enough to actually read the photo
                    without the image dominating the card over its details/price. */}
                <div className="relative h-32 w-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {imageSrc(p.image_url) ? (
                    <img
                      src={imageSrc(p.image_url)!}
                      alt={p.name}
                      className="h-full w-full object-cover object-center"
                      loading="lazy"
                    />
                  ) : (
                    <Car className="h-8 w-8 text-muted-foreground" />
                  )}
                  {isSelected && (
                    <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-cta text-cta-foreground flex items-center justify-center shadow">
                      <CheckCircle className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
                <CardContent className="p-3 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm">{p.name}</h3>
                    {p.package_code && (
                      <span className="text-[10px] font-mono text-muted-foreground">{p.package_code}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{p.description}</p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t">
                    <div>
                      <span className="text-base font-bold text-cta">
                        LKR {parseFloat(p.price).toLocaleString()}
                      </span>
                      <span className="text-muted-foreground text-[10px] font-medium ml-1">Upwards</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{fmtDuration(p.estimated_duration)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </ScrollFade>
        {/* Sticky action bar — keeps Continue visible even when the card
            overflows short viewports (e.g. mobile). */}
        <div className="sticky bottom-0 -mx-6 -mb-6 rounded-b-lg border-t bg-card px-6 py-4">
          <Button
            className="w-full bg-cta text-cta-foreground hover:bg-cta/90"
            onClick={onContinue}
            disabled={!selectedPackageId}
          >
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
