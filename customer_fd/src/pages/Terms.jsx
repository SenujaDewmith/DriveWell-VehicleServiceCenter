import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";
import { useContactPhone } from "@/hooks/useContactPhone";

const BASE_SECTIONS = [
  {
    title: "Using DriveWell",
    body: "By booking a service or creating an account, you agree to provide accurate vehicle and contact details so our team can prepare for your appointment correctly.",
  },
  {
    title: "Pricing & Invoices",
    body: "Prices shown at booking are estimates. Your final invoice reflects the actual work carried out and is itemized for full transparency.",
  },
  {
    title: "Your Responsibilities",
    body: "You're responsible for the accuracy of the vehicle details you provide and for collecting your vehicle within a reasonable time after service is complete.",
  },
  {
    title: "Changes to These Terms",
    body: "We may update these terms occasionally to reflect changes to our services. Continued use of DriveWell means you accept the current version.",
  },
];

export default function Terms() {
  const navigate = useNavigate();
  const contactPhone = useContactPhone();

  const sections = [
    BASE_SECTIONS[0],
    {
      title: "Bookings & Cancellations",
      body: `Slots are reserved on a first-come basis. Cancellations or reschedules must be made at least 24 hours before your appointment so the slot can be offered to someone else. For urgent cancellations inside the 24-hour window, please contact DriveWell by phone${contactPhone ? ` at ${contactPhone}` : ""}.`,
    },
    ...BASE_SECTIONS.slice(1),
  ];

  return (
    <div className="min-h-screen">
      <section className="py-16 border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap gap-3 mb-8">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button variant="outline" onClick={() => navigate("/")}>
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold mb-2">Terms of Service</h1>
          <p className="text-muted-foreground mb-10">Last updated: August 2026</p>

          <div className="max-w-2xl space-y-8">
            {sections.map((section) => (
              <div key={section.title}>
                <h2 className="text-xl font-semibold mb-2">{section.title}</h2>
                <p className="text-muted-foreground">{section.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
