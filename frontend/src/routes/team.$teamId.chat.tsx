import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { MessageSquareOff } from "lucide-react";

import { Chat, type ChatHandle } from "@/components/chat";
import { agentApi } from "@/lib/api";
import { queryKeys } from "@/lib/queries";
import { useChatSelection } from "@/lib/chat-store";
import { useWorkspace } from "@/lib/workspace";
import { useEffectiveSettings } from "@/lib/settings-context";
import { testId } from "@/lib/test-id";

const chatSearchSchema = z.object({
  id: z.string().optional(),
});

export const Route = createFileRoute("/team/$teamId/chat")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated && !context.auth.isLoading) {
      throw redirect({ to: "/login" });
    }
  },
  component: TeamChatPage,
  validateSearch: chatSearchSchema,
});

function TeamChatPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const chatRef = useRef<ChatHandle>(null);
  const { teamId } = Route.useParams();
  const { currentOrg, teams, isLoadingTeams } = useWorkspace();
  const { id: conversationIdFromUrl } = Route.useSearch();
  const effectiveSettings = useEffectiveSettings();

  const {
    selectedConversationId,
    currentTitle,
    setSelectedConversation,
    setCurrentTitle,
  } = useChatSelection();

  const lastLoadedIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const orgId = currentOrg?.id;

  // Validate teamId from URL against user's actual teams
  // Redirect to first valid team if current teamId is invalid
  const validatedTeam = teams.find((team) => team.id === teamId);
  useEffect(() => {
    if (!isLoadingTeams && teams.length > 0 && !validatedTeam) {
      // Team ID from URL is invalid, redirect to first team
      const firstTeam = teams[0];
      navigate({ to: "/team/$teamId/chat", params: { teamId: firstTeam.id } });
    }
  }, [isLoadingTeams, teams, validatedTeam, navigate]);

  useEffect(() => {
    if (conversationIdFromUrl === lastLoadedIdRef.current) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (!conversationIdFromUrl) {
      if (lastLoadedIdRef.current) {
        chatRef.current?.clearMessages();
        lastLoadedIdRef.current = null;
      }
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    agentApi
      .getHistory(conversationIdFromUrl)
      .then((history) => {
        if (abortController.signal.aborted) return;
        chatRef.current?.loadConversation(conversationIdFromUrl, history);
        // Only mark as loaded after successfully loading
        lastLoadedIdRef.current = conversationIdFromUrl;
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Failed to load conversation:", error);
        lastLoadedIdRef.current = null;
      });

    return () => {
      abortController.abort();
    };
  }, [conversationIdFromUrl]);

  const handleTitleUpdate = useCallback(
    (_conversationId: string, title: string) => {
      setCurrentTitle(title);
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.list(teamId),
      });
    },
    [queryClient, setCurrentTitle, teamId],
  );

  const handleStreamEnd = useCallback(
    (conversationId: string) => {
      if (conversationId && conversationId !== selectedConversationId) {
        setSelectedConversation(conversationId, currentTitle);
      }
    },
    [selectedConversationId, currentTitle, setSelectedConversation],
  );

  // Don't render anything while teams are loading or if team is invalid
  // This prevents API calls with invalid team IDs
  if (isLoadingTeams || (!validatedTeam && teams.length > 0)) {
    return null;
  }

  if (!effectiveSettings.chat_enabled) {
    const disabledBy = effectiveSettings.chat_disabled_by;
    const message =
      disabledBy === "org"
        ? t("chat_disabled_by_org")
        : disabledBy === "team"
          ? t("chat_disabled_by_team")
          : t("chat_disabled");

    return (
      <div
        {...testId("page-chat-disabled")}
        className="flex h-full items-center justify-center"
      >
        <div className="text-center max-w-md px-4">
          <div className="flex justify-center mb-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <MessageSquareOff className="size-8 text-muted-foreground" />
            </div>
          </div>
          <h1 className="text-xl font-semibold mb-2">
            {t("chat_unavailable")}
          </h1>
          <p className="text-muted-foreground">{message}</p>
          <p className="text-sm text-muted-foreground mt-4">
            {t("chat_contact_admin")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Chat
      {...testId("page-chat")}
      ref={chatRef}
      instanceId="page"
      organizationId={orgId}
      teamId={teamId}
      onTitleUpdate={handleTitleUpdate}
      onStreamEnd={handleStreamEnd}
      className="h-full border-0"
    />
  );
}
