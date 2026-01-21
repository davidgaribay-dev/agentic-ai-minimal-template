import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Index route for /org/settings - redirects to default section.
 * This is the idiomatic TanStack Router pattern for default child routes.
 */
export const Route = createFileRoute("/org/settings/")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated && !context.auth.isLoading) {
      throw redirect({ to: "/login" });
    }
    // Redirect to default section
    throw redirect({
      to: "/org/settings/$section",
      params: { section: "general" },
    });
  },
});
