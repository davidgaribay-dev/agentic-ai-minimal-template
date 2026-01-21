/**
 * Data table for managing LLM provider API keys at team level.
 *
 * Shows configured providers with their API key status (team-level and org-level),
 * allows enabling/disabling and managing team-specific keys.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MoreHorizontal,
  Check,
  Key,
  Trash2,
  Edit,
  Loader2,
  Building2,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTable } from "@/components/ui/data-table";
import { llmSettingsApi } from "@/lib/api";
import { TeamEditApiKeyDialog } from "./TeamEditApiKeyDialog";

// Provider configuration with icons and display info
const PROVIDER_CONFIG = {
  anthropic: {
    name: "Anthropic",
    description: "Claude models - advanced reasoning and analysis",
    icon: "🤖",
    color: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  },
  openai: {
    name: "OpenAI",
    description: "GPT models - versatile language capabilities",
    icon: "🧠",
    color: "bg-green-500/15 text-green-600 dark:text-green-400",
  },
  google: {
    name: "Google",
    description: "Gemini models - multimodal AI",
    icon: "✨",
    color: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
} as const;

type ProviderKey = keyof typeof PROVIDER_CONFIG;

interface ProviderRow {
  id: ProviderKey;
  name: string;
  description: string;
  hasTeamApiKey: boolean;
  hasOrgApiKey: boolean;
  isEnabled: boolean;
}

interface TeamProviderApiKeysTableProps {
  orgId: string;
  teamId: string;
  enabledProviders: string[];
  teamProviderApiKeyStatus: Record<string, boolean>;
  orgProviderApiKeyStatus: Record<string, boolean>;
  isLoading?: boolean;
}

export function TeamProviderApiKeysTable({
  orgId,
  teamId,
  enabledProviders,
  teamProviderApiKeyStatus,
  orgProviderApiKeyStatus,
  isLoading = false,
}: TeamProviderApiKeysTableProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editingProvider, setEditingProvider] = useState<ProviderKey | null>(
    null,
  );
  const [deletingProvider, setDeletingProvider] = useState<ProviderKey | null>(
    null,
  );

  // Build provider rows from configuration
  const providerRows = useMemo<ProviderRow[]>(() => {
    return (
      Object.entries(PROVIDER_CONFIG) as [
        ProviderKey,
        (typeof PROVIDER_CONFIG)[ProviderKey],
      ][]
    ).map(([id, config]) => ({
      id,
      name: config.name,
      description: config.description,
      hasTeamApiKey: teamProviderApiKeyStatus[id] ?? false,
      hasOrgApiKey: orgProviderApiKeyStatus[id] ?? false,
      isEnabled: enabledProviders.includes(id),
    }));
  }, [enabledProviders, teamProviderApiKeyStatus, orgProviderApiKeyStatus]);

  // Delete API key mutation
  const deleteKeyMutation = useMutation({
    mutationFn: async (provider: string) => {
      await llmSettingsApi.deleteTeamProviderApiKey(orgId, teamId, provider);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["team-llm-settings", orgId, teamId],
      });
      queryClient.invalidateQueries({
        queryKey: ["team-provider-api-key-status", orgId, teamId],
      });
      setDeletingProvider(null);
    },
  });

  const columns: ColumnDef<ProviderRow>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: t("llm_provider"),
        cell: ({ row }) => {
          const provider = row.original;
          const config = PROVIDER_CONFIG[provider.id];
          return (
            <div className="flex items-center gap-3">
              <div
                className={`flex size-8 items-center justify-center rounded-md ${config.color}`}
              >
                <span className="text-lg">{config.icon}</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{provider.name}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {provider.description}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "hasTeamApiKey",
        header: t("llm_team_api_key_status"),
        cell: ({ row }) => {
          const provider = row.original;
          if (provider.hasTeamApiKey) {
            return (
              <Badge
                variant="secondary"
                className="bg-green-500/15 text-green-600 dark:text-green-400 border-0"
              >
                <Check className="size-3 mr-1" />
                {t("llm_team_key_configured")}
              </Badge>
            );
          }
          if (provider.hasOrgApiKey) {
            return (
              <Badge variant="outline" className="text-muted-foreground">
                <Building2 className="size-3 mr-1" />
                {t("llm_using_org_key")}
              </Badge>
            );
          }
          return (
            <Badge variant="outline" className="text-muted-foreground">
              <Key className="size-3 mr-1" />
              {t("llm_key_not_set")}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">{t("com_actions")}</div>,
        cell: ({ row }) => {
          const provider = row.original;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => setEditingProvider(provider.id)}
                  >
                    <Edit className="mr-2 size-4" />
                    {provider.hasTeamApiKey
                      ? t("llm_update_api_key")
                      : t("llm_add_team_api_key")}
                  </DropdownMenuItem>
                  {provider.hasTeamApiKey && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeletingProvider(provider.id)}
                      >
                        <Trash2 className="mr-2 size-4" />
                        {t("llm_remove_team_api_key")}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [t, isLoading],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={providerRows}
        searchKey="name"
        searchPlaceholder={t("llm_search_providers")}
      />

      {/* Edit API Key Dialog */}
      {editingProvider && (
        <TeamEditApiKeyDialog
          orgId={orgId}
          teamId={teamId}
          provider={editingProvider}
          providerName={PROVIDER_CONFIG[editingProvider].name}
          hasExistingKey={teamProviderApiKeyStatus[editingProvider] ?? false}
          open={true}
          onOpenChange={(open) => !open && setEditingProvider(null)}
          onSuccess={() => {
            setEditingProvider(null);
            queryClient.invalidateQueries({
              queryKey: ["team-llm-settings", orgId, teamId],
            });
            queryClient.invalidateQueries({
              queryKey: ["team-provider-api-key-status", orgId, teamId],
            });
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingProvider}
        onOpenChange={(open) => !open && setDeletingProvider(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("llm_remove_team_api_key_title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("llm_remove_team_api_key_desc", {
                provider: deletingProvider
                  ? PROVIDER_CONFIG[deletingProvider].name
                  : "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("com_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deletingProvider && deleteKeyMutation.mutate(deletingProvider)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteKeyMutation.isPending}
            >
              {deleteKeyMutation.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              {t("llm_remove_api_key")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
