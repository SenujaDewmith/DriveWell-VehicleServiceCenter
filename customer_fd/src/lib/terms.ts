import { CANCELLATION_CUTOFF_HOURS } from "@/lib/bookingRules";

// Must match CURRENT_TERMS_VERSION in backend/src/controllers/bookings.controller.js —
// the backend rejects bookings that accepted an outdated version, and stores this value
// on the reservation so we can always prove which wording a customer agreed to.
export const TERMS_VERSION = "1.0";
export const TERMS_EFFECTIVE_DATE = "July 1, 2026";

export interface TermsSection {
  title: string;
  points: string[];
}

// The clauses mirror the rules the system actually enforces (cancellation cutoff,
// no-show handling, additional-work charges) — keep them in sync when those change.
export const TERMS_SECTIONS: TermsSection[] = [
  {
    title: "Bookings & Appointments",
    points: [
      "A booking reserves a service slot for the selected vehicle and package on the chosen date and time.",
      "Please arrive with your vehicle at least 10 minutes before your scheduled slot. Late arrivals may be treated as no-shows if the slot can no longer be honoured.",
      "DriveWell may contact you using the phone number or email on your account regarding your appointment.",
    ],
  },
  {
    title: "Cancellations & No-shows",
    points: [
      `Bookings can be cancelled free of charge up to ${CANCELLATION_CUTOFF_HOURS} hours before the appointment, from the My Bookings page.`,
      `Within ${CANCELLATION_CUTOFF_HOURS} hours of the appointment, online self-cancellation is disabled — please call the service center for urgent changes.`,
      "If you do not arrive for your appointment, the booking may be marked as a no-show. Repeated no-shows may limit your ability to book online.",
    ],
  },
  {
    title: "Pricing & Additional Work",
    points: [
      "The price shown at booking is the base price of the selected package. It is an estimate, not a final quote.",
      "If our technicians discover additional work needed during the service (e.g. worn parts, extra consumables), the required items and charges will be added to your final invoice.",
      "We will make reasonable efforts to inform you of significant additional work before carrying it out.",
      "The final invoice is payable in full at vehicle pickup.",
    ],
  },
  {
    title: "Vehicle Handover & Liability",
    points: [
      "Please remove valuables from your vehicle before handover. DriveWell is not responsible for personal items left in the vehicle.",
      "Your vehicle is handled with due care while in our custody. Pre-existing damage noted at check-in is not our responsibility.",
      "Vehicles must be collected on the day the service is completed unless otherwise agreed.",
    ],
  },
  {
    title: "Your Information",
    points: [
      "Your account, vehicle, and booking details are used only to provide and improve our services, including service reminders and booking notifications.",
      "Your acceptance of these terms (version and timestamp) is recorded with each booking.",
    ],
  },
];
