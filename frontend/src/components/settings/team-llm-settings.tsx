/**
 * Team-level LLM settings component.
 *
 * Model-centric design matching org settings:
 * - Shows the current default model prominently
 * - "Add Model" button opens wizard to select and configure a model
 * - Team-level API keys section (override org-level keys)
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Bot, Info, Key } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { llmSettingsApi, type TeamLLMSettingsUpdate } from "@/lib/api";
import {
  TeamAddModelWizard,
  TeamProviderApiKeysTable,
  ConfiguredModelsTable,
} from "./llm-settings";
import { SettingsCard } from "./settings-layout";

interface TeamLLMSettingsProps {
  orgId: string;
  teamId: string;
}

export function TeamLLMSettings({ orgId, teamId }: TeamLLMSettingsProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Fetch org LLM settings to check permissions and get defaults
  const { data: orgSettings, isLoading: isLoadingOrgSettings } = useQuery({
    queryKey: ["org-llm-settings", orgId],
    queryFn: () => llmSettingsApi.getOrgSettings(orgId),
  });

  // Fetch team LLM settings
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["team-llm-settings", orgId, teamId],
    queryFn: () => llmSettingsApi.getTeamSettings(orgId, teamId),
  });

  // Fetch available models
  const { data: builtInModels, isLoading: isLoadingModels } = useQuery({
    queryKey: ["llm-built-in-models"],
    queryFn: () => llmSettingsApi.getBuiltInModels(),
  });

  // Fetch API key status for providers (at org level)
  const { data: orgProviderApiKeyStatus, isLoading: isLoadingOrgKeyStatus } =
    useQuery({
      queryKey: ["provider-api-key-status", orgId],
      queryFn: () => llmSettingsApi.getProviderApiKeyStatus(orgId),
    });

  // Fetch API key status for providers (at team level)
  const { data: teamProviderApiKeyStatus, isLoading: isLoadingTeamKeyStatus } =
    useQuery({
      queryKey: ["team-provider-api-key-status", orgId, teamId],
      queryFn: () => llmSettingsApi.getTeamProviderApiKeyStatus(orgId, teamId),
    });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: TeamLLMSettingsUpdate) =>
      llmSettingsApi.updateTeamSettings(orgId, teamId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["team-llm-settings", orgId, teamId],
      });
    },
  });

  // Check if team customization is allowed by org
  const disabledByOrg = orgSettings?.allow_team_customization === false;

  const handleSetDefault = (provider: string, model: string) => {
    updateMutation.mutate({
      default_provider: provider,
      default_model: model,
    });
  };

  const handleEditModel = (
    _provider: string,
    _model: string,
    temperature: number,
    _displayName: string | null,
  ) => {
    updateMutation.mutate({
      default_temperature: temperature,
    });
  };

  const handleDeleteModel = () => {
    // Reset to inherit from org
    updateMutation.mutate({
      default_provider: null,
      default_model: null,
      default_temperature: null,
    });
  };

  const isLoading =
    isLoadingOrgSettings ||
    isLoadingSettings ||
    isLoadingModels ||
    isLoadingOrgKeyStatus ||
    isLoadingTeamKeyStatus;

  if (isLoading || !settings || !orgSettings) {
    return (
      <SettingsCard>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </SettingsCard>
    );
  }

  // Use team values if set, otherwise fall back to org defaults
  const displayProvider =
    settings.default_provider ?? orgSettings.default_provider;
  const displayModel = settings.default_model ?? orgSettings.default_model;
  const displayTemperature =
    settings.default_temperature ?? orgSettings.default_temperature;

  // Team models inherit display name from org for now
  const displayModelDisplayName = settings.default_model
    ? null // Team-specific models don't have custom display names yet
    : orgSettings.default_model_display_name;

  // Count configured models (1 if team has custom, 0 if inheriting)
  const modelCount = settings.default_model ? 1 : 0;
  const isInheriting = !settings.default_model && displayModel;

  // Combine team and org API key status (team key or org key = available)
  const combinedApiKeyStatus: Record<string, boolean> = {};
  const providers = ["anthropic", "openai", "google"];
  for (const provider of providers) {
    combinedApiKeyStatus[provider] =
      (teamProviderApiKeyStatus?.[provider] ?? false) ||
      (orgProviderApiKeyStatus?.[provider] ?? false);
  }

  // Count team-specific API keys
  const teamKeyCount = Object.values(teamProviderApiKeyStatus ?? {}).filter(
    Boolean,
  ).length;

  return (
    <div className="space-y-4">
      {/* Disabled by org warning */}
      {disabledByOrg && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium">
            <Info className="size-4" />
            {t("llm_disabled_by_org")}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {t("llm_team_customization_disabled")}
          </p>
        </div>
      )}

      {/* Models Section */}
      <SettingsCard>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Bot className="size-4" />
              {t("llm_models")}
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {modelCount}
              </Badge>
              {isInheriting && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className="ml-1 h-5 px-1.5 text-xs"
                      >
                        {t("llm_inheriting")}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t("llm_inheriting_desc")}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {!disabledByOrg && (
              <TeamAddModelWizard
                orgId={orgId}
                teamId={teamId}
                enabledProviders={orgSettings.enabled_providers}
                defaultModel={settings.default_model}
                defaultTemperature={displayTemperature}
                providerApiKeyStatus={combinedApiKeyStatus}
                onSuccess={() => {
                  queryClient.invalidateQueries({
                    queryKey: ["team-llm-settings", orgId, teamId],
                  });
                }}
              />
            )}
          </div>

          {/* Show configured model table if team has custom model OR is inheriting from org */}
          {(settings.default_model || isInheriting) && (
            <ConfiguredModelsTable
              builtInModels={builtInModels}
              defaultProvider={displayProvider}
              defaultModel={displayModel}
              defaultModelDisplayName={displayModelDisplayName}
              defaultTemperature={displayTemperature}
              enabledProviders={orgSettings.enabled_providers}
              onSetDefault={handleSetDefault}
              onEdit={disabledByOrg ? () => {} : handleEditModel}
              onDelete={
                settings.default_model && !disabledByOrg
                  ? handleDeleteModel
                  : undefined
              }
              isUpdating={updateMutation.isPending}
            />
          )}

          {!settings.default_model && !isInheriting && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t("llm_no_models_configured")}
            </p>
          )}
        </div>
      </SettingsCard>

      {/* API Keys Section */}
      {!disabledByOrg && (
        <SettingsCard>
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium py-2">
              <Key className="size-4" />
              {t("llm_team_api_keys")}
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {teamKeyCount}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("llm_team_api_keys_desc")}
            </p>
            <TeamProviderApiKeysTable
              orgId={orgId}
              teamId={teamId}
              enabledProviders={orgSettings.enabled_providers}
              teamProviderApiKeyStatus={teamProviderApiKeyStatus ?? {}}
              orgProviderApiKeyStatus={orgProviderApiKeyStatus ?? {}}
              isLoading={updateMutation.isPending}
            />
          </div>
        </SettingsCard>
      )}
    </div>
  );
}
