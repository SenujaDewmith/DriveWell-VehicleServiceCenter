import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { toast } from "sonner";
import { RegisterForm } from "./RegisterForm";
import { useAuth } from "@/contexts/AuthContext";
vi.mock("@/contexts/AuthContext", () => ({
    useAuth: vi.fn(),
}));
vi.mock("sonner", () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));
const mockedUseAuth = vi.mocked(useAuth);
// A password satisfying every registerSchema rule: 8+ chars, upper, lower, number, special, no spaces.
const VALID_PASSWORD = "Str0ng!Pass";
function setup(register = vi.fn()) {
    mockedUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        login: vi.fn(),
        register,
        logout: vi.fn(),
        updateProfile: vi.fn(),
    });
    const onSuccess = vi.fn();
    const { container } = render(<RegisterForm onSuccess={onSuccess}/>);
    return { register, onSuccess, container };
}
async function fillValidForm(user, password = VALID_PASSWORD) {
    await user.type(screen.getByLabelText(/full name/i), "John Doe");
    await user.type(screen.getByLabelText(/email/i), "john@example.com");
    await user.type(screen.getByLabelText(/^password/i), password);
    await user.type(screen.getByLabelText(/confirm password/i), password);
}
describe("RegisterForm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it("renders name, email, password and confirm password fields", () => {
        setup();
        expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });
    it("shows a validation error for an invalid email", async () => {
        const user = userEvent.setup();
        const { container } = setup();
        await fillValidForm(user);
        await user.clear(screen.getByLabelText(/email/i));
        await user.type(screen.getByLabelText(/email/i), "not-an-email");
        // fireEvent.submit bypasses the input's native type="email" constraint validation
        // (which would otherwise silently block the submit event before RHF/zod ever run).
        fireEvent.submit(container.querySelector("form"));
        expect(await screen.findByText(/invalid email address/i)).toBeInTheDocument();
    });
    it("shows a validation error for a weak password and blocks submission", async () => {
        const user = userEvent.setup();
        const { register } = setup();
        await user.type(screen.getByLabelText(/full name/i), "John Doe");
        await user.type(screen.getByLabelText(/email/i), "john@example.com");
        await user.type(screen.getByLabelText(/^password/i), "weak");
        await user.type(screen.getByLabelText(/confirm password/i), "weak");
        await user.click(screen.getByRole("button", { name: /create account/i }));
        expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
        expect(register).not.toHaveBeenCalled();
    });
    it("shows a validation error when passwords do not match", async () => {
        const user = userEvent.setup();
        setup();
        await user.type(screen.getByLabelText(/full name/i), "John Doe");
        await user.type(screen.getByLabelText(/email/i), "john@example.com");
        await user.type(screen.getByLabelText(/^password/i), VALID_PASSWORD);
        await user.type(screen.getByLabelText(/confirm password/i), "Different1!");
        await user.click(screen.getByRole("button", { name: /create account/i }));
        expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
    });
    it("calls register with the entered payload on valid submit", async () => {
        const user = userEvent.setup();
        const register = vi.fn().mockResolvedValue(undefined);
        const { onSuccess } = setup(register);
        await fillValidForm(user);
        await user.click(screen.getByRole("button", { name: /create account/i }));
        await waitFor(() => {
            expect(register).toHaveBeenCalledWith({
                name: "John Doe",
                email: "john@example.com",
                password: VALID_PASSWORD,
            });
        });
        expect(onSuccess).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalled();
    });
    it("shows an error toast when register rejects", async () => {
        const user = userEvent.setup();
        const register = vi.fn().mockRejectedValue(new Error("Email already in use"));
        setup(register);
        await fillValidForm(user);
        await user.click(screen.getByRole("button", { name: /create account/i }));
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("Email already in use");
        });
    });
    it("strips non-letter characters as they're typed into the name field", async () => {
        const user = userEvent.setup();
        setup();
        const nameInput = screen.getByLabelText(/full name/i);
        await user.type(nameInput, "J0hn D03! Doe");
        expect(nameInput).toHaveValue("Jhn D Doe");
    });
    it("strips spaces as they're typed into the email and password fields", async () => {
        const user = userEvent.setup();
        setup();
        const emailInput = screen.getByLabelText(/email/i);
        const passwordInput = screen.getByLabelText(/^password/i);
        await user.type(emailInput, "john doe@example.com");
        await user.type(passwordInput, "Str0ng !Pass");
        expect(emailInput).toHaveValue("johndoe@example.com");
        expect(passwordInput).toHaveValue("Str0ng!Pass");
    });
    it("shows required indicators on every field label", () => {
        setup();
        const asterisks = screen.getAllByText("*");
        expect(asterisks.length).toBe(4);
    });
    it("disables the submit button while submitting", async () => {
        const user = userEvent.setup();
        let resolveRegister;
        const register = vi.fn().mockReturnValue(new Promise((resolve) => {
            resolveRegister = resolve;
        }));
        setup(register);
        await fillValidForm(user);
        await user.click(screen.getByRole("button", { name: /create account/i }));
        expect(await screen.findByRole("button", { name: /creating account/i })).toBeDisabled();
        resolveRegister();
    });
});
