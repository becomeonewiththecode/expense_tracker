import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SessionExpiringBanner from "./SessionExpiringBanner.jsx";

// --- Module mocks ---
const mockNavigate = vi.fn();
const mockSetSession = vi.fn();
const mockLogout = vi.fn();
const mockApiPost = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../auth.jsx", () => ({
  useAuth: () => ({ setSession: mockSetSession, logout: mockLogout }),
}));

vi.mock("../api.js", () => ({
  default: { post: (...args) => mockApiPost(...args) },
}));

vi.mock("../apiError.js", () => ({
  getApiErrorMessage: (_err, fallback) => fallback,
}));

function renderBanner(open = true, onDismiss = vi.fn()) {
  return { onDismiss, ...render(<SessionExpiringBanner open={open} onDismiss={onDismiss} />) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Scenario 1 — Refresh succeeds: stay on page, dismiss banner
// ---------------------------------------------------------------------------
describe("Scenario 1: refresh succeeds", () => {
  it("calls setSession and onDismiss; does NOT navigate", async () => {
    const fakeUser = { id: 1, email: "a@b.com" };
    mockApiPost.mockResolvedValueOnce({ data: { user: fakeUser } });
    const { onDismiss } = renderBanner();

    fireEvent.click(screen.getByRole("button", { name: /stay signed in/i }));

    await waitFor(() => expect(mockSetSession).toHaveBeenCalledWith(fakeUser));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeInTheDocument(); // banner still mounted (parent controls open)
  });
});

// ---------------------------------------------------------------------------
// Scenario 2 — Core fix: refresh returns 401 → redirect to /login?expired=1
// ---------------------------------------------------------------------------
describe("Scenario 2: refresh returns 401 (session already expired)", () => {
  it("clears session and redirects to /login?expired=1", async () => {
    const err = new Error("Unauthorized");
    err.response = { status: 401, data: { error: "Session timed out due to inactivity" } };
    mockApiPost.mockRejectedValueOnce(err);
    renderBanner();

    fireEvent.click(screen.getByRole("button", { name: /stay signed in/i }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/login?expired=1", { replace: true })
    );
    expect(mockSetSession).toHaveBeenCalledWith(null);
    // No error text rendered in the banner
    expect(screen.queryByText(/could not refresh/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Scenario 3 — Non-401 refresh failure: show error, no redirect
// ---------------------------------------------------------------------------
describe("Scenario 3: refresh fails with non-401 (e.g. 500)", () => {
  it("displays error message and does NOT navigate", async () => {
    const err = new Error("Server error");
    err.response = { status: 500, data: { error: "Internal server error" } };
    mockApiPost.mockRejectedValueOnce(err);
    renderBanner();

    fireEvent.click(screen.getByRole("button", { name: /stay signed in/i }));

    await waitFor(() =>
      expect(screen.getByText(/could not refresh your session/i)).toBeInTheDocument()
    );
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockSetSession).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Scenario 4 — Sign out button: logout + navigate to /login
// ---------------------------------------------------------------------------
describe("Scenario 4: sign out button", () => {
  it("calls logout, onDismiss, and navigates to /login without expired param", () => {
    const { onDismiss } = renderBanner();

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    expect(mockLogout).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
    // Must NOT carry ?expired=1
    expect(mockNavigate).not.toHaveBeenCalledWith(
      expect.stringContaining("expired"),
      expect.anything()
    );
  });
});

// ---------------------------------------------------------------------------
// Scenario 5 — Banner hidden when open=false
// ---------------------------------------------------------------------------
describe("Scenario 5: banner not rendered when closed", () => {
  it("renders nothing when open is false", () => {
    const { container } = renderBanner(false);
    expect(container.firstChild).toBeNull();
  });
});
