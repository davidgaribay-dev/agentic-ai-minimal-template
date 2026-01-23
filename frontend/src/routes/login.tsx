import {
  createFileRoute,
  Link,
  useNavigate,
  redirect,
} from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { testId } from "@/lib/test-id";
import { useLogin, authQueryOptions, isLoggedIn } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  beforeLoad: ({ context }) => {
    // Check both router context AND localStorage token for immediate redirect
    if (context.auth.isAuthenticated || isLoggedIn()) {
      throw redirect({ to: "/chat" });
    }
  },
});

const authInputClassName =
  "h-12 rounded-sm border-input bg-background px-4 text-base placeholder:text-muted-foreground/60";

function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login.mutateAsync({ email, password });
      // Wait for the user query to fully resolve before navigating
      // This ensures the auth context is updated before route guards run
      await queryClient.fetchQuery(authQueryOptions.user);
      navigate({ to: "/chat" });
    } catch {
      // Mutation handles error display
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-[400px]">
        {/* Title */}
        <h1 className="mb-8 text-center text-2xl font-semibold tracking-tight">
          {t("auth_sign_in_title")}
        </h1>

        <form
          {...testId("login-form")}
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          {login.error && (
            <div
              {...testId("login-error")}
              className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {login.error.message}
            </div>
          )}

          <div className="space-y-4">
            <Input
              {...testId("login-email-input")}
              id="email"
              type="email"
              placeholder={t("auth_email_placeholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={authInputClassName}
            />
            <Input
              {...testId("login-password-input")}
              id="password"
              type="password"
              placeholder={t("auth_password_placeholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              minLength={8}
              className={authInputClassName}
            />
          </div>

          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("auth_forgot_password")}
            </Link>
          </div>

          <Button
            {...testId("login-submit-button")}
            type="submit"
            variant="outline"
            disabled={login.isPending}
            className="h-12 w-full rounded-sm border-input bg-background px-4 text-base font-medium hover:bg-muted"
          >
            {login.isPending ? t("auth_signing_in") : t("auth_continue_email")}
          </Button>

          <p className="pt-2 text-center text-sm text-muted-foreground">
            <Link
              {...testId("signup-link")}
              to="/signup"
              className="transition-colors hover:text-foreground"
            >
              {t("auth_back_to_signup")}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
