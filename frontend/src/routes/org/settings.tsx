import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

/**
 * Layout route for /org/settings.
 * The index route (settings.index.tsx) handles redirecting to the default section.
 */
export const Route = createFileRoute("/org/settings")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated && !context.auth.isLoading) {
      throw redirect({ to: "/login" });
    }
  },
  component: OrgSettingsLayout,
});

/** Layout component that renders child routes */
function OrgSettingsLayout() {
  return <Outlet />;
}
