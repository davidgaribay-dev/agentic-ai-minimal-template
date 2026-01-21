import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";

/**
 * Layout route for /settings (user settings).
 * The index route (settings.index.tsx) handles redirecting to the default section.
 */
export const Route = createFileRoute("/settings")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated && !context.auth.isLoading) {
      throw redirect({ to: "/login" });
    }
  },
  component: UserSettingsLayout,
});

/** Layout component that renders child routes */
function UserSettingsLayout() {
  return <Outlet />;
}
