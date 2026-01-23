import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { useWorkspace } from "@/lib/workspace";
import { testId } from "@/lib/test-id";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const chatSearchSchema = z.object({
  id: z.string().optional(),
});

export const Route = createFileRoute("/chat")({
  beforeLoad: ({ context }) => {
    // Redirect unauthenticated users to login
    if (!context.auth.isAuthenticated && !context.auth.isLoading) {
      throw redirect({ to: "/login" });
    }

    // Get the last selected team from localStorage
    const teamId = localStorage.getItem("workspace_current_team_id");
    if (teamId) {
      throw redirect({ to: "/team/$teamId/chat", params: { teamId } });
    }

    // If no team in localStorage, render component to wait for workspace context
  },
  component: ChatRedirect,
  validateSearch: chatSearchSchema,
});

/**
 * Temporary component that waits for workspace to load,
 * then redirects to the team-based chat route.
 */
function ChatRedirect() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentTeam, isLoadingTeams, orgsError, teamsError } = useWorkspace();

  useEffect(() => {
    if (!isLoadingTeams && currentTeam) {
      // Store in localStorage for future redirects
      localStorage.setItem("workspace_current_team_id", currentTeam.id);
      navigate({
        to: "/team/$teamId/chat",
        params: { teamId: currentTeam.id },
      });
    }
  }, [currentTeam, isLoadingTeams, navigate]);

  // Show error if workspace loading failed
  const error = orgsError || teamsError;
  if (error) {
    return (
      <div
        {...testId("chat-page")}
        className="flex h-full items-center justify-center p-4"
      >
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{t("err_workspace_load")}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Show loading while waiting for workspace to initialize
  return (
    <div
      {...testId("chat-page")}
      className="flex h-full items-center justify-center"
    >
      <div role="status" aria-live="polite">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-foreground" />
        <span className="sr-only">{t("com_loading")}</span>
      </div>
    </div>
  );
}
