import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useNavigate } from "react-router-dom";
import { Calendar, Car, CreditCard, HelpCircle, UserCog } from "lucide-react";
import { CANCELLATION_CUTOFF_HOURS } from "@/lib/bookingRules";

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqCategory {
  icon: typeof Calendar;
  title: string;
  items: FaqItem[];
}

const CATEGORIES: FaqCategory[] = [
  {
    icon: Calendar,
    title: "Booking & Appointments",
    items: [
      {
        question: "How do I book a service?",
        answer:
          "Go to Services, choose a package, then pick a date and time slot — availability shown at booking time reflects real remaining capacity, so the slot you pick is guaranteed.",
      },
      {
        question: "How do I cancel a booking?",
        answer:
          `Open the booking under My Bookings and select Cancel Booking. Self-service cancellation is available up until ${CANCELLATION_CUTOFF_HOURS} hours before your appointment. Inside that window, please call the service center directly for urgent changes.`,
      },
      {
        question: "What happens if I miss my appointment?",
        answer:
          "If you don't show up for a confirmed slot, it's marked as a no-show in your booking history. If your plans change, cancelling ahead of time frees up the slot for another customer.",
      },
      {
        question: "How do I track the status of my service?",
        answer:
          "Every booking's detail page shows its current stage — Booked, Started, In Progress, and Ready for Pickup or Completed — updated in real time as our team works on your vehicle, along with a supervisor's quality-check confirmation.",
      },
    ],
  },
  {
    icon: Car,
    title: "Vehicles & Service Packages",
    items: [
      {
        question: "Can I register more than one vehicle?",
        answer:
          "Yes. Add each vehicle under My Vehicles, and you'll be able to choose which one you're booking a service for at checkout.",
      },
      {
        question: "How do I know when my next service is due?",
        answer:
          "For any service that includes an oil change, your booking detail page shows the next due point — a target odometer reading or a fixed number of months from the service date, whichever comes first — so you're not guessing.",
      },
      {
        question: "Will I be told before extra work is added to my bill?",
        answer:
          "Yes. Any work beyond the booked package is itemized separately on your invoice, so you can see exactly what was added and why before you pay.",
      },
    ],
  },
  {
    icon: CreditCard,
    title: "Payments & Invoices",
    items: [
      {
        question: "How do I pay for a service?",
        answer:
          "Payment is collected at the service center when you pick up your vehicle. Once settled, a digital invoice is generated and available under Invoices in your account.",
      },
      {
        question: "Are the invoices itemized?",
        answer:
          "Every invoice breaks down the base package price, any additional charges, and discounts applied, with a final total — so there are no surprise line items.",
      },
    ],
  },
  {
    icon: UserCog,
    title: "Account & Support",
    items: [
      {
        question: "How do I update my profile or change my password?",
        answer: "Visit the Profile page from your account menu — you can update your details or change your password there at any time.",
      },
      {
        question: "Can I leave feedback after a service?",
        answer:
          "Yes — once a booking is marked Completed or Ready for Pickup, you can leave feedback for that visit from the Feedback page. It helps us keep improving how the service center runs.",
      },
    ],
  },
];

export default function FAQ() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      {/* Page header */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-secondary/80" />
        <div className="relative z-10 container mx-auto px-4 text-center">
          <HelpCircle className="h-12 w-12 mx-auto mb-4 text-primary-foreground/90" />
          <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-4">Frequently Asked Questions</h1>
          <p className="text-lg md:text-xl text-primary-foreground/90 max-w-2xl mx-auto">
            Answers to the most common questions about booking, vehicles, payments, and your account.
          </p>
        </div>
      </section>

      {/* FAQ categories */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto space-y-12">
            {CATEGORIES.map((category) => (
              <div key={category.title}>
                <div className="flex items-center gap-3 mb-2">
                  <category.icon className="h-6 w-6 text-cta" />
                  <h2 className="text-2xl font-bold">{category.title}</h2>
                </div>
                <Accordion type="single" collapsible className="w-full">
                  {category.items.map((item, index) => (
                    <AccordionItem key={item.question} value={`${category.title}-${index}`}>
                      <AccordionTrigger className="text-left text-base">{item.question}</AccordionTrigger>
                      <AccordionContent className="text-muted-foreground text-base">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-secondary to-accent text-secondary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">Still Have Questions?</h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Browse our services or book your next appointment — it only takes a few minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-cta text-cta-foreground hover:bg-cta/90 text-lg px-8 py-6"
              onClick={() => navigate("/services")}
            >
              View Our Services
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 py-6 border-secondary-foreground/30 hover:bg-secondary-foreground/10"
              onClick={() => navigate("/about")}
            >
              About DriveWell
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}