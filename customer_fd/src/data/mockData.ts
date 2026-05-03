export interface Vehicle {
  id: string;
  nickname: string;
  make: string;
  model: string;
  year: number;
  registration: string;
  color: string;
  fuelType: string;
  notes?: string;
}

export interface ServicePackage {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: string;
  popular?: boolean;
  premium?: boolean;
  features: string[];
}

export type BookingStatus = "booked" | "in-progress" | "completed" | "ready" | "cancelled";

export interface Booking {
  id: string;
  vehicleId: string;
  packageId: string;
  date: string;
  timeSlot: string;
  status: BookingStatus;
  createdAt: string;
  statusHistory: StatusUpdate[];
  additionalNotes?: string;
}

export interface StatusUpdate {
  status: BookingStatus;
  timestamp: string;
  note: string;
}

export interface Invoice {
  id: string;
  bookingId: string;
  vehicleId: string;
  date: string;
  packageId: string;
  baseAmount: number;
  additionalCharges: { item: string; amount: number }[];
  discount: number;
  total: number;
  paid: boolean;
}

export interface Feedback {
  id: string;
  bookingId: string;
  vehicleId: string;
  rating: number;
  comment: string;
  date: string;
}

export const mockVehicles: Vehicle[] = [
  {
    id: "v1",
    nickname: "My Honda",
    make: "Honda",
    model: "Civic",
    year: 2022,
    registration: "ABC123",
    color: "Silver",
    fuelType: "Petrol",
  },
  {
    id: "v2",
    nickname: "Family Car",
    make: "Toyota",
    model: "Camry",
    year: 2021,
    registration: "XYZ789",
    color: "Black",
    fuelType: "Hybrid",
  },
];

export const mockPackages: ServicePackage[] = [
  {
    id: "p1",
    name: "Basic Wash",
    description: "Exterior wash, tire cleaning, and quick interior vacuum",
    price: 29.99,
    duration: "30 min",
    popular: true,
    features: ["Exterior wash", "Tire cleaning", "Interior vacuum", "Window cleaning"],
  },
  {
    id: "p2",
    name: "Full Service",
    description: "Complete interior and exterior detailing with waxing",
    price: 79.99,
    duration: "1h 30min",
    popular: true,
    features: ["Everything in Basic", "Interior detailing", "Waxing", "Engine bay cleaning", "Undercarriage wash"],
  },
  {
    id: "p3",
    name: "Premium Detailing",
    description: "Professional detailing with paint protection and leather treatment",
    price: 149.99,
    duration: "3h",
    premium: true,
    features: ["Everything in Full Service", "Paint correction", "Ceramic coating", "Leather conditioning", "Headlight restoration"],
  },
  {
    id: "p4",
    name: "Express Wash",
    description: "Quick exterior wash for busy schedules",
    price: 19.99,
    duration: "15 min",
    features: ["Exterior wash", "Tire shine"],
  },
  {
    id: "p5",
    name: "Interior Deep Clean",
    description: "Thorough interior cleaning and sanitization",
    price: 59.99,
    duration: "1h",
    features: ["Deep vacuum", "Upholstery cleaning", "Dashboard detailing", "Odor elimination"],
  },
  {
    id: "p6",
    name: "Paint Protection",
    description: "Advanced paint protection with ceramic coating",
    price: 199.99,
    duration: "4h",
    premium: true,
    features: ["Paint decontamination", "Ceramic coating", "6-month protection", "Enhanced gloss"],
  },
];

export const mockBookings: Booking[] = [
  {
    id: "b1",
    vehicleId: "v1",
    packageId: "p2",
    date: "2025-12-01",
    timeSlot: "10:00 AM",
    status: "completed",
    createdAt: "2025-11-20T10:00:00Z",
    statusHistory: [
      { status: "booked", timestamp: "2025-11-20T10:00:00Z", note: "Booking confirmed" },
      { status: "in-progress", timestamp: "2025-12-01T10:00:00Z", note: "Service started" },
      { status: "completed", timestamp: "2025-12-01T11:30:00Z", note: "Service completed successfully" },
      { status: "ready", timestamp: "2025-12-01T11:35:00Z", note: "Vehicle ready for pickup" },
    ],
  },
  {
    id: "b2",
    vehicleId: "v2",
    packageId: "p1",
    date: "2025-12-05",
    timeSlot: "2:00 PM",
    status: "booked",
    createdAt: "2025-11-25T14:00:00Z",
    statusHistory: [
      { status: "booked", timestamp: "2025-11-25T14:00:00Z", note: "Booking confirmed for December 5th" },
    ],
  },
];

export const mockInvoices: Invoice[] = [
  {
    id: "inv1",
    bookingId: "b1",
    vehicleId: "v1",
    date: "2025-12-01",
    packageId: "p2",
    baseAmount: 79.99,
    additionalCharges: [
      { item: "Extra wax application", amount: 15.0 },
      { item: "Headlight restoration", amount: 25.0 },
    ],
    discount: 10.0,
    total: 109.99,
    paid: true,
  },
];

export const mockFeedback: Feedback[] = [
  {
    id: "f1",
    bookingId: "b1",
    vehicleId: "v1",
    rating: 5,
    comment: "Excellent service! My car looks brand new. Very professional staff and great attention to detail.",
    date: "2025-12-01",
  },
];
