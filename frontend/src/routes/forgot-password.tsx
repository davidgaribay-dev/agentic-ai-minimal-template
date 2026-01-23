import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { testId } from "@/lib/test-id";
import { authApi } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: "/chat" });
    }
  },
});

function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const recoverPassword = useMutation({
    mutationFn: (email: string) => authApi.recoverPassword(email),
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    recoverPassword.mutate(email);
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-[400px] text-center">
          <h1 className="mb-4 text-2xl font-semibold tracking-tight">
            {t("auth_forgot_password_title")}
          </h1>
          <p className="mb-8 text-sm text-muted-foreground">
            {t("auth_reset_link_sent")}
          </p>
          <Link
            to="/login"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("auth_back_to_login")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-[400px]">
        <h1 className="mb-2 text-center text-2xl font-semibold tracking-tight">
          {t("auth_forgot_password_title")}
        </h1>
        <p className="mb-8 text-center text-sm text-muted-foreground">
          {t("auth_forgot_password_description")}
        </p>

        <form
          {...testId("forgot-password-form")}
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          {recoverPassword.error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {recoverPassword.error.message}
            </div>
          )}

          <Input
            {...testId("forgot-password-email-input")}
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
            {...testId("forgot-password-submit-button")}
            type="submit"
            variant="outline"
            disabled={recoverPassword.isPending || !email}
            className="h-12 w-full rounded-sm border-input bg-background px-4 text-base font-medium hover:bg-muted"
          >
            {recoverPassword.isPending
              ? t("auth_sending")
              : t("auth_send_reset_link")}
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
