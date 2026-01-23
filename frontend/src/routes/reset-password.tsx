import {
  createFileRoute,
  Link,
  useNavigate,
  redirect,
} from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { testId } from "@/lib/test-id";
import { authApi } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  validateSearch: searchSchema,
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: "/chat" });
    }
  },
});

function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = Route.useSearch();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resetPassword = useMutation({
    mutationFn: (data: { token: string; new_password: string }) =>
      authApi.resetPassword(data),
    onSuccess: () => {
      setSuccess(true);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!token) {
      setLocalError(t("auth_missing_token"));
      return;
    }

    if (newPassword.length < 8) {
      setLocalError(t("auth_password_min_length"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setLocalError(t("auth_passwords_no_match"));
      return;
    }

    resetPassword.mutate({ token, new_password: newPassword });
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-[400px] text-center">
          <h1 className="mb-4 text-2xl font-semibold tracking-tight">
            {t("auth_reset_password_title")}
          </h1>
          <p className="mb-8 text-sm text-muted-foreground">
            {t("auth_password_reset_success")}
          </p>
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/login" })}
            className="h-12 w-full rounded-sm border-input bg-background px-4 text-base font-medium hover:bg-muted"
          >
            {t("auth_sign_in")}
          </Button>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-[400px] text-center">
          <h1 className="mb-4 text-2xl font-semibold tracking-tight">
            {t("auth_reset_password_title")}
          </h1>
          <p className="mb-8 text-sm text-destructive">
            {t("auth_missing_token")}
          </p>
          <Link
            to="/forgot-password"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("auth_forgot_password")}
          </Link>
        </div>
      </div>
    );
  }

  const error = localError || resetPassword.error?.message;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-[400px]">
        <h1 className="mb-2 text-center text-2xl font-semibold tracking-tight">
          {t("auth_reset_password_title")}
        </h1>
        <p className="mb-8 text-center text-sm text-muted-foreground">
          {t("auth_reset_password_description")}
        </p>

        <form
          {...testId("reset-password-form")}
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Input
            {...testId("reset-password-new-input")}
            id="newPassword"
            type="password"
            placeholder={t("auth_new_password_placeholder")}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
            autoFocus
            className="h-12 rounded-sm border-input bg-background px-4 text-base placeholder:text-muted-foreground/60"
          />

          <Input
            {...testId("reset-password-confirm-input")}
            id="confirmPassword"
            type="password"
            placeholder={t("auth_confirm_password_placeholder")}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
            className="h-12 rounded-sm border-input bg-background px-4 text-base placeholder:text-muted-foreground/60"
          />

          <Button
            {...testId("reset-password-submit-button")}
            type="submit"
            variant="outline"
            disabled={
              resetPassword.isPending || !newPassword || !confirmPassword
            }
            className="h-12 w-full rounded-sm border-input bg-background px-4 text-base font-medium hover:bg-muted"
          >
            {resetPassword.isPending
              ? t("com_loading")
              : t("auth_reset_password")}
          </Button>

          <p className="pt-2 text-center text-sm text-muted-foreground">
            <Link
              to="/login"
              className="transition-colors hover:text-foreground"
            >
              {t("auth_back_to_login")}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
