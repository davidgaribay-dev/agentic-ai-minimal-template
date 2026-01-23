import {
  createFileRoute,
  Link,
  useNavigate,
  redirect,
} from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Upload, X as XIcon } from "lucide-react";
import { testId } from "@/lib/test-id";
import { authKeys, useLogin } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VerificationCodeInput } from "@/components/ui/verification-code-input";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: "/chat" });
    }
  },
});

type Step =
  | "email"
  | "password"
  | "name"
  | "workspace"
  | "team"
  | "verification";

const MAX_LOGO_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const API_URL = import.meta.env.VITE_API_URL || "";

function SignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const login = useLogin();
  const [step, setStep] = useState<Step>("email");

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceLogo, setWorkspaceLogo] = useState<File | null>(null);
  const [workspaceLogoPreview, setWorkspaceLogoPreview] = useState<
    string | null
  >(null);
  const workspaceFileInputRef = useRef<HTMLInputElement>(null);
  const [teamName, setTeamName] = useState("");
  const [teamLogo, setTeamLogo] = useState<File | null>(null);
  const [teamLogoPreview, setTeamLogoPreview] = useState<string | null>(null);
  const teamFileInputRef = useRef<HTMLInputElement>(null);

  // Verification
  const [verificationCode, setVerificationCode] = useState("");
  const [canResendAt, setCanResendAt] = useState<Date | null>(null);
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  const [localError, setLocalError] = useState<string | null>(null);

  // Track Object URLs for cleanup on unmount
  const workspaceLogoPreviewRef = useRef<string | null>(null);
  const teamLogoPreviewRef = useRef<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    workspaceLogoPreviewRef.current = workspaceLogoPreview;
  }, [workspaceLogoPreview]);

  useEffect(() => {
    teamLogoPreviewRef.current = teamLogoPreview;
  }, [teamLogoPreview]);

  // Cleanup Object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (workspaceLogoPreviewRef.current)
        URL.revokeObjectURL(workspaceLogoPreviewRef.current);
      if (teamLogoPreviewRef.current)
        URL.revokeObjectURL(teamLogoPreviewRef.current);
    };
  }, []);

  // Register mutation (without auto-login)
  const register = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`${API_URL}/v1/auth/signup`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ detail: t("error_request_failed") }));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      return response.json();
    },
  });

  // Verify email mutation
  const verifyEmail = useMutation({
    mutationFn: async ({ email, code }: { email: string; code: string }) => {
      return authApi.verifyEmail({ email, code });
    },
  });

  // Resend verification mutation
  const resendVerification = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      return authApi.resendVerification({ email });
    },
    onSuccess: (data) => {
      if (data.can_resend_at) {
        setCanResendAt(new Date(data.can_resend_at));
      }
    },
  });

  // Update signup email mutation
  const updateSignupEmail = useMutation({
    mutationFn: async ({
      currentEmail,
      newEmail,
    }: {
      currentEmail: string;
      newEmail: string;
    }) => {
      return authApi.updateSignupEmail({
        current_email: currentEmail,
        new_email: newEmail,
      });
    },
    onSuccess: (data, variables) => {
      if (data.verification_sent) {
        // Update the email state and hide the change form
        setEmail(variables.newEmail);
        setShowChangeEmail(false);
        setNewEmail("");
        setVerificationCode("");
      }
    },
  });

  const handleWorkspaceLogoChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_LOGO_SIZE_BYTES) {
        setLocalError(t("settings_image_too_large"));
        return;
      }
      if (!file.type.startsWith("image/")) {
        setLocalError(t("settings_select_image"));
        return;
      }
      setWorkspaceLogo(file);
      setWorkspaceLogoPreview(URL.createObjectURL(file));
      setLocalError(null);
    }
  };

  const handleTeamLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_LOGO_SIZE_BYTES) {
        setLocalError(t("settings_image_too_large"));
        return;
      }
      if (!file.type.startsWith("image/")) {
        setLocalError(t("settings_select_image"));
        return;
      }
      setTeamLogo(file);
      setTeamLogoPreview(URL.createObjectURL(file));
      setLocalError(null);
    }
  };

  const removeWorkspaceLogo = () => {
    setWorkspaceLogo(null);
    if (workspaceLogoPreview) {
      URL.revokeObjectURL(workspaceLogoPreview);
      setWorkspaceLogoPreview(null);
    }
    if (workspaceFileInputRef.current) {
      workspaceFileInputRef.current.value = "";
    }
  };

  const removeTeamLogo = () => {
    setTeamLogo(null);
    if (teamLogoPreview) {
      URL.revokeObjectURL(teamLogoPreview);
      setTeamLogoPreview(null);
    }
    if (teamFileInputRef.current) {
      teamFileInputRef.current.value = "";
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email) {
      setLocalError(t("auth_email_required"));
      return;
    }

    setStep("password");
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (password.length < 8) {
      setLocalError(t("auth_password_min_length"));
      return;
    }

    setStep("name");
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setStep("workspace");
  };

  const handleWorkspaceSubmit = async (e: React.FormEvent) => {
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
      if (fullName) {
        formData.append("full_name", fullName);
      }
      formData.append("organization_name", workspaceName);
      if (workspaceLogo) {
        formData.append("organization_logo", workspaceLogo);
      }
      if (teamName) {
        formData.append("team_name", teamName);
      }
      if (teamLogo) {
        formData.append("team_logo", teamLogo);
      }

      await register.mutateAsync(formData);
      // Registration successful, move to verification step
      // (Backend has already sent verification code)
      setStep("verification");
    } catch (error) {
      // Mutation handles UI error display
      console.error("Registration failed:", error);
    }
  };

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (verificationCode.length !== 6) {
      setLocalError(t("auth_verification_code_required"));
      return;
    }

    try {
      await verifyEmail.mutateAsync({ email, code: verificationCode });
      // Verification successful, now login
      await login.mutateAsync({ email, password });
      await queryClient.refetchQueries({ queryKey: authKeys.user });
      navigate({ to: "/chat" });
    } catch (error) {
      console.error("Verification failed:", error);
    }
  };

  const handleResendCode = async () => {
    setLocalError(null);
    try {
      await resendVerification.mutateAsync({ email });
    } catch (error) {
      console.error("Resend failed:", error);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!newEmail || newEmail === email) {
      setLocalError(t("auth_enter_different_email"));
      return;
    }

    try {
      await updateSignupEmail.mutateAsync({ currentEmail: email, newEmail });
    } catch (error) {
      console.error("Email update failed:", error);
    }
  };

  const canResend =
    !resendVerification.isPending &&
    (!canResendAt || new Date() >= canResendAt);

  const error =
    localError ||
    register.error?.message ||
    verifyEmail.error?.message ||
    resendVerification.error?.message ||
    updateSignupEmail.error?.message ||
    login.error?.message;

  const isSubmitting =
    register.isPending ||
    verifyEmail.isPending ||
    updateSignupEmail.isPending ||
    login.isPending;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-[400px]">
        {/* Title */}
        <h1 className="mb-2 text-center text-2xl font-semibold tracking-tight">
          {step === "email" && t("auth_email_step_title")}
          {step === "password" && t("auth_password_step_title")}
          {step === "name" && t("auth_name_step_title")}
          {step === "workspace" && t("auth_workspace_step_title")}
          {step === "team" && t("auth_team_step_title")}
          {step === "verification" && t("auth_verification_step_title")}
        </h1>
        {step === "email" && (
          <p className="mb-8 text-center text-sm text-muted-foreground">
            {t("auth_get_started_free")}
          </p>
        )}
        {step === "verification" && (
          <p className="mb-8 text-center text-sm text-muted-foreground">
            {t("auth_verification_sent_to", { email })}
          </p>
        )}
        {step !== "email" && step !== "verification" && (
          <div className="mb-8" />
        )}

        {error && (
          <div
            {...testId("signup-error")}
            className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        {/* Step 1: Email */}
        {step === "email" && (
          <form
            {...testId("signup-form-email")}
            onSubmit={handleEmailSubmit}
            className="space-y-4"
          >
            <Input
              {...testId("signup-email-input")}
              id="email"
              type="email"
              placeholder={t("auth_email_placeholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              className="h-12 rounded-sm border-input bg-background px-4 text-base placeholder:text-muted-foreground/60"
            />

            <Button
              {...testId("signup-continue-button")}
              type="submit"
              variant="outline"
              className="h-12 w-full rounded-sm border-input bg-background px-4 text-base font-medium hover:bg-muted"
            >
              {t("auth_continue_email")}
            </Button>

            <p className="pt-2 text-center text-sm text-muted-foreground">
              <Link
                {...testId("back-to-login-link")}
                to="/login"
                className="transition-colors hover:text-foreground"
              >
                {t("auth_back_to_login")}
              </Link>
            </p>
          </form>
        )}

        {/* Step 2: Password */}
        {step === "password" && (
          <form
            {...testId("signup-form-password")}
            onSubmit={handlePasswordSubmit}
            className="space-y-4"
          >
            <p className="text-center text-sm text-muted-foreground">{email}</p>
            <Input
              {...testId("signup-password-input")}
              id="password"
              type="password"
              placeholder={t("auth_password_create_placeholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
              autoFocus
              className="h-12 rounded-sm border-input bg-background px-4 text-base placeholder:text-muted-foreground/60"
            />

            <Button
              {...testId("signup-password-submit")}
              type="submit"
              variant="outline"
              className="h-12 w-full rounded-sm border-input bg-background px-4 text-base font-medium hover:bg-muted"
            >
              {t("com_continue")}
            </Button>

            <p className="pt-2 text-center text-sm text-muted-foreground">
              <Button
                type="button"
                variant="link"
                onClick={() => setStep("email")}
                className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground"
              >
                {t("com_back")}
              </Button>
            </p>
          </form>
        )}

        {/* Step 3: Name */}
        {step === "name" && (
          <form
            {...testId("signup-form-name")}
            onSubmit={handleNameSubmit}
            className="space-y-4"
          >
            <Input
              {...testId("signup-name-input")}
              id="fullName"
              type="text"
              placeholder={t("auth_full_name_optional")}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              autoFocus
              className="h-12 rounded-sm border-input bg-background px-4 text-base placeholder:text-muted-foreground/60"
            />

            <Button
              {...testId("signup-name-submit")}
              type="submit"
              variant="outline"
              className="h-12 w-full rounded-sm border-input bg-background px-4 text-base font-medium hover:bg-muted"
            >
              {t("com_continue")}
            </Button>

            <p className="pt-2 text-center text-sm text-muted-foreground">
              <Button
                {...testId("signup-name-back")}
                type="button"
                variant="link"
                onClick={() => setStep("password")}
                className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground"
              >
                {t("com_back")}
              </Button>
            </p>
          </form>
        )}

        {/* Step 4: Workspace */}
        {step === "workspace" && (
          <form
            {...testId("signup-form-workspace")}
            onSubmit={handleWorkspaceSubmit}
            className="space-y-4"
          >
            <Input
              {...testId("signup-workspace-input")}
              id="workspaceName"
              type="text"
              placeholder={t("auth_workspace_name")}
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              required
              autoFocus
              className="h-12 rounded-sm border-input bg-background px-4 text-base placeholder:text-muted-foreground/60"
            />

            <div className="flex items-center gap-4">
              <input
                {...testId("signup-workspace-logo-upload")}
                ref={workspaceFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleWorkspaceLogoChange}
                className="hidden"
              />
              {workspaceLogoPreview ? (
                <div className="relative inline-block">
                  <img
                    src={workspaceLogoPreview}
                    alt={t("auth_workspace_logo_preview")}
                    className="h-14 w-14 rounded-lg object-cover border border-border"
                  />
                  <Button
                    {...testId("signup-workspace-logo-remove")}
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={removeWorkspaceLogo}
                    aria-label={t("com_remove")}
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full"
                  >
                    <XIcon className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => workspaceFileInputRef.current?.click()}
                  className="h-14 w-14 rounded-lg border-2 border-dashed border-border hover:border-foreground/30 hover:bg-muted/30"
                >
                  <Upload className="h-5 w-5 text-muted-foreground" />
                </Button>
              )}
              <span className="text-sm text-muted-foreground">
                {t("com_logo_optional")}
              </span>
            </div>

            <Button
              {...testId("signup-workspace-submit")}
              type="submit"
              variant="outline"
              className="h-12 w-full rounded-sm border-input bg-background px-4 text-base font-medium hover:bg-muted"
            >
              {t("com_continue")}
            </Button>

            <p className="pt-2 text-center text-sm text-muted-foreground">
              <Button
                {...testId("signup-workspace-back")}
                type="button"
                variant="link"
                onClick={() => setStep("name")}
                className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground"
              >
                {t("com_back")}
              </Button>
            </p>
          </form>
        )}

        {/* Step 5: Team */}
        {step === "team" && (
          <form
            {...testId("signup-form-team")}
            onSubmit={handleTeamSubmit}
            className="space-y-4"
          >
            <div>
              <Input
                {...testId("signup-team-input")}
                id="teamName"
                type="text"
                placeholder={t("auth_team_name")}
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                autoFocus
                className="h-12 rounded-sm border-input bg-background px-4 text-base placeholder:text-muted-foreground/60"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {t("auth_team_name_default")}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <input
                {...testId("signup-team-logo-upload")}
                ref={teamFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleTeamLogoChange}
                className="hidden"
              />
              {teamLogoPreview ? (
                <div className="relative inline-block">
                  <img
                    src={teamLogoPreview}
                    alt={t("auth_team_logo_preview")}
                    className="h-14 w-14 rounded-lg object-cover border border-border"
                  />
                  <Button
                    {...testId("signup-team-logo-remove")}
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={removeTeamLogo}
                    aria-label={t("com_remove")}
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full"
                  >
                    <XIcon className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => teamFileInputRef.current?.click()}
                  className="h-14 w-14 rounded-lg border-2 border-dashed border-border hover:border-foreground/30 hover:bg-muted/30"
                >
                  <Upload className="h-5 w-5 text-muted-foreground" />
                </Button>
              )}
              <span className="text-sm text-muted-foreground">
                {t("com_logo_optional")}
              </span>
            </div>

            <Button
              {...testId("signup-submit-button")}
              type="submit"
              variant="outline"
              disabled={register.isPending}
              className="h-12 w-full rounded-sm border-input bg-background px-4 text-base font-medium hover:bg-muted"
            >
              {register.isPending
                ? t("auth_creating")
                : t("auth_create_workspace")}
            </Button>

            <p className="pt-2 text-center text-sm text-muted-foreground">
              <Button
                type="button"
                variant="link"
                onClick={() => setStep("workspace")}
                disabled={register.isPending}
                className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground"
              >
                {t("com_back")}
              </Button>
            </p>
          </form>
        )}

        {/* Step 6: Verification */}
        {step === "verification" && !showChangeEmail && (
          <form
            {...testId("signup-form-verification")}
            onSubmit={handleVerificationSubmit}
            className="space-y-6"
          >
            <VerificationCodeInput
              value={verificationCode}
              onChange={setVerificationCode}
              length={6}
              disabled={isSubmitting}
              autoFocus
              aria-invalid={!!error}
            />

            <Button
              {...testId("signup-verify-button")}
              type="submit"
              variant="outline"
              disabled={isSubmitting || verificationCode.length !== 6}
              className="h-12 w-full rounded-sm border-input bg-background px-4 text-base font-medium hover:bg-muted"
            >
              {isSubmitting ? t("auth_verifying") : t("auth_verify_email")}
            </Button>

            <div className="space-y-2 pt-2 text-center text-sm text-muted-foreground">
              <p>
                {t("auth_didnt_receive_code")}{" "}
                <Button
                  type="button"
                  variant="link"
                  onClick={handleResendCode}
                  disabled={!canResend}
                  className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground"
                >
                  {resendVerification.isPending
                    ? t("auth_sending")
                    : t("auth_resend_code")}
                </Button>
              </p>
              <p>
                {t("auth_wrong_email")}{" "}
                <Button
                  type="button"
                  variant="link"
                  onClick={() => {
                    setShowChangeEmail(true);
                    setNewEmail("");
                    setLocalError(null);
                  }}
                  className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground"
                >
                  {t("auth_change_email")}
                </Button>
              </p>
            </div>
          </form>
        )}

        {/* Change Email Form */}
        {step === "verification" && showChangeEmail && (
          <form
            {...testId("signup-form-change-email")}
            onSubmit={handleChangeEmail}
            className="space-y-4"
          >
            <p className="text-center text-sm text-muted-foreground">
              {t("auth_change_email_description")}
            </p>
            <Input
              {...testId("signup-new-email-input")}
              type="email"
              placeholder={t("auth_new_email_placeholder")}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              className="h-12 rounded-sm border-input bg-background px-4 text-base placeholder:text-muted-foreground/60"
            />

            <Button
              {...testId("signup-change-email-button")}
              type="submit"
              variant="outline"
              disabled={updateSignupEmail.isPending || !newEmail}
              className="h-12 w-full rounded-sm border-input bg-background px-4 text-base font-medium hover:bg-muted"
            >
              {updateSignupEmail.isPending
                ? t("auth_updating")
                : t("auth_update_email")}
            </Button>

            <p className="pt-2 text-center text-sm text-muted-foreground">
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  setShowChangeEmail(false);
                  setLocalError(null);
                }}
                disabled={updateSignupEmail.isPending}
                className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground"
              >
                {t("com_cancel")}
              </Button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
