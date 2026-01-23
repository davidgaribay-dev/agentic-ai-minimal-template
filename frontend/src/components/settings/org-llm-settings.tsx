/**
 * Organization-level LLM settings component.
 *
 * Model-centric design:
 * - Shows the current default model prominently
 * - "Add Model" button opens wizard to select and configure a model
 * - API Keys section for managing provider credentials
 * - Permissions section for team/user customization controls
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Bot, Key } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { llmSettingsApi, type OrganizationLLMSettingsUpdate } from "@/lib/api";
import {
  LLMPermissionsForm,
  AddModelWizard,
  ConfiguredModelsTable,
  ProviderApiKeysTable,
} from "./llm-settings";
import { SettingsCard } from "./settings-layout";
import { testId } from "@/lib/test-id";

interface OrgLLMSettingsProps {
  orgId: string;
}

export function OrgLLMSettings({ orgId }: OrgLLMSettingsProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Fetch org LLM settings
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["org-llm-settings", orgId],
    queryFn: () => llmSettingsApi.getOrgSettings(orgId),
  });

  // Fetch available models
  const { data: builtInModels, isLoading: isLoadingModels } = useQuery({
    queryKey: ["llm-built-in-models"],
    queryFn: () => llmSettingsApi.getBuiltInModels(),
  });

  // Fetch API key status for providers
  const { data: providerApiKeyStatus, isLoading: isLoadingKeyStatus } =
    useQuery({
      queryKey: ["provider-api-key-status", orgId],
      queryFn: () => llmSettingsApi.getProviderApiKeyStatus(orgId),
    });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: OrganizationLLMSettingsUpdate) =>
      llmSettingsApi.updateOrgSettings(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-llm-settings", orgId] });
      queryClient.invalidateQueries({
        queryKey: ["provider-api-key-status", orgId],
      });
    },
  });

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
    displayName: string | null,
  ) => {
    updateMutation.mutate({
      default_temperature: temperature,
      default_model_display_name: displayName,
    });
  };

  const handleDeleteModel = () => {
    // Reset to defaults - clear the model configuration
    updateMutation.mutate({
      default_provider: "",
      default_model: "",
      default_temperature: 0.7,
    });
  };

  const isLoading = isLoadingSettings || isLoadingModels || isLoadingKeyStatus;

  if (isLoading || !settings) {
    return (
      <SettingsCard>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </SettingsCard>
    );
  }

  // Count configured models (currently just 1 - the default)
  const modelCount = settings.default_model ? 1 : 0;

  // Count configured API keys
  const configuredKeysCount = Object.values(providerApiKeyStatus ?? {}).filter(
    Boolean,
  ).length;

  return (
    <div {...testId("org-llm-settings")} className="space-y-4">
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
            </div>
            <AddModelWizard
              orgId={orgId}
              enabledProviders={settings.enabled_providers}
              defaultProvider={settings.default_provider}
              defaultModel={settings.default_model}
              defaultTemperature={settings.default_temperature}
              providerApiKeyStatus={providerApiKeyStatus ?? {}}
              onSuccess={() => {
                queryClient.invalidateQueries({
                  queryKey: ["org-llm-settings", orgId],
                });
                queryClient.invalidateQueries({
                  queryKey: ["provider-api-key-status", orgId],
                });
              }}
            />
          </div>
          <ConfiguredModelsTable
            builtInModels={builtInModels}
            defaultProvider={settings.default_provider}
            defaultModel={settings.default_model}
            defaultModelDisplayName={settings.default_model_display_name}
            defaultTemperature={settings.default_temperature}
            enabledProviders={settings.enabled_providers}
            onSetDefault={handleSetDefault}
            onEdit={handleEditModel}
            onDelete={handleDeleteModel}
            isUpdating={updateMutation.isPending}
          />
        </div>
      </SettingsCard>

      {/* API Keys Section */}
      <SettingsCard>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium py-2">
            <Key className="size-4" />
            {t("llm_api_keys")}
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {configuredKeysCount}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("llm_api_keys_desc")}
          </p>
          <ProviderApiKeysTable
            orgId={orgId}
            enabledProviders={settings.enabled_providers}
            defaultProvider={settings.default_provider}
            providerApiKeyStatus={providerApiKeyStatus ?? {}}
            isLoading={updateMutation.isPending}
            onUpdate={(data) => updateMutation.mutate(data)}
          />
        </div>
      </SettingsCard>

      {/* Permissions Section */}
      <LLMPermissionsForm
        allowTeamCustomization={settings.allow_team_customization}
        allowPerRequestSelection={settings.allow_per_request_model_selection}
        isLoading={updateMutation.isPending}
        onUpdate={(data) => updateMutation.mutate(data)}
      />
    </div>
  );
}
