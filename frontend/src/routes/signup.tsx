import {
  createFileRoute,
  Link,
  useNavigate,
  redirect,
} from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Sparkles, Upload, X as XIcon, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { testId } from "@/lib/test-id";
import { useRegister, authKeys } from "@/lib/auth";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: "/chat" });
    }
  },
});

type Step = "email" | "password" | "name" | "workspace" | "team";

const MAX_LOGO_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function SignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const register = useRegister();
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
      await queryClient.refetchQueries({ queryKey: authKeys.user });
      navigate({ to: "/chat" });
    } catch (error) {
      // Mutation handles UI error display
      console.error("Registration failed:", error);
    }
  };

  const error = localError || register.error?.message;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <div className="relative w-full max-w-[360px]">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            {step === "email" && t("auth_sign_up_title")}
            {step === "password" && t("auth_password_step_title")}
            {step === "name" && t("auth_name_step_title")}
            {step === "workspace" && t("auth_workspace_step_title")}
            {step === "team" && t("auth_team_step_title")}
          </h1>
          {step === "email" && (
            <p className="mt-1 text-sm text-muted-foreground">
              {t("auth_get_started_free")}
            </p>
          )}
        </div>

        {error && (
          <div
            {...testId("signup-error")}
            className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        {/* Step 1: Email */}
        {step === "email" && (
          <form {...testId("signup-form-email")} onSubmit={handleEmailSubmit} className="space-y-4">
            <Input
              {...testId("signup-email-input")}
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              className="h-11 rounded-md bg-background border-input px-3 text-sm"
            />

            <Button
              {...testId("signup-continue-button")}
              type="submit"
              className="h-11 w-full rounded-md text-sm font-medium"
            >
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              {t("auth_have_account")}{" "}
              <Link
                to="/login"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                {t("auth_sign_in")}
              </Link>
            </p>
          </form>
        )}

        {/* Step 2: Password */}
        {step === "password" && (
          <form {...testId("signup-form-password")} onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="mb-4 text-sm text-muted-foreground">{email}</div>
            <Input
              {...testId("signup-password-input")}
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
              autoFocus
              className="h-11 rounded-md bg-background border-input px-3 text-sm"
            />

            <Button
              type="submit"
              className="h-11 w-full rounded-md text-sm font-medium"
            >
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => setStep("email")}
              className="w-full text-xs text-muted-foreground hover:text-foreground"
            >
              {t("com_back")}
            </Button>
          </form>
        )}

        {/* Step 3: Name */}
        {step === "name" && (
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              autoFocus
              className="h-11 rounded-md bg-background border-input px-3 text-sm"
            />

            <Button
              type="submit"
              className="h-11 w-full rounded-md text-sm font-medium"
            >
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => setStep("password")}
              className="w-full text-xs text-muted-foreground hover:text-foreground"
            >
              {t("com_back")}
            </Button>
          </form>
        )}

        {/* Step 4: Workspace */}
        {step === "workspace" && (
          <form onSubmit={handleWorkspaceSubmit} className="space-y-4">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="workspaceName"
                  className="mb-2 block text-xs font-medium text-muted-foreground"
                >
                  {t("auth_workspace_name")}
                </label>
                <Input
                  id="workspaceName"
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  required
                  autoFocus
                  className="h-11 rounded-md bg-background border-input px-3 text-sm"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                  {t("com_logo_optional")}
                </label>
                <input
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
                      alt="Workspace logo preview"
                      className="h-16 w-16 rounded-lg object-cover border border-border"
                    />
                    <button
                      type="button"
                      onClick={removeWorkspaceLogo}
                      aria-label={t("com_remove")}
                      className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => workspaceFileInputRef.current?.click()}
                    className="h-16 w-16 rounded-lg border-2 border-dashed hover:border-primary/50 hover:bg-primary/5"
                  >
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </div>

            <Button
              type="submit"
              className="h-11 w-full rounded-md text-sm font-medium"
            >
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => setStep("name")}
              className="w-full text-xs text-muted-foreground hover:text-foreground"
            >
              {t("com_back")}
            </Button>
          </form>
        )}

        {/* Step 5: Team */}
        {step === "team" && (
          <form {...testId("signup-form-team")} onSubmit={handleTeamSubmit} className="space-y-4">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="teamName"
                  className="mb-2 block text-xs font-medium text-muted-foreground"
                >
                  {t("auth_team_name")}
                </label>
                <Input
                  id="teamName"
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  autoFocus
                  className="h-11 rounded-md bg-background border-input px-3 text-sm"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {t("auth_team_name_default")}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                  {t("com_logo_optional")}
                </label>
                <input
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
                      alt="Team logo preview"
                      className="h-16 w-16 rounded-lg object-cover border border-border"
                    />
                    <button
                      type="button"
                      onClick={removeTeamLogo}
                      aria-label={t("com_remove")}
                      className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => teamFileInputRef.current?.click()}
                    className="h-16 w-16 rounded-lg border-2 border-dashed hover:border-primary/50 hover:bg-primary/5"
                  >
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </div>

            <Button
              {...testId("signup-submit-button")}
              type="submit"
              disabled={register.isPending}
              className="h-11 w-full rounded-md text-sm font-medium"
            >
              {register.isPending ? (
                t("auth_creating")
              ) : (
                <>
                  {t("auth_create_workspace")}{" "}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => setStep("workspace")}
              disabled={register.isPending}
              className="w-full text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {t("com_back")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
