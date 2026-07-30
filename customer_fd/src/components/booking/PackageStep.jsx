import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, } from "@/components/ui/dialog";
import { ScrollFade } from "@/components/ScrollFade";
import { fmtDuration, imageSrc } from "@/lib/packageFormat";
import { Car, CheckCircle, Eye, Clock, Users } from "lucide-react";
export function PackageStep({ packages, selectedPackageId, onSelect, onContinue }) {
    const [detailsPackage, setDetailsPackage] = useState(null);
    const handleChoose = (packageId) => {
        onSelect(packageId);
        onContinue();
    };
    return (<Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5"/>
          Select Service Package
        </CardTitle>
        <CardDescription>Choose the service package that fits your needs</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Same viewport-capped scroll pattern as the vehicle step, so the
            actions below stay reachable however large the catalog grows. */}
        <ScrollFade className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[min(52vh,28rem)] overflow-y-auto overscroll-contain -m-1 p-1" deps={[packages.length]}>
          {packages.map((p) => {
            const isSelected = selectedPackageId === p.package_id;
            return (<Card key={p.package_id} className={`transition-all overflow-hidden flex flex-col ${isSelected ? "border-cta border-2 bg-cta/5" : "hover:border-cta/50"}`}>
                {/* Fixed 128px thumbnail strip — enough to actually read the photo
                    without the image dominating the card over its details/price. */}
                <div className="relative h-32 w-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {imageSrc(p.image_url) ? (<img src={imageSrc(p.image_url)} alt={p.name} className="h-full w-full object-cover object-center" loading="lazy"/>) : (<Car className="h-8 w-8 text-muted-foreground"/>)}
                  {isSelected && (<div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-cta text-cta-foreground flex items-center justify-center shadow">
                      <CheckCircle className="h-3.5 w-3.5"/>
                    </div>)}
                </div>
                <CardContent className="p-3 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm">{p.name}</h3>
                    {p.package_code && (<span className="text-[10px] font-mono text-muted-foreground">{p.package_code}</span>)}
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
                  {/* Two explicit actions per card: a low-commitment way to inspect
                    the package, and a high-commitment way to pick it and move on. */}
                  <div className="flex items-center gap-2 mt-3">
                    <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setDetailsPackage(p)}>
                      <Eye className="h-3.5 w-3.5 mr-1.5"/>
                      View Details
                    </Button>
                    <Button type="button" size="sm" className="flex-1 bg-cta text-cta-foreground hover:bg-cta/90" onClick={() => handleChoose(p.package_id)}>
                      Select
                    </Button>
                  </div>
                </CardContent>
              </Card>);
        })}
        </ScrollFade>
      </CardContent>

      <Dialog open={detailsPackage !== null} onOpenChange={(open) => !open && setDetailsPackage(null)}>
        <DialogContent className="sm:max-w-md">
          {detailsPackage && (<>
              <div className="relative h-48 w-full bg-muted flex items-center justify-center overflow-hidden rounded-md -mt-2">
                {imageSrc(detailsPackage.image_url) ? (<img src={imageSrc(detailsPackage.image_url)} alt={detailsPackage.name} className="h-full w-full object-cover object-center"/>) : (<Car className="h-12 w-12 text-muted-foreground"/>)}
              </div>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detailsPackage.name}
                  {detailsPackage.package_code && (<span className="text-xs font-mono text-muted-foreground">{detailsPackage.package_code}</span>)}
                </DialogTitle>
                <DialogDescription>{detailsPackage.description || "No description available."}</DialogDescription>
              </DialogHeader>
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
                <span className="text-xl font-bold text-cta">
                  LKR {parseFloat(detailsPackage.price).toLocaleString()}
                  <span className="text-muted-foreground text-xs font-medium ml-1">Upwards</span>
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4"/>
                  {fmtDuration(detailsPackage.estimated_duration)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4"/>
                  Up to {detailsPackage.max_capacity} vehicle{detailsPackage.max_capacity === 1 ? "" : "s"}
                </span>
              </div>
              <DialogFooter>
                <Button className="w-full bg-cta text-cta-foreground hover:bg-cta/90" onClick={() => {
                handleChoose(detailsPackage.package_id);
                setDetailsPackage(null);
            }}>
                  Select This Package
                </Button>
              </DialogFooter>
            </>)}
        </DialogContent>
      </Dialog>
    </Card>);
}
