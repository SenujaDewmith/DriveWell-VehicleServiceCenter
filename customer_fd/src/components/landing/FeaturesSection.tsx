import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, FileText, Users, type LucideIcon } from "lucide-react";

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const FEATURES: Feature[] = [
  {
    icon: Calendar,
    title: "Online Booking",
    description: "Schedule your service in minutes, 24/7",
  },
  {
    icon: Clock,
    title: "Real-Time Tracking",
    description: "Monitor your service status live",
  },
  {
    icon: FileText,
    title: "Digital Invoices",
    description: "Clear, itemized billing delivered instantly",
  },
  {
    icon: Users,
    title: "Multi-Vehicle Support",
    description: "Manage all your vehicles in one place",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl font-bold text-center mb-4">Why Choose DriveWell?</h2>
        <p className="text-center text-muted-foreground mb-12 text-lg">
          Experience the future of vehicle service
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="border-2 hover:border-cta transition-colors">
              <CardHeader>
                <feature.icon className="h-12 w-12 text-cta mb-4" />
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
