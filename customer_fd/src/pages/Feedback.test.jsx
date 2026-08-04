import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";
import Feedback from "./Feedback";
import { useAuth } from "@/contexts/AuthContext";
import { bookingsService } from "@/services/bookings.service";
import { feedbackService } from "@/services/feedback.service";
vi.mock("@/contexts/AuthContext", () => ({
    useAuth: vi.fn(),
}));
vi.mock("@/services/bookings.service", () => ({
    bookingsService: { getBookings: vi.fn() },
}));
vi.mock("@/services/feedback.service", () => ({
    feedbackService: { getFeedback: vi.fn(), submitFeedback: vi.fn() },
}));
vi.mock("sonner", () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));
const mockedUseAuth = vi.mocked(useAuth);
const mockedGetBookings = vi.mocked(bookingsService.getBookings);
const mockedGetFeedback = vi.mocked(feedbackService.getFeedback);
const mockedSubmitFeedback = vi.mocked(feedbackService.submitFeedback);
const ELIGIBLE_BOOKING = {
    reservation_id: 42,
    booking_ref: "BK-42",
    service_date: "2026-07-01",
    status: "Collected",
    created_at: "2026-07-01T00:00:00.000Z",
    vehicle_id: 1,
    package_id: 1,
    make: "Toyota",
    model: "Corolla",
    package_name: "Full Service",
};
function renderFeedback() {
    mockedUseAuth.mockReturnValue({
        user: { id: "1", name: "John", email: "john@example.com", phone: "", secondaryPhone: "" },
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        updateProfile: vi.fn(),
    });
    return render(<MemoryRouter>
      <Feedback />
    </MemoryRouter>);
}
describe("Feedback page", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it("renders the eligible booking and submits a rating + comment", async () => {
        const user = userEvent.setup();
        mockedGetBookings.mockResolvedValue({ bookings: [ELIGIBLE_BOOKING] });
        mockedGetFeedback.mockResolvedValue({ feedback: [] });
        mockedSubmitFeedback.mockResolvedValue({ message: "ok" });
        renderFeedback();
        // Radix's Select renders a visually-hidden native <select> mirror alongside the
        // trigger, so "Full Service" legitimately appears twice in the DOM.
        expect((await screen.findAllByText(/Full Service/)).length).toBeGreaterThan(0);
        await user.click(screen.getByRole("button", { name: "4 stars" }));
        await user.type(screen.getByLabelText(/your comments/i), "Great service!");
        await user.click(screen.getByRole("button", { name: /submit feedback/i }));
        await waitFor(() => {
            expect(mockedSubmitFeedback).toHaveBeenCalledWith({
                reservation_id: 42,
                rating: 4,
                comment: "Great service!",
            });
        });
        expect(toast.success).toHaveBeenCalled();
    });
    it("shows an error toast and does not submit when no rating is selected", async () => {
        const user = userEvent.setup();
        mockedGetBookings.mockResolvedValue({ bookings: [ELIGIBLE_BOOKING] });
        mockedGetFeedback.mockResolvedValue({ feedback: [] });
        renderFeedback();
        // Radix's Select renders a visually-hidden native <select> mirror alongside the
        // trigger, so "Full Service" legitimately appears twice in the DOM.
        expect((await screen.findAllByText(/Full Service/)).length).toBeGreaterThan(0);
        await user.click(screen.getByRole("button", { name: /submit feedback/i }));
        expect(toast.error).toHaveBeenCalledWith("Please select a rating");
        expect(mockedSubmitFeedback).not.toHaveBeenCalled();
    });
    it("shows past feedback and does not render the form when nothing is eligible", async () => {
        const pastFeedback = {
            feedback_id: 1,
            reservation_id: 99,
            customer_id: 1,
            rating: 5,
            comment: "Excellent",
            submitted_at: "2026-06-01T00:00:00.000Z",
            booking_ref: "BK-99",
            service_date: "2026-06-01",
            make: "Honda",
            model: "Civic",
            vehicle_type: "Car",
            plate_no: "AB-1234",
            package_name: "Basic Wash",
        };
        mockedGetBookings.mockResolvedValue({ bookings: [] });
        mockedGetFeedback.mockResolvedValue({ feedback: [pastFeedback] });
        renderFeedback();
        expect(await screen.findByText(/Honda Civic/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /submit feedback/i })).not.toBeInTheDocument();
    });
});
