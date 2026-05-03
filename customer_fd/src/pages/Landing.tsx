import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Car, Calendar, FileText, Users, CheckCircle, Star, Clock, Shield } from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[600px] flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?q=80&w=2000')",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-secondary/80" />
        </div>
        <div className="relative z-10 container mx-auto px-4 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-primary-foreground mb-6">
            Premium Vehicle Care, Simplified
          </h1>
          <p className="text-xl md:text-2xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Book online, track your service in real-time, and enjoy transparent pricing with digital invoices
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-cta text-cta-foreground hover:bg-cta/90 text-lg px-8 py-6"
              onClick={() => navigate("/book")}
            >
              Book a Service
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 py-6 bg-background/10 backdrop-blur-sm border-primary-foreground/30 text-primary-foreground hover:bg-background/20"
              onClick={() => navigate("/services")}
            >
              View Packages
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-4">Why Choose DriveWell?</h2>
          <p className="text-center text-muted-foreground mb-12 text-lg">
            Experience the future of vehicle service
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
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
            ].map((feature) => (
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

      {/* Popular Packages */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-4">Popular Service Packages</h2>
          <p className="text-center text-muted-foreground mb-12 text-lg">
            Professional care for every need and budget
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: "Basic Wash",
                price: "$29.99",
                duration: "30 min",
                features: ["Exterior wash", "Tire cleaning", "Interior vacuum", "Window cleaning"],
                popular: true,
              },
              {
                name: "Full Service",
                price: "$79.99",
                duration: "1h 30min",
                features: ["Everything in Basic", "Interior detailing", "Waxing", "Engine bay cleaning", "Undercarriage wash"],
                popular: true,
              },
              {
                name: "Premium Detailing",
                price: "$149.99",
                duration: "3h",
                features: ["Everything in Full Service", "Paint correction", "Ceramic coating", "Leather conditioning", "Headlight restoration"],
                premium: true,
              },
            ].map((pkg) => (
              <Card
                key={pkg.name}
                className={`relative ${
                  pkg.popular ? "border-cta border-2 shadow-lg" : pkg.premium ? "border-accent border-2" : ""
                }`}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-cta text-cta-foreground text-xs font-semibold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                {pkg.premium && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-accent text-accent-foreground text-xs font-semibold px-3 py-1 rounded-full">
                      Premium
                    </span>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl">{pkg.name}</CardTitle>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-cta">{pkg.price}</span>
                    <span className="text-muted-foreground">/ {pkg.duration}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {pkg.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-cta shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full mt-6 bg-cta text-cta-foreground hover:bg-cta/90"
                    onClick={() => navigate("/book")}
                  >
                    Book Now
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-4">How It Works</h2>
          <p className="text-center text-muted-foreground mb-12 text-lg">
            Three simple steps to a pristine vehicle
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                step: "1",
                icon: Users,
                title: "Register & Add Vehicles",
                description: "Create your account and add your vehicle details in minutes",
              },
              {
                step: "2",
                icon: Calendar,
                title: "Choose Service & Time",
                description: "Select your preferred package and convenient time slot",
              },
              {
                step: "3",
                icon: Car,
                title: "Track & Pickup",
                description: "Monitor service progress and collect your spotless vehicle",
              },
            ].map((step) => (
              <div key={step.step} className="text-center">
                <div className="relative inline-flex items-center justify-center mb-6">
                  <div className="absolute h-20 w-20 bg-cta/20 rounded-full" />
                  <div className="relative h-16 w-16 bg-cta rounded-full flex items-center justify-center">
                    <step.icon className="h-8 w-8 text-cta-foreground" />
                  </div>
                  <div className="absolute -top-2 -right-2 h-8 w-8 bg-accent rounded-full flex items-center justify-center text-accent-foreground font-bold">
                    {step.step}
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-4">What Our Customers Say</h2>
          <p className="text-center text-muted-foreground mb-12 text-lg">
            Trusted by thousands of satisfied customers
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                name: "Sarah Johnson",
                rating: 5,
                comment: "Incredible service! The online booking made it so easy, and my car has never looked better. Highly recommend!",
                avatar: "SJ",
              },
              {
                name: "Michael Chen",
                rating: 5,
                comment: "Love the real-time tracking feature. I could see exactly what was being done to my car. Very transparent and professional.",
                avatar: "MC",
              },
              {
                name: "Emily Rodriguez",
                rating: 5,
                comment: "The premium detailing package was worth every penny. My 5-year-old car looks brand new. Amazing attention to detail!",
                avatar: "ER",
              },
            ].map((testimonial) => (
              <Card key={testimonial.name} className="border-2">
                <CardHeader>
                  <div className="flex items-center gap-4 mb-3">
                    <div className="h-12 w-12 rounded-full bg-cta flex items-center justify-center text-cta-foreground font-semibold">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <p className="font-semibold">{testimonial.name}</p>
                      <div className="flex gap-1">
                        {Array.from({ length: testimonial.rating }).map((_, i) => (
                          <Star key={i} className="h-4 w-4 fill-cta text-cta" />
                        ))}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground italic">"{testimonial.comment}"</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-secondary to-accent text-secondary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Experience Premium Care?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of satisfied customers and give your vehicle the care it deserves
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-cta text-cta-foreground hover:bg-cta/90 text-lg px-8 py-6"
              onClick={() => navigate("/auth?mode=register")}
            >
              Sign Up Now
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 py-6 border-secondary-foreground/30 hover:bg-secondary-foreground/10"
              onClick={() => navigate("/services")}
            >
              Explore Services
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
