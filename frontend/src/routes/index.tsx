import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    // Redirect unauthenticated users to signup
    if (!context.auth.isAuthenticated && !context.auth.isLoading) {
      throw redirect({ to: "/signup" });
    }

    // For authenticated users, redirect to their team chat
    // /chat handles both immediate redirect (if team in localStorage)
    // and waiting for workspace context to load (if no team yet)
    throw redirect({ to: "/chat" });
  },
});
