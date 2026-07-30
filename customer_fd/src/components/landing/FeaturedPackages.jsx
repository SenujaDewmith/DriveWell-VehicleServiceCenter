import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, } from "@/components/ui/carousel";
import { servicesService } from "@/services/services.service";
import { fmtDuration, getBullets, imageSrc } from "@/lib/packageFormat";
import { Car, CheckCircle, Loader2 } from "lucide-react";
const MAX_FEATURED_PACKAGES = 5;
export function FeaturedPackages() {
    const navigate = useNavigate();
    const [packages, setPackages] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        let cancelled = false;
        servicesService
            .getPackages()
            .then((r) => {
            if (!cancelled)
                setPackages(r.packages);
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    const featuredPackages = packages.filter((p) => p.is_featured).slice(0, MAX_FEATURED_PACKAGES);
    // Carousel dot indicators + a gentle auto-advance — the lg layout shows 3 slides at
    // once, so with up to 5 featured packages there's still more to scroll through there.
    const [packagesApi, setPackagesApi] = useState();
    const [packagesSlide, setPackagesSlide] = useState(0);
    useEffect(() => {
        if (!packagesApi)
            return;
        setPackagesSlide(packagesApi.selectedScrollSnap());
        packagesApi.on("select", () => setPackagesSlide(packagesApi.selectedScrollSnap()));
        const interval = setInterval(() => packagesApi.scrollNext(), 5000);
        return () => clearInterval(interval);
    }, [packagesApi]);
    if (!packages.isPending && featuredPackages.length === 0)
        return null;
    return (<section className="py-20">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl font-bold text-center mb-4">Popular Service Packages</h2>
        <p className="text-center text-muted-foreground mb-12 text-lg">
          Professional care for every need and budget
        </p>
        {packages.isPending ? (<div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-cta"/>
          </div>) : (<div className="max-w-6xl mx-auto">
            <Carousel opts={{ align: "start", loop: true }} setApi={setPackagesApi} className="px-1">
              <CarouselContent className="py-3">
                {featuredPackages.map((pkg) => (<CarouselItem key={pkg.package_id} className="sm:basis-1/2 lg:basis-1/3">
                    <Card className="relative border-cta border-2 shadow-lg transition-all hover:shadow-xl hover:-translate-y-1 h-full">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                        <span className="bg-cta text-cta-foreground text-xs font-semibold px-3 py-1 rounded-full">
                          Most Popular
                        </span>
                      </div>
                      <div className="aspect-[2/1] w-full rounded-t-lg bg-muted flex items-center justify-center overflow-hidden relative">
                        {pkg.package_code && (<span className="absolute top-2 left-2 rounded-md bg-background/90 px-2 py-0.5 text-xs font-mono font-medium text-foreground shadow-sm">
                            {pkg.package_code}
                          </span>)}
                        {imageSrc(pkg.image_url) ? (<img src={imageSrc(pkg.image_url)} alt={pkg.name} className="h-full w-full object-cover"/>) : (<Car className="h-10 w-10 text-muted-foreground"/>)}
                      </div>
                      <CardHeader className="p-5">
                        <CardTitle className="text-xl">{pkg.name}</CardTitle>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-cta">
                            LKR {parseFloat(pkg.price).toLocaleString()}
                          </span>
                          <span className="text-sm text-muted-foreground">/ {fmtDuration(pkg.estimated_duration)}</span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-5 pt-0">
                        <ul className="space-y-1.5">
                          {getBullets(pkg.description).map((feature) => (<li key={feature} className="flex items-start gap-2">
                              <CheckCircle className="h-5 w-5 text-cta shrink-0 mt-0.5"/>
                              <span className="text-sm">{feature}</span>
                            </li>))}
                        </ul>
                        <Button className="w-full mt-4 bg-cta text-cta-foreground hover:bg-cta/90" onClick={() => navigate(`/book?package=${pkg.package_id}`)}>
                          Book Now
                        </Button>
                      </CardContent>
                    </Card>
                  </CarouselItem>))}
              </CarouselContent>
              <CarouselPrevious className="hidden lg:flex -left-10"/>
              <CarouselNext className="hidden lg:flex -right-10"/>
            </Carousel>

            {featuredPackages.length > 1 && (<div className="flex justify-center gap-2 mt-2">
                {featuredPackages.map((pkg, idx) => (<button key={pkg.package_id} type="button" aria-label={`Show slide ${idx + 1}`} onClick={() => packagesApi?.scrollTo(idx)} className={`h-2 rounded-full transition-all ${packagesSlide === idx ? "w-6 bg-cta" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"}`}/>))}
              </div>)}
          </div>)}
      </div>
    </section>);
}
