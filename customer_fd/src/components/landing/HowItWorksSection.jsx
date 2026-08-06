import step01 from "@/assets/landing/step-01-booking.jpg";
import step02 from "@/assets/landing/step-02-engine.jpg";
import step03 from "@/assets/landing/step-03-wash.jpg";
import step04 from "@/assets/landing/step-04-garage.jpg";
const STEPS = [
    {
        step: "01",
        image: step01,
        title: "Create Your Account",
        description: "Sign up in under a minute and get straight to your dashboard — no verification wait",
    },
    {
        step: "02",
        image: step02,
        title: "Book in One Flow",
        description: "Pick a package, choose a date and time slot, then add or select your vehicle",
    },
    {
        step: "03",
        image: step03,
        title: "Track Your Status",
        description: "Watch your booking move from Booked to Started to Completed on your dashboard",
    },
    {
        step: "04",
        image: step04,
        title: "Pay & Pick Up",
        description: "Review your itemized invoice and pay at the service center when you collect your vehicle",
    },
];
export function HowItWorksSection() {
    return (<section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl font-bold text-center mb-4 uppercase tracking-tight">How It Works</h2>
        <p className="text-center text-muted-foreground mb-16 text-lg">
          From sign-up to pickup, here's what to expect
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-14">
          {STEPS.map((step) => (<div key={step.step} className="text-center group">
              <div className="relative">
                <div className="h-72 rounded-t-full overflow-hidden">
                  <img src={step.image} alt="" className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-110 motion-reduce:transition-none"/>
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent"/>
                </div>
                <div className="absolute left-1/2 -bottom-7 -translate-x-1/2 h-14 w-14 rounded-full border-2 border-cta bg-background flex items-center justify-center">
                  <span className="text-lg font-bold text-foreground">{step.step}</span>
                </div>
              </div>
              <h3 className="text-xl font-semibold mt-10 mb-3">{step.title}</h3>
              <p className="text-muted-foreground">{step.description}</p>
            </div>))}
        </div>
      </div>
    </section>);
}
