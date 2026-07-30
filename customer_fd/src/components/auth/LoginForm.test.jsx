import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { toast } from "sonner";
import { LoginForm } from "./LoginForm";
import { useAuth } from "@/contexts/AuthContext";
vi.mock("@/contexts/AuthContext", () => ({
    useAuth: vi.fn(),
}));
vi.mock("sonner", () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));
const mockedUseAuth = vi.mocked(useAuth);
function setup(login = vi.fn()) {
    mockedUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        login,
        register: vi.fn(),
        logout: vi.fn(),
        updateProfile: vi.fn(),
    });
    const onSuccess = vi.fn();
    const { container } = render(<LoginForm onSuccess={onSuccess}/>);
    return { login, onSuccess, container };
}
describe("LoginForm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it("renders email and password fields", () => {
        setup();
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    });
    it("shows a validation error for an invalid email", async () => {
        const user = userEvent.setup();
        const { container } = setup();
        await user.type(screen.getByLabelText(/email/i), "not-an-email");
        await user.type(screen.getByLabelText(/^password$/i), "password123");
        // fireEvent.submit bypasses the input's native type="email" constraint validation
        // (which would otherwise silently block the submit event before RHF/zod ever run).
        fireEvent.submit(container.querySelector("form"));
        expect(await screen.findByText(/invalid email address/i)).toBeInTheDocument();
    });
    it("shows a validation error for a too-short password", async () => {
        const user = userEvent.setup();
        setup();
        await user.type(screen.getByLabelText(/email/i), "john@example.com");
        await user.type(screen.getByLabelText(/^password$/i), "123");
        await user.click(screen.getByRole("button", { name: /sign in/i }));
        expect(await screen.findByText(/at least 6 characters/i)).toBeInTheDocument();
    });
    it("calls login with the entered credentials on valid submit", async () => {
        const user = userEvent.setup();
        const login = vi.fn().mockResolvedValue(undefined);
        const { onSuccess } = setup(login);
        await user.type(screen.getByLabelText(/email/i), "john@example.com");
        await user.type(screen.getByLabelText(/^password$/i), "password123");
        await user.click(screen.getByRole("button", { name: /sign in/i }));
        await waitFor(() => {
            expect(login).toHaveBeenCalledWith("john@example.com", "password123", false);
        });
        expect(onSuccess).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalled();
    });
    it("passes rememberMe through when the checkbox is checked", async () => {
        const user = userEvent.setup();
        const login = vi.fn().mockResolvedValue(undefined);
        setup(login);
        await user.type(screen.getByLabelText(/email/i), "john@example.com");
        await user.type(screen.getByLabelText(/^password$/i), "password123");
        await user.click(screen.getByRole("checkbox"));
        await user.click(screen.getByRole("button", { name: /sign in/i }));
        await waitFor(() => {
            expect(login).toHaveBeenCalledWith("john@example.com", "password123", true);
        });
    });
    it("shows an error toast when login rejects", async () => {
        const user = userEvent.setup();
        const login = vi.fn().mockRejectedValue(new Error("Invalid credentials"));
        setup(login);
        await user.type(screen.getByLabelText(/email/i), "john@example.com");
        await user.type(screen.getByLabelText(/^password$/i), "wrongpassword");
        await user.click(screen.getByRole("button", { name: /sign in/i }));
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("Invalid credentials");
        });
    });
    it("disables the submit button while submitting", async () => {
        const user = userEvent.setup();
        let resolveLogin;
        const login = vi.fn().mockReturnValue(new Promise((resolve) => {
            resolveLogin = resolve;
        }));
        setup(login);
        await user.type(screen.getByLabelText(/email/i), "john@example.com");
        await user.type(screen.getByLabelText(/^password$/i), "password123");
        await user.click(screen.getByRole("button", { name: /sign in/i }));
        expect(await screen.findByRole("button", { name: /signing in/i })).toBeDisabled();
        resolveLogin();
    });
});
