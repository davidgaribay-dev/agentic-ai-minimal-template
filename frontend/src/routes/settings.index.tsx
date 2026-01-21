import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Index route for /settings - redirects to default section.
 * This is the idiomatic TanStack Router pattern for default child routes.
 */
export const Route = createFileRoute("/settings/")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated && !context.auth.isLoading) {
      throw redirect({ to: "/login" });
    }
    // Redirect to default section (profile)
    throw redirect({
      to: "/settings/$section",
      params: { section: "profile" },
    });
  },
});
