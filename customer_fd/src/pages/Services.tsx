import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { servicesService, type ServicePackage } from "@/services/services.service";
import { ASSET_BASE_URL } from "@/lib/apiClient";
import { CheckCircle, Clock, Loader2, Car } from "lucide-react";

function fmtDuration(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

function getBullets(description: string | null): string[] {
  if (!description) return [];
  return description.split("\n").map((l) => l.trim()).filter(Boolean);
}

function imageSrc(image_url: string | null) {
  return image_url ? `${ASSET_BASE_URL}${image_url}` : null;
}

export default function Services() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    servicesService
      .getPackages()
      .then(({ packages }) => setPackages(packages))
      .catch(() => setError("Failed to load service packages. Please try again later."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Our Service Packages</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Professional vehicle care tailored to your needs. All prices are base rates and may vary
          based on vehicle condition.
        </p>
      </div>

      {loading && (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-cta" />
        </div>
      )}

      {!loading && error && (
        <Card className="text-center py-12 border-destructive/30">
          <CardContent>
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && packages.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground">No service packages are currently available.</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && packages.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => {
            const bullets = getBullets(pkg.description);
            const src = imageSrc(pkg.image_url);
            return (
              <Card key={pkg.package_id} className="flex flex-col hover:shadow-xl transition-all overflow-hidden pt-0">
                <div className="h-44 w-full bg-muted flex items-center justify-center overflow-hidden">
                  {src ? (
                    <img src={src} alt={pkg.name} className="h-full w-full object-cover" />
                  ) : (
                    <Car className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>
                <CardHeader>
                  <CardTitle className="text-2xl">{pkg.name}</CardTitle>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-bold text-cta">
                      LKR {parseFloat(pkg.price).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground mt-1">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span className="text-sm">{fmtDuration(pkg.estimated_duration)}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  {bullets.length > 0 ? (
                    <ul className="space-y-2 flex-1 mb-6">
                      {bullets.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle className="h-5 w-5 text-cta shrink-0 mt-0.5" />
                          <span className="text-sm">{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex-1 mb-6" />
                  )}
                  <Button
                    className="w-full bg-cta text-cta-foreground hover:bg-cta/90"
                    onClick={() => navigate(`/book?package=${pkg.package_id}`)}
                  >
                    Book This Service
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-12 border-2 border-cta/20 bg-cta/5">
        <CardContent className="py-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-xl font-semibold mb-2">Transparent Pricing</h3>
              <p className="text-muted-foreground">
                All prices shown are base rates. Your final invoice will include any additional work
                discovered during service. We'll always notify you before proceeding with extra work.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
