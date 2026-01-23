import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useWorkspace } from "@/lib/workspace";
import { testId } from "@/lib/test-id";

export const Route = createFileRoute("/search")({
  beforeLoad: ({ context }) => {
    // Redirect unauthenticated users to login
    if (!context.auth.isAuthenticated && !context.auth.isLoading) {
      throw redirect({ to: "/login" });
    }

    // Get the last selected team from localStorage
    const teamId = localStorage.getItem("workspace_current_team_id");
    if (teamId) {
      throw redirect({ to: "/team/$teamId/search", params: { teamId } });
    }

    // If no team in localStorage, render component to wait for workspace context
  },
  component: SearchRedirect,
});

/**
 * Temporary component that waits for workspace to load,
 * then redirects to the team-based search route.
 */
function SearchRedirect() {
  const navigate = useNavigate();
  const { currentTeam, isLoadingTeams } = useWorkspace();

  useEffect(() => {
    if (!isLoadingTeams && currentTeam) {
      // Store in localStorage for future redirects
      localStorage.setItem("workspace_current_team_id", currentTeam.id);
      navigate({
        to: "/team/$teamId/search",
        params: { teamId: currentTeam.id },
      });
    }
  }, [currentTeam, isLoadingTeams, navigate]);

  // Show loading while waiting for workspace to initialize
  return (
    <div
      {...testId("search-page")}
      className="flex h-full items-center justify-center"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-foreground" />
    </div>
  );
}
