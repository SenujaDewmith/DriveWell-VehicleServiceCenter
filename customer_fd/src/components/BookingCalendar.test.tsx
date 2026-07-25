import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { BookingCalendar, toDateKey } from "./BookingCalendar";
import { bookingsService } from "@/services/bookings.service";

vi.mock("@/services/bookings.service", () => ({
  bookingsService: {
    getMonthAvailability: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedGetMonthAvailability = vi.mocked(bookingsService.getMonthAvailability);

describe("BookingCalendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches availability for the current month and reports the clicked available date", async () => {
    const user = userEvent.setup();
    const today = new Date();
    // "Today" itself: guaranteed in-month and never disabled as past (isPast is a
    // strict `<`), and its day-of-month number can't collide with the leading/trailing
    // padding cells (which only ever show the adjacent months' first/last few days).
    const availableDate = today;
    const availableKey = toDateKey(availableDate);

    mockedGetMonthAvailability.mockResolvedValue({
      days: [{ date: availableKey, status: "available", remaining_capacity: 5, total_windows: 3 }],
    });

    const onSelectDate = vi.fn();
    render(<BookingCalendar packageId={1} selectedDate="" onSelectDate={onSelectDate} />);

    await waitFor(() => {
      expect(mockedGetMonthAvailability).toHaveBeenCalledWith(
        today.getFullYear(),
        today.getMonth() + 1,
        1
      );
    });

    const button = (await screen.findByText("5 slots")).closest("button")!;
    expect(button).not.toBeDisabled();

    await user.click(button);
    expect(onSelectDate).toHaveBeenCalledWith(availableKey);
  });

  it("disables days that come back as closed", async () => {
    const today = new Date();
    const closedDate = today;
    const closedKey = toDateKey(closedDate);

    mockedGetMonthAvailability.mockResolvedValue({
      days: [{ date: closedKey, status: "closed", remaining_capacity: 0, total_windows: 0 }],
    });

    const onSelectDate = vi.fn();
    render(<BookingCalendar packageId={1} selectedDate="" onSelectDate={onSelectDate} />);

    await waitFor(() => expect(mockedGetMonthAvailability).toHaveBeenCalled());

    const button = (await screen.findByText(closedDate.getDate().toString())).closest("button")!;
    await waitFor(() => expect(button).toBeDisabled());
    expect(onSelectDate).not.toHaveBeenCalled();
  });
});
