import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { DateTimeStep } from "./DateTimeStep";
// BookingCalendar does its own data fetching (covered by BookingCalendar.test.tsx) —
// stub it here so this test can focus purely on the slot-selection half of the step.
vi.mock("@/components/BookingCalendar", () => ({
    BookingCalendar: () => <div data-testid="booking-calendar-stub"/>,
}));
const SLOTS = [
    { start_time: "09:00", end_time: "10:00", capacity: 3, booked_count: 1, remaining: 2 },
    { start_time: "10:00", end_time: "11:00", capacity: 3, booked_count: 3, remaining: 0 },
];
function renderStep(overrides = {}) {
    const onSelectSlot = vi.fn();
    const onContinue = vi.fn();
    const onBack = vi.fn();
    const onSelectDate = vi.fn();
    const props = {
        packageId: 1,
        pkg: undefined,
        selectedDate: "2026-08-10",
        onSelectDate,
        slots: SLOTS,
        slotsLoading: false,
        dateAvailable: true,
        selectedStartTime: null,
        onSelectSlot,
        onBack,
        onContinue,
        ...overrides,
    };
    render(<DateTimeStep {...props}/>);
    return { onSelectSlot, onContinue, onBack, onSelectDate };
}
describe("DateTimeStep", () => {
    it("renders the available slots with their remaining/booked counts", () => {
        renderStep();
        expect(screen.getByText("9:00 AM - 10:00 AM")).toBeInTheDocument();
        expect(screen.getByText("10:00 AM - 11:00 AM")).toBeInTheDocument();
        expect(screen.getByText("AVAILABLE")).toBeInTheDocument();
        expect(screen.getByText("FULL")).toBeInTheDocument();
    });
    it("calls onSelectSlot with the clicked slot", async () => {
        const user = userEvent.setup();
        const { onSelectSlot } = renderStep();
        await user.click(screen.getByText("9:00 AM - 10:00 AM"));
        expect(onSelectSlot).toHaveBeenCalledWith(SLOTS[0]);
    });
    it("does not fire onSelectSlot for a full slot", async () => {
        const user = userEvent.setup();
        const { onSelectSlot } = renderStep();
        const fullSlotButton = screen.getByText("10:00 AM - 11:00 AM").closest("button");
        expect(fullSlotButton).toBeDisabled();
        await user.click(fullSlotButton);
        expect(onSelectSlot).not.toHaveBeenCalled();
    });
    it("disables Confirm Selection until a date and slot are both chosen", () => {
        renderStep({ selectedStartTime: null });
        expect(screen.getByRole("button", { name: /confirm selection/i })).toBeDisabled();
    });
    it("enables Confirm Selection once a slot is selected, and calls onContinue when clicked", async () => {
        const user = userEvent.setup();
        const { onContinue } = renderStep({ selectedStartTime: "09:00" });
        const confirmButton = screen.getByRole("button", { name: /confirm selection/i });
        expect(confirmButton).not.toBeDisabled();
        await user.click(confirmButton);
        expect(onContinue).toHaveBeenCalled();
    });
    it("shows a message instead of slots when no date is selected", () => {
        renderStep({ selectedDate: "" });
        expect(screen.getByText(/select a date to see available slots/i)).toBeInTheDocument();
    });
    it("shows a no-availability message when the date has no slots", () => {
        renderStep({ dateAvailable: false, slots: [] });
        expect(screen.getByText(/no slots available on this date/i)).toBeInTheDocument();
    });
    it("disables a vehicle_conflict slot with a distinct label instead of FULL", async () => {
        const user = userEvent.setup();
        const { onSelectSlot } = renderStep({
            slots: [
                { start_time: "09:00", end_time: "10:00", capacity: 3, booked_count: 1, remaining: 0, vehicle_conflict: true },
            ],
        });
        expect(screen.getByText("YOUR VEHICLE IS BOOKED")).toBeInTheDocument();
        expect(screen.queryByText("FULL")).not.toBeInTheDocument();
        const conflictButton = screen.getByText("9:00 AM - 10:00 AM").closest("button");
        expect(conflictButton).toBeDisabled();
        await user.click(conflictButton);
        expect(onSelectSlot).not.toHaveBeenCalled();
    });
});
