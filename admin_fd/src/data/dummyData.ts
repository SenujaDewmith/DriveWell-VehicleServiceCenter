// ─── TYPES ───────────────────────────────────────────────
export type Role = "manager" | "supervisor" | "cashier" | "staff";

export type BookingStatus =
  | "Booked"
  | "Started"
  | "In Progress"
  | "Completed"
  | "Ready for Pickup"
  | "Billed";

export interface StaffMember {
  id: string;
  name: string;
  role: Role;
  phone: string;
  active: boolean;
  joinedDate: string;
}

export interface ServicePackage {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  duration: string;
  active: boolean;
}

export interface Vehicle {
  plate: string;
  make: string;
  model: string;
  color: string;
}

export interface Booking {
  id: string;
  customerId: string;
  customerName: string;
  phone: string;
  vehicle: Vehicle;
  package: string;
  status: BookingStatus;
  date: string;
  timeSlot: string;
  assignedStaff: string[];
  remarks: string;
  consumables: string[];
  qualityChecked: boolean;
  addOns: { name: string; price: number }[];
  discount: number;
  paymentMethod: string;
  rating?: number;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

export interface ScheduleConfig {
  workingDays: string[];
  timeSlots: string[];
  capacityPerSlot: number;
}

// ─── STAFF ───────────────────────────────────────────────
export const staff: StaffMember[] = [
  { id: "S001", name: "Kamal Perera", role: "manager", phone: "077-1234567", active: true, joinedDate: "2022-01-15" },
  { id: "S002", name: "Nimal Fernando", role: "supervisor", phone: "077-2345678", active: true, joinedDate: "2022-03-01" },
  { id: "S003", name: "Sunil Jayawardena", role: "cashier", phone: "077-3456789", active: true, joinedDate: "2022-06-10" },
  { id: "S004", name: "Ruwan Silva", role: "staff", phone: "077-4567890", active: true, joinedDate: "2023-01-05" },
  { id: "S005", name: "Chaminda Bandara", role: "staff", phone: "077-5678901", active: true, joinedDate: "2023-02-20" },
  { id: "S006", name: "Dinesh Kumara", role: "staff", phone: "077-6789012", active: true, joinedDate: "2023-04-15" },
  { id: "S007", name: "Asanka Rajapakse", role: "staff", phone: "077-7890123", active: false, joinedDate: "2022-08-01" },
  { id: "S008", name: "Lahiru Wijesinghe", role: "staff", phone: "077-8901234", active: true, joinedDate: "2023-07-01" },
  { id: "S009", name: "Pradeep Mendis", role: "supervisor", phone: "077-9012345", active: true, joinedDate: "2023-09-01" },
  { id: "S010", name: "Thilina Samaraweera", role: "cashier", phone: "077-0123456", active: true, joinedDate: "2024-01-10" },
];

// ─── SERVICE PACKAGES ────────────────────────────────────
export const servicePackages: ServicePackage[] = [
  { id: "PKG001", name: "Basic Exterior Wash", description: "Body wash, rinse, and dry", basePrice: 1500, duration: "30 min", active: true },
  { id: "PKG002", name: "Full Interior Clean", description: "Vacuum, dashboard wipe, seat cleaning", basePrice: 3000, duration: "60 min", active: true },
  { id: "PKG003", name: "Premium Combo", description: "Full exterior + interior + tyre shine", basePrice: 5000, duration: "90 min", active: true },
  { id: "PKG004", name: "Under Wash", description: "Chassis and undercarriage pressure wash", basePrice: 2000, duration: "45 min", active: true },
  { id: "PKG005", name: "Deluxe Detail", description: "Full detail with polish, wax, and ceramic coat", basePrice: 12000, duration: "180 min", active: true },
  { id: "PKG006", name: "Quick Rinse", description: "Fast exterior rinse only", basePrice: 800, duration: "15 min", active: false },
];

// ─── VEHICLES ────────────────────────────────────────────
const vehicles: Vehicle[] = [
  { plate: "WP CAR-1234", make: "Toyota", model: "Aqua", color: "White" },
  { plate: "WP BDJ-5678", make: "Honda", model: "Vezel", color: "Black" },
  { plate: "CP KAN-9012", make: "Suzuki", model: "Alto", color: "Silver" },
  { plate: "WP ABC-3456", make: "Nissan", model: "X-Trail", color: "Blue" },
  { plate: "SP GAL-7890", make: "Toyota", model: "Hilux", color: "Red" },
  { plate: "WP DEF-2345", make: "Mitsubishi", model: "Lancer", color: "Grey" },
  { plate: "NP JAF-6789", make: "Hyundai", model: "Tucson", color: "White" },
  { plate: "WP GHI-0123", make: "BMW", model: "X3", color: "Black" },
  { plate: "EP BAT-4567", make: "Toyota", model: "Prius", color: "Silver" },
  { plate: "WP JKL-8901", make: "Mercedes", model: "C200", color: "Grey" },
  { plate: "SG MAT-1122", make: "Suzuki", model: "Swift", color: "Red" },
  { plate: "WP MNO-3344", make: "Toyota", model: "Corolla", color: "White" },
];

const customers = [
  { id: "C001", name: "Saman Wickramasinghe", phone: "071-1112233" },
  { id: "C002", name: "Anjali de Silva", phone: "071-2223344" },
  { id: "C003", name: "Roshan Gunawardena", phone: "071-3334455" },
  { id: "C004", name: "Dilini Pathirana", phone: "071-4445566" },
  { id: "C005", name: "Mahesh Rathnayake", phone: "071-5556677" },
  { id: "C006", name: "Chathurika Herath", phone: "071-6667788" },
  { id: "C007", name: "Tharanga Dissanayake", phone: "071-7778899" },
  { id: "C008", name: "Ishara Bandara", phone: "071-8889900" },
  { id: "C009", name: "Kumari Fonseka", phone: "071-9990011" },
  { id: "C010", name: "Ashan Liyanage", phone: "071-0001122" },
  { id: "C011", name: "Nirosha Jayasuriya", phone: "071-1231234" },
  { id: "C012", name: "Prasad Wijeratne", phone: "071-3213214" },
];

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

// ─── BOOKINGS ────────────────────────────────────────────
export const bookings: Booking[] = [
  { id: "B001", customerId: "C001", customerName: "Saman Wickramasinghe", phone: "071-1112233", vehicle: vehicles[0], package: "Premium Combo", status: "Booked", date: today, timeSlot: "08:00", assignedStaff: ["S004"], remarks: "", consumables: [], qualityChecked: false, addOns: [], discount: 0, paymentMethod: "" },
  { id: "B002", customerId: "C002", customerName: "Anjali de Silva", phone: "071-2223344", vehicle: vehicles[1], package: "Full Interior Clean", status: "Started", date: today, timeSlot: "08:30", assignedStaff: ["S005"], remarks: "Customer requested extra fragrance", consumables: ["Air freshener"], qualityChecked: false, addOns: [{ name: "Air Freshener", price: 300 }], discount: 0, paymentMethod: "" },
  { id: "B003", customerId: "C003", customerName: "Roshan Gunawardena", phone: "071-3334455", vehicle: vehicles[2], package: "Basic Exterior Wash", status: "In Progress", date: today, timeSlot: "09:00", assignedStaff: ["S006", "S008"], remarks: "", consumables: ["Shampoo", "Wax"], qualityChecked: false, addOns: [], discount: 200, paymentMethod: "" },
  { id: "B004", customerId: "C004", customerName: "Dilini Pathirana", phone: "071-4445566", vehicle: vehicles[3], package: "Deluxe Detail", status: "Completed", date: today, timeSlot: "09:30", assignedStaff: ["S004", "S005", "S006"], remarks: "VIP customer", consumables: ["Ceramic coat", "Polish", "Wax"], qualityChecked: true, addOns: [{ name: "Ceramic Coating", price: 5000 }], discount: 500, paymentMethod: "" },
  { id: "B005", customerId: "C005", customerName: "Mahesh Rathnayake", phone: "071-5556677", vehicle: vehicles[4], package: "Under Wash", status: "Ready for Pickup", date: today, timeSlot: "10:00", assignedStaff: ["S008"], remarks: "Muddy undercarriage", consumables: ["Degreaser"], qualityChecked: true, addOns: [{ name: "Engine Bay Clean", price: 1500 }], discount: 0, paymentMethod: "" },
  { id: "B006", customerId: "C006", customerName: "Chathurika Herath", phone: "071-6667788", vehicle: vehicles[5], package: "Premium Combo", status: "Billed", date: today, timeSlot: "10:30", assignedStaff: ["S004", "S006"], remarks: "", consumables: ["Shampoo", "Polish"], qualityChecked: true, addOns: [], discount: 0, paymentMethod: "Cash", rating: 5 },
  { id: "B007", customerId: "C007", customerName: "Tharanga Dissanayake", phone: "071-7778899", vehicle: vehicles[6], package: "Basic Exterior Wash", status: "Billed", date: yesterday, timeSlot: "08:00", assignedStaff: ["S005"], remarks: "", consumables: ["Shampoo"], qualityChecked: true, addOns: [], discount: 100, paymentMethod: "Card", rating: 4 },
  { id: "B008", customerId: "C008", customerName: "Ishara Bandara", phone: "071-8889900", vehicle: vehicles[7], package: "Deluxe Detail", status: "Billed", date: yesterday, timeSlot: "09:00", assignedStaff: ["S004", "S005", "S006"], remarks: "Regular customer - 2nd visit", consumables: ["Ceramic coat", "Polish", "Wax", "Degreaser"], qualityChecked: true, addOns: [{ name: "Ceramic Coating", price: 5000 }, { name: "Engine Bay", price: 1500 }], discount: 1000, paymentMethod: "Cash", rating: 5 },
  { id: "B009", customerId: "C009", customerName: "Kumari Fonseka", phone: "071-9990011", vehicle: vehicles[8], package: "Full Interior Clean", status: "Billed", date: yesterday, timeSlot: "10:00", assignedStaff: ["S008"], remarks: "", consumables: ["Fabric cleaner"], qualityChecked: true, addOns: [], discount: 0, paymentMethod: "Card", rating: 3 },
  { id: "B010", customerId: "C010", customerName: "Ashan Liyanage", phone: "071-0001122", vehicle: vehicles[9], package: "Premium Combo", status: "Billed", date: twoDaysAgo, timeSlot: "08:30", assignedStaff: ["S004", "S006"], remarks: "", consumables: ["Shampoo", "Polish", "Wax"], qualityChecked: true, addOns: [{ name: "Tyre Dressing", price: 500 }], discount: 0, paymentMethod: "Cash", rating: 4 },
  { id: "B011", customerId: "C011", customerName: "Nirosha Jayasuriya", phone: "071-1231234", vehicle: vehicles[10], package: "Basic Exterior Wash", status: "Booked", date: today, timeSlot: "11:00", assignedStaff: [], remarks: "", consumables: [], qualityChecked: false, addOns: [], discount: 0, paymentMethod: "" },
  { id: "B012", customerId: "C012", customerName: "Prasad Wijeratne", phone: "071-3213214", vehicle: vehicles[11], package: "Under Wash", status: "Started", date: today, timeSlot: "11:30", assignedStaff: ["S004"], remarks: "Large vehicle - extra time needed", consumables: [], qualityChecked: false, addOns: [], discount: 0, paymentMethod: "" },
];

// ─── ACTIVITY LOG ────────────────────────────────────────
export const activityLog: ActivityLog[] = [
  { id: "A001", timestamp: `${today}T08:00:00`, user: "Kamal Perera", action: "BOOKING_CREATED", details: "Created booking B001 for Saman Wickramasinghe" },
  { id: "A002", timestamp: `${today}T08:05:00`, user: "Nimal Fernando", action: "STATUS_CHANGED", details: "B002 status changed to Started" },
  { id: "A003", timestamp: `${today}T08:30:00`, user: "Nimal Fernando", action: "STAFF_ASSIGNED", details: "Assigned Ruwan Silva to B001" },
  { id: "A004", timestamp: `${today}T09:00:00`, user: "Nimal Fernando", action: "STATUS_CHANGED", details: "B003 status changed to In Progress" },
  { id: "A005", timestamp: `${today}T09:45:00`, user: "Nimal Fernando", action: "QUALITY_CHECK", details: "Quality check passed for B004" },
  { id: "A006", timestamp: `${today}T10:00:00`, user: "Sunil Jayawardena", action: "INVOICE_GENERATED", details: "Invoice generated for B006 - LKR 5,000" },
  { id: "A007", timestamp: `${today}T10:05:00`, user: "Sunil Jayawardena", action: "PAYMENT_RECEIVED", details: "Cash payment received for B006" },
  { id: "A008", timestamp: `${yesterday}T14:00:00`, user: "Kamal Perera", action: "PACKAGE_UPDATED", details: "Updated pricing for Premium Combo" },
  { id: "A009", timestamp: `${yesterday}T15:00:00`, user: "Kamal Perera", action: "USER_DEACTIVATED", details: "Deactivated staff member Asanka Rajapakse" },
  { id: "A010", timestamp: `${twoDaysAgo}T09:00:00`, user: "Kamal Perera", action: "SCHEDULE_UPDATED", details: "Updated working hours for Saturday" },
];

// ─── SCHEDULE CONFIG ─────────────────────────────────────
export const scheduleConfig: ScheduleConfig = {
  workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  timeSlots: ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"],
  capacityPerSlot: 4,
};

// ─── REVENUE DATA (for charts) ───────────────────────────
export const revenueData = [
  { month: "Jan", revenue: 285000, services: 142 },
  { month: "Feb", revenue: 310000, services: 155 },
  { month: "Mar", revenue: 295000, services: 148 },
  { month: "Apr", revenue: 340000, services: 170 },
  { month: "May", revenue: 380000, services: 190 },
  { month: "Jun", revenue: 365000, services: 182 },
  { month: "Jul", revenue: 420000, services: 210 },
  { month: "Aug", revenue: 395000, services: 198 },
  { month: "Sep", revenue: 445000, services: 222 },
  { month: "Oct", revenue: 460000, services: 230 },
  { month: "Nov", revenue: 430000, services: 215 },
  { month: "Dec", revenue: 490000, services: 245 },
];

export const serviceVolumeByPackage = [
  { name: "Basic Exterior Wash", count: 520 },
  { name: "Full Interior Clean", count: 380 },
  { name: "Premium Combo", count: 290 },
  { name: "Under Wash", count: 210 },
  { name: "Deluxe Detail", count: 150 },
];

export const staffPerformance = [
  { name: "Ruwan Silva", completed: 145, avgRating: 4.5, efficiency: 92 },
  { name: "Chaminda Bandara", completed: 132, avgRating: 4.2, efficiency: 88 },
  { name: "Dinesh Kumara", completed: 128, avgRating: 4.7, efficiency: 95 },
  { name: "Lahiru Wijesinghe", completed: 115, avgRating: 4.0, efficiency: 85 },
];

// ─── HELPERS ─────────────────────────────────────────────
export function getPackagePrice(packageName: string): number {
  return servicePackages.find((p) => p.name === packageName)?.basePrice ?? 0;
}

export function getTodayBookings(): Booking[] {
  return bookings.filter((b) => b.date === today);
}

export function getReadyForBilling(): Booking[] {
  return bookings.filter((b) => b.status === "Ready for Pickup" || b.status === "Completed");
}

export function getStaffBookings(staffId: string): Booking[] {
  return bookings.filter((b) => b.assignedStaff.includes(staffId));
}
