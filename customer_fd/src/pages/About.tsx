import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Clock, FileText, Users, Car } from "lucide-react";

const VALUES = [
  {
    icon: ShieldCheck,
    title: "Quality You Can Trust",
    description: "Every service is signed off with a supervisor quality check before your vehicle is handed back.",
  },
  {
    icon: Clock,
    title: "Respect for Your Time",
    description: "Online booking and real slot availability mean no walk-in queues or guessing when you'll be seen.",
  },
  {
    icon: FileText,
    title: "Transparent Pricing",
    description: "Itemized digital invoices for every visit — you always know what you're paying for and why.",
  },
  {
    icon: Users,
    title: "Customer First",
    description: "Feedback from every visit feeds directly back into how we run the service center.",
  },
];

export default function About() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      {/* Page header */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-secondary/80" />
        <div className="relative z-10 container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-4">About DriveWell</h1>
          <p className="text-lg md:text-xl text-primary-foreground/90 max-w-2xl mx-auto">
            Modern vehicle care, built around clarity — for what's happening to your car, and what it costs.
          </p>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-6">Our Story</h2>
            <p className="text-lg text-muted-foreground mb-4">
              DriveWell started from a simple frustration familiar to most vehicle owners: dropping off a car for
              service and having no real visibility into what's happening to it, when it'll be ready, or what the
              final bill will look like.
            </p>
            <p className="text-lg text-muted-foreground">
              We built DriveWell to fix that — online booking that shows real availability, a service process you
              can follow stage by stage, and itemized digital invoices with no surprise line items. It's the same
              quality workshop experience, just without the guesswork.
            </p>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-4">What We Stand For</h2>
          <p className="text-center text-muted-foreground mb-12 text-lg">
            The principles behind how we run every service
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUES.map((value) => (
              <Card key={value.title} className="border-2 hover:border-cta transition-colors">
                <CardHeader>
                  <value.icon className="h-12 w-12 text-cta mb-4" />
                  <CardTitle className="text-xl">{value.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{value.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-secondary to-accent text-secondary-foreground">
        <div className="container mx-auto px-4 text-center">
          <Car className="h-12 w-12 mx-auto mb-4 opacity-90" />
          <h2 className="text-4xl font-bold mb-4">Ready to Experience the Difference?</h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Book your next service in minutes and see exactly what modern vehicle care looks like.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-cta text-cta-foreground hover:bg-cta/90 text-lg px-8 py-6"
              onClick={() => navigate("/register")}
            >
              Get Started
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 py-6 border-secondary-foreground/30 hover:bg-secondary-foreground/10"
              onClick={() => navigate("/services")}
            >
              View Our Services
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
