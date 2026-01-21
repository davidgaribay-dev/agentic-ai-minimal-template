import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

/**
 * Layout route for /org/team/:teamId/settings.
 * The index route ($teamId.settings.index.tsx) handles redirecting to the default section.
 */
export const Route = createFileRoute("/org/team/$teamId/settings")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated && !context.auth.isLoading) {
      throw redirect({ to: "/login" });
    }
  },
  component: TeamSettingsLayout,
});

/** Layout component that renders child routes */
function TeamSettingsLayout() {
  return <Outlet />;
}
