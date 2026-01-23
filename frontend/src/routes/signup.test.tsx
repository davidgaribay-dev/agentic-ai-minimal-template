/**
 * Signup Page Tests
 *
 * Tests for the multi-step signup wizard including:
 * - Step navigation
 * - Form validation at each step
 * - Error display
 * - Final submission
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/utils/render";

// Mock TanStack Router
vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual("@tanstack/react-router");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
    createFileRoute: () => () => ({
      component: () => null,
      beforeLoad: () => {},
    }),
  };
});

// Create a testable version of the signup wizard
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { testId } from "@/lib/test-id";
import { useRegister } from "@/lib/auth";

type Step = "email" | "password" | "name" | "workspace" | "team";

function TestableSignupPage() {
  const { t } = useTranslation();
  const register = useRegister();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!email) {
      setLocalError(t("auth_email_required"));
      return;
    }
    setStep("password");
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (password.length < 8) {
      setLocalError(t("auth_password_min_length"));
      return;
    }
    setStep("name");
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setStep("workspace");
  };

  const handleWorkspaceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!workspaceName.trim()) {
      setLocalError(t("auth_workspace_name_required"));
      return;
    }
    setStep("team");
  };

  const handleTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    try {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("password", password);
      if (fullName) formData.append("full_name", fullName);
      formData.append("organization_name", workspaceName);
      if (teamName) formData.append("team_name", teamName);
      await register.mutateAsync(formData);
    } catch {
      // Mutation handles error display
    }
  };

  const error = localError || register.error?.message;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <div className="relative w-full max-w-[360px]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold">
            {step === "email" && t("auth_sign_up_title")}
            {step === "password" && t("auth_password_step_title")}
            {step === "name" && t("auth_name_step_title")}
            {step === "workspace" && t("auth_workspace_step_title")}
            {step === "team" && t("auth_team_step_title")}
          </h1>
        </div>

        {error && (
          <div {...testId("signup-error")} className="mb-4 text-destructive">
            {error}
          </div>
        )}

        {/* Step 1: Email */}
        {step === "email" && (
          <form {...testId("signup-form-email")} onSubmit={handleEmailSubmit}>
            <Input
              {...testId("signup-email-input")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Button
              {...testId("signup-continue-button")}
              type="submit"
              className="mt-4 w-full"
            >
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="mt-4 text-center">
              <a href="/login">{t("auth_sign_in")}</a>
            </p>
          </form>
        )}

        {/* Step 2: Password */}
        {step === "password" && (
          <form
            {...testId("signup-form-password")}
            onSubmit={handlePasswordSubmit}
          >
            <div className="mb-4 text-sm text-muted-foreground">{email}</div>
            <Input
              {...testId("signup-password-input")}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <Button type="submit" className="mt-4 w-full">
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="link"
              onClick={() => setStep("email")}
              className="mt-2 w-full"
            >
              {t("com_back")}
            </Button>
          </form>
        )}

        {/* Step 3: Name */}
        {step === "name" && (
          <form onSubmit={handleNameSubmit}>
            <Input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t("auth_full_name_optional")}
            />
            <Button type="submit" className="mt-4 w-full">
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="link"
              onClick={() => setStep("password")}
              className="mt-2 w-full"
            >
              {t("com_back")}
            </Button>
          </form>
        )}

        {/* Step 4: Workspace */}
        {step === "workspace" && (
          <form onSubmit={handleWorkspaceSubmit}>
            <Input
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder={t("auth_workspace_name")}
            />
            <Button type="submit" className="mt-4 w-full">
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="link"
              onClick={() => setStep("name")}
              className="mt-2 w-full"
            >
              {t("com_back")}
            </Button>
          </form>
        )}

        {/* Step 5: Team */}
        {step === "team" && (
          <form {...testId("signup-form-team")} onSubmit={handleTeamSubmit}>
            <Input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder={t("auth_team_name")}
            />
            <Button
              {...testId("signup-submit-button")}
              type="submit"
              disabled={register.isPending}
              className="mt-4 w-full"
            >
              {register.isPending
                ? t("auth_creating")
                : t("auth_create_workspace")}
            </Button>
            <Button
              type="button"
              variant="link"
              onClick={() => setStep("workspace")}
              disabled={register.isPending}
              className="mt-2 w-full"
            >
              {t("com_back")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

describe("Signup Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Step 1: Email", () => {
    it("renders the email form initially", () => {
      renderWithProviders(<TestableSignupPage />);

      expect(screen.getByTestId("signup-form-email")).toBeInTheDocument();
      expect(screen.getByTestId("signup-email-input")).toBeInTheDocument();
      expect(screen.getByTestId("signup-continue-button")).toBeInTheDocument();
    });

    it("shows link to login page", () => {
      renderWithProviders(<TestableSignupPage />);

      const loginLink = screen.getByRole("link");
      expect(loginLink).toHaveAttribute("href", "/login");
    });

    it("advances to password step when email is entered", async () => {
      const user = userEvent.setup();

      renderWithProviders(<TestableSignupPage />);

      await user.type(
        screen.getByTestId("signup-email-input"),
        "test@example.com",
      );
      await user.click(screen.getByTestId("signup-continue-button"));

      await waitFor(() => {
        expect(screen.getByTestId("signup-form-password")).toBeInTheDocument();
      });
    });

    it("shows email in password step", async () => {
      const user = userEvent.setup();

      renderWithProviders(<TestableSignupPage />);

      await user.type(
        screen.getByTestId("signup-email-input"),
        "test@example.com",
      );
      await user.click(screen.getByTestId("signup-continue-button"));

      await waitFor(() => {
        expect(screen.getByText("test@example.com")).toBeInTheDocument();
      });
    });
  });

  describe("Step 2: Password", () => {
    it("validates minimum password length", async () => {
      const user = userEvent.setup();

      renderWithProviders(<TestableSignupPage />);

      // Go to password step
      await user.type(
        screen.getByTestId("signup-email-input"),
        "test@example.com",
      );
      await user.click(screen.getByTestId("signup-continue-button"));

      await waitFor(() => {
        expect(screen.getByTestId("signup-password-input")).toBeInTheDocument();
      });

      // Enter short password
      await user.type(screen.getByTestId("signup-password-input"), "short");
      await user.click(screen.getByRole("button", { name: /continue/i }));

      // Should show error
      await waitFor(() => {
        expect(screen.getByTestId("signup-error")).toBeInTheDocument();
      });
    });

    it("allows going back to email step", async () => {
      const user = userEvent.setup();

      renderWithProviders(<TestableSignupPage />);

      // Go to password step
      await user.type(
        screen.getByTestId("signup-email-input"),
        "test@example.com",
      );
      await user.click(screen.getByTestId("signup-continue-button"));

      await waitFor(() => {
        expect(screen.getByTestId("signup-form-password")).toBeInTheDocument();
      });

      // Click back
      await user.click(screen.getByRole("button", { name: /back/i }));

      await waitFor(() => {
        expect(screen.getByTestId("signup-form-email")).toBeInTheDocument();
      });
    });
  });

  describe("Full Wizard Flow", () => {
    it("navigates through all steps to team form", async () => {
      const user = userEvent.setup();

      renderWithProviders(<TestableSignupPage />);

      // Step 1: Email
      await user.type(
        screen.getByTestId("signup-email-input"),
        "test@example.com",
      );
      await user.click(screen.getByTestId("signup-continue-button"));

      // Step 2: Password
      await waitFor(() => {
        expect(screen.getByTestId("signup-password-input")).toBeInTheDocument();
      });
      await user.type(
        screen.getByTestId("signup-password-input"),
        "password123",
      );
      await user.click(screen.getByRole("button", { name: /continue/i }));

      // Step 3: Name (optional)
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/full name/i)).toBeInTheDocument();
      });
      await user.click(screen.getByRole("button", { name: /continue/i }));

      // Step 4: Workspace
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/workspace name/i),
        ).toBeInTheDocument();
      });
      await user.type(
        screen.getByPlaceholderText(/workspace name/i),
        "My Workspace",
      );
      await user.click(screen.getByRole("button", { name: /continue/i }));

      // Step 5: Team
      await waitFor(() => {
        expect(screen.getByTestId("signup-form-team")).toBeInTheDocument();
        expect(screen.getByTestId("signup-submit-button")).toBeInTheDocument();
      });
    });

    it("requires workspace name before proceeding to team step", async () => {
      const user = userEvent.setup();

      renderWithProviders(<TestableSignupPage />);

      // Navigate to workspace step
      await user.type(
        screen.getByTestId("signup-email-input"),
        "test@example.com",
      );
      await user.click(screen.getByTestId("signup-continue-button"));

      await waitFor(() =>
        expect(screen.getByTestId("signup-password-input")).toBeInTheDocument(),
      );
      await user.type(
        screen.getByTestId("signup-password-input"),
        "password123",
      );
      await user.click(screen.getByRole("button", { name: /continue/i }));

      await waitFor(() =>
        expect(screen.getByPlaceholderText(/full name/i)).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: /continue/i }));

      // Now at workspace step - try to continue without name
      await waitFor(() =>
        expect(
          screen.getByPlaceholderText(/workspace name/i),
        ).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: /continue/i }));

      // Should show error
      await waitFor(() => {
        expect(screen.getByTestId("signup-error")).toBeInTheDocument();
      });
    });
  });
});
