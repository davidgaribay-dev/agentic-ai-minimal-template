import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Index route for /org/team/:teamId/settings - redirects to default section.
 * This is the idiomatic TanStack Router pattern for default child routes.
 */
export const Route = createFileRoute("/org/team/$teamId/settings/")({
  beforeLoad: ({ context, params }) => {
    if (!context.auth.isAuthenticated && !context.auth.isLoading) {
      throw redirect({ to: "/login" });
    }
    // Redirect to default section
    throw redirect({
      to: "/org/team/$teamId/settings/$section",
      params: { teamId: params.teamId, section: "general" },
    });
  },
});
