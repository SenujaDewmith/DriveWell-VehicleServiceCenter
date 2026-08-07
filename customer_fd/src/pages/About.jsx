import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useContactPhone } from "@/hooks/useContactPhone";
import { ShieldCheck, Clock, FileText, Users, Car, Wrench, Calendar, HelpCircle, PhoneCall, ChevronRight, BadgeCheck, } from "lucide-react";
import headerImage from "@/assets/about/header.jpg";
import storyImage from "@/assets/about/story.jpg";
const HIGHLIGHTS = [
    { icon: BadgeCheck, label: "Supervisor Quality-Checked" },
    { icon: Calendar, label: "Real-Time Slot Availability" },
    { icon: FileText, label: "Itemized Digital Invoices" },
    { icon: Wrench, label: "Trained Service Technicians" },
];
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
    const contactPhone = useContactPhone();
    const EXPLORE = [
        {
            icon: Calendar,
            title: "Book a Service",
            description: "Pick a package and a real available time slot in minutes.",
            action: () => navigate("/book"),
        },
        {
            icon: Wrench,
            title: "Browse Services",
            description: "See every package, what's included, and transparent pricing.",
            action: () => navigate("/services"),
        },
        {
            icon: HelpCircle,
            title: "Read the FAQ",
            description: "Answers on booking, payments, invoices, and your account.",
            action: () => navigate("/faq"),
        },
        {
            icon: PhoneCall,
            title: "Talk to Us",
            description: contactPhone ? `Call us at ${contactPhone} for anything else.` : "Reach our team for anything else.",
            action: contactPhone
                ? () => { window.location.href = `tel:${contactPhone.replace(/[^\d+]/g, "")}`; }
                : () => navigate("/faq"),
        },
    ];
    return (<div className="min-h-screen">
      {/* Page header */}
      <section className="relative py-28 md:py-36 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${headerImage})` }}>
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/70 to-black/50"/>
        </div>
        <div className="relative z-10 container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">About DriveWell</h1>
          <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto mb-10">
            Modern vehicle care, built around clarity — for what's happening to your car, and what it costs.
          </p>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
            {HIGHLIGHTS.map((item) => (<div key={item.label} className="flex items-center gap-2 text-white/90 text-sm md:text-base font-medium">
                <item.icon className="h-5 w-5 text-cta shrink-0"/>
                <span>{item.label}</span>
              </div>))}
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center max-w-6xl mx-auto">
            <div>
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
            <div className="relative">
              <img src={storyImage} alt="Close-up of an engine bay during a DriveWell service" className="rounded-2xl shadow-xl w-full h-[320px] md:h-[380px] object-cover"/>
              <div className="absolute -bottom-6 -left-6 hidden sm:flex items-center gap-3 bg-card border-2 border-cta rounded-xl px-5 py-4 shadow-lg max-w-[240px]">
                <ShieldCheck className="h-8 w-8 text-cta shrink-0"/>
                <p className="text-sm font-semibold leading-snug">Every visit signed off by a supervisor</p>
              </div>
            </div>
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
            {VALUES.map((value) => (<Card key={value.title} className="group border-2 transition-all duration-300 ease-out hover:border-cta hover:-translate-y-1.5 hover:shadow-lg motion-reduce:transition-none">
                <CardHeader>
                  <div className="h-14 w-14 rounded-full bg-cta/10 flex items-center justify-center mb-4 transition-all duration-300 ease-out group-hover:scale-110 group-hover:bg-cta/20 motion-reduce:transition-none">
                    <value.icon className="h-6 w-6 text-cta"/>
                  </div>
                  <CardTitle className="text-xl">{value.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{value.description}</CardDescription>
                </CardContent>
              </Card>))}
          </div>
        </div>
      </section>

      {/* Explore DriveWell — actionable quick links */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-4">Explore DriveWell</h2>
          <p className="text-center text-muted-foreground mb-12 text-lg">
            Everything you need, one click away
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {EXPLORE.map((item) => (<Card key={item.title} role="button" tabIndex={0} onClick={item.action} onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    item.action();
                }
            }} className="group border-2 cursor-pointer transition-all duration-300 ease-out hover:border-cta hover:-translate-y-1.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none">
                <CardHeader>
                  <div className="h-14 w-14 rounded-full bg-cta/10 flex items-center justify-center mb-4 transition-all duration-300 ease-out group-hover:scale-110 group-hover:bg-cta/20 motion-reduce:transition-none">
                    <item.icon className="h-6 w-6 text-cta"/>
                  </div>
                  <CardTitle className="text-xl flex items-center justify-between gap-2">
                    {item.title}
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-300 ease-out group-hover:translate-x-1 group-hover:text-cta motion-reduce:transition-none"/>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{item.description}</CardDescription>
                </CardContent>
              </Card>))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-secondary to-accent text-secondary-foreground">
        <div className="container mx-auto px-4 text-center">
          <Car className="h-12 w-12 mx-auto mb-4 opacity-90"/>
          <h2 className="text-4xl font-bold mb-4">Ready to Experience the Difference?</h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Book your next service in minutes and see exactly what modern vehicle care looks like.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-cta text-cta-foreground hover:bg-cta/90 text-lg px-8 py-6" onClick={() => navigate("/register")}>
              Get Started
            </Button>
            <Button size="lg" variant="outline" className="text-lg text-black dark:text-white px-8 py-6 border-secondary-foreground/30 hover:bg-secondary-foreground/10" onClick={() => navigate("/services")}>
              View Our Services
            </Button>
          </div>
        </div>
      </section>
    </div>);
}
