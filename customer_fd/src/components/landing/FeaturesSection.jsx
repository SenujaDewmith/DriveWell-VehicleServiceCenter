import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, FileText, Users } from "lucide-react";
const FEATURES = [
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
    return (<section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl font-bold text-center mb-4">Why Choose DriveWell?</h2>
        <p className="text-center text-muted-foreground mb-12 text-lg">
          Experience the future of vehicle service
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((feature) => (<Card key={feature.title} className="group border-2 transition-all duration-300 ease-out hover:border-cta hover:-translate-y-1.5 hover:shadow-lg motion-reduce:transition-none">
              <CardHeader>
                <div className="h-16 w-16 rounded-full bg-cta/10 flex items-center justify-center mb-4 transition-all duration-300 ease-out group-hover:scale-110 group-hover:bg-cta/20 motion-reduce:transition-none">
                  <feature.icon className="h-7 w-7 text-cta"/>
                </div>
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">{feature.description}</CardDescription>
              </CardContent>
            </Card>))}
        </div>
      </div>
    </section>);
}
