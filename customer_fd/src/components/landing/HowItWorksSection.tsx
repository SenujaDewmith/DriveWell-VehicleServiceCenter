import { Calendar, Clock, FileText, Users, type LucideIcon } from "lucide-react";

type Step = {
  step: string;
  icon: LucideIcon;
  title: string;
  description: string;
};

const STEPS: Step[] = [
  {
    step: "1",
    icon: Users,
    title: "Register & Add Vehicles",
    description: "Create your account and add your vehicle's details in minutes",
  },
  {
    step: "2",
    icon: Calendar,
    title: "Book Your Service",
    description: "Pick a package and choose a convenient date and time slot",
  },
  {
    step: "3",
    icon: Clock,
    title: "Track Progress",
    description: "Follow your service through each stage, from Started to Completed",
  },
  {
    step: "4",
    icon: FileText,
    title: "Review Invoice & Pick Up",
    description: "Check your itemized invoice once service is done, then collect your vehicle",
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl font-bold text-center mb-4">How It Works</h2>
        <p className="text-center text-muted-foreground mb-12 text-lg">
          Four simple steps to a pristine vehicle
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {STEPS.map((step) => (
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
  );
}
