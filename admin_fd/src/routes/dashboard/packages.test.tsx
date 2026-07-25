import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PackagesPage } from "./packages";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  },
  BASE: "http://localhost:3000",
}));

const SAMPLE_PACKAGE = {
  package_id: 1,
  name: "Full Engine Service",
  package_code: "DWP-001",
  description: "Oil change\nBrake inspection",
  estimated_duration: 90,
  price: "7500.00",
  image_url: null,
  max_capacity: 3,
  is_active: true,
  is_featured: false,
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("PackagesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ packages: [SAMPLE_PACKAGE] });
  });

  it("renders the list of packages from the API", async () => {
    render(<PackagesPage />);

    expect(await screen.findByText("Full Engine Service")).toBeInTheDocument();
    expect(screen.getByText("7,500")).toBeInTheDocument();
    expect(screen.getByText("1h 30min")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/api/packages");
  });

  it("shows validation errors when submitting the create form empty", async () => {
    const user = userEvent.setup();
    render(<PackagesPage />);
    await screen.findByText("Full Engine Service");

    await user.click(screen.getByRole("button", { name: /add package/i }));
    await user.click(screen.getByRole("button", { name: /create package/i }));

    expect(await screen.findByText("Package code is required")).toBeInTheDocument();
    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Description is required")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("creates a new package with the correct payload", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValue({
      package: { ...SAMPLE_PACKAGE, package_id: 2, name: "Wheel Alignment" },
    });

    render(<PackagesPage />);
    await screen.findByText("Full Engine Service");

    await user.click(screen.getByRole("button", { name: /add package/i }));

    await user.type(screen.getByPlaceholderText("e.g. Full Engine Service"), "Wheel Alignment");
    await user.type(screen.getByPlaceholderText("e.g. 001"), "002");
    await user.type(
      screen.getByPlaceholderText(/Oil change & filter replacement/),
      "Front & rear alignment check",
    );
    await user.type(screen.getByPlaceholderText("e.g. 90"), "45");
    await user.type(screen.getByPlaceholderText("e.g. 7500"), "3000");

    await user.click(screen.getByRole("button", { name: /create package/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/api/packages", {
        name: "Wheel Alignment",
        package_code: "DWP-002",
        description: "Front & rear alignment check",
        estimated_duration: 45,
        price: 3000,
        max_capacity: 3,
      });
    });

    // Form closes and the list reloads after a successful save.
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByRole("button", { name: /create package/i })).not.toBeInTheDocument();
  });

  it("deactivates a package after confirming the alert dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(api.patch).mockResolvedValue({});

    render(<PackagesPage />);
    await screen.findByText("Full Engine Service");

    await user.click(screen.getByTitle("Deactivate"));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/will be hidden from customers/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Deactivate" }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/api/packages/1/deactivate");
    });
    expect(await screen.findByText("Inactive")).toBeInTheDocument();
  });
});
