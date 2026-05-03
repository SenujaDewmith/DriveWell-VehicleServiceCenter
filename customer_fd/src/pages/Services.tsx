import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mockPackages } from "@/data/mockData";
import { CheckCircle, Clock, DollarSign, Sparkles } from "lucide-react";

export default function Services() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "basic" | "premium">("all");

  const filteredPackages = mockPackages.filter((pkg) => {
    if (filter === "premium") return pkg.premium;
    if (filter === "basic") return !pkg.premium;
    return true;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Our Service Packages</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Professional vehicle care tailored to your needs. All prices are indicative and may vary based on vehicle
          condition.
        </p>
      </div>

      <div className="flex justify-center gap-3 mb-8">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
          className={filter === "all" ? "bg-cta text-cta-foreground hover:bg-cta/90" : ""}
        >
          All Services
        </Button>
        <Button
          variant={filter === "basic" ? "default" : "outline"}
          onClick={() => setFilter("basic")}
          className={filter === "basic" ? "bg-cta text-cta-foreground hover:bg-cta/90" : ""}
        >
          Basic Services
        </Button>
        <Button
          variant={filter === "premium" ? "default" : "outline"}
          onClick={() => setFilter("premium")}
          className={filter === "premium" ? "bg-cta text-cta-foreground hover:bg-cta/90" : ""}
        >
          Premium Services
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPackages.map((pkg) => (
          <Card
            key={pkg.id}
            className={`relative flex flex-col hover:shadow-xl transition-all ${
              pkg.popular ? "border-cta border-2" : pkg.premium ? "border-accent border-2" : ""
            }`}
          >
            {pkg.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-cta text-cta-foreground hover:bg-cta">Most Popular</Badge>
              </div>
            )}
            {pkg.premium && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-accent text-accent-foreground hover:bg-accent">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Premium
                </Badge>
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-2xl">{pkg.name}</CardTitle>
              <CardDescription className="text-base">{pkg.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-bold text-cta">${pkg.price}</span>
              </div>
              <div className="flex items-center gap-2 mb-4 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-sm">{pkg.duration}</span>
              </div>
              <div className="space-y-2 flex-1 mb-6">
                {pkg.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-cta shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
              <Button
                className="w-full bg-cta text-cta-foreground hover:bg-cta/90"
                onClick={() => navigate(`/book?package=${pkg.id}`)}
              >
                Book This Service
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-12 border-2 border-accent/50 bg-accent/5">
        <CardContent className="py-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="h-16 w-16 bg-accent/20 rounded-full flex items-center justify-center shrink-0">
              <DollarSign className="h-8 w-8 text-accent" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-xl font-semibold mb-2">Transparent Pricing</h3>
              <p className="text-muted-foreground">
                All prices shown are base rates. Your final invoice will include any additional work discovered during
                service. We'll always notify you before proceeding with extra services.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
