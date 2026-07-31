import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginPage } from "./login";
import { AuthProvider } from "@/hooks/useAuth";
import { api } from "@/lib/api";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  },
  SESSION_EXPIRED_EVENT: "auth:session-expired",
}));

function renderLoginPage() {
  return render(
    <AuthProvider>
      <LoginPage />
    </AuthProvider>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // AuthProvider checks the session on mount — simulate "not logged in" so
    // it settles without affecting the login form itself.
    vi.mocked(api.get).mockRejectedValue(new Error("not logged in"));
  });

  it("renders email and password fields", () => {
    renderLoginPage();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("blocks submit via native validation when fields are empty", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/email/i)).toBeInvalid();
  });

  it("submits credentials to the staff login endpoint and navigates on success", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValue({
      user: { id: 1, email: "manager@drivewell.com", role_id: 1 },
    });

    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), "manager@drivewell.com");
    await user.type(screen.getByLabelText("Password"), "hunter2");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/api/auth/staff/login", {
        email: "manager@drivewell.com",
        password: "hunter2",
      });
    });
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows an error and does not navigate on failed login", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValue(new Error("Invalid credentials"));

    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), "manager@drivewell.com");
    await user.type(screen.getByLabelText("Password"), "wrongpass");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials");
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
