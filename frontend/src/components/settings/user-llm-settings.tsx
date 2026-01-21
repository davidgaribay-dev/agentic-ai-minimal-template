/**
 * User-level LLM settings component.
 *
 * Allows users to set their personal LLM preferences (if allowed by org/team).
 */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Info } from "lucide-react";

import {
  llmSettingsApi,
  type UserLLMSettingsUpdate,
  type ModelInfo,
  type BuiltInModels,
} from "@/lib/api";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SettingsCard } from "./settings-layout";

const PROVIDER_OPTIONS = [
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google" },
] as const;

interface UserLLMSettingsProps {
  orgId: string;
  teamId?: string;
}

/**
 * Transforms built-in models object into flat array with provider info.
 */
function flattenBuiltInModels(builtIn: BuiltInModels | undefined): ModelInfo[] {
  if (!builtIn) return [];

  const models: ModelInfo[] = [];
  for (const [provider, providerModels] of Object.entries(builtIn)) {
    for (const model of providerModels) {
      models.push({
        id: model.id,
        name: model.name,
        provider,
        capabilities: model.capabilities,
        max_context_tokens: model.max_context_tokens,
        max_output_tokens: model.max_output_tokens,
        is_custom: false,
      });
    }
  }
  return models;
}

export function UserLLMSettings({ orgId, teamId }: UserLLMSettingsProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Fetch effective settings to check permissions
  const { data: effectiveSettings, isLoading: isLoadingEffective } = useQuery({
    queryKey: ["llm-effective-settings", orgId, teamId],
    queryFn: () => llmSettingsApi.getEffectiveSettings(orgId, teamId),
  });

  // Fetch user's personal settings
  const { data: userSettings, isLoading: isLoadingUser } = useQuery({
    queryKey: ["user-llm-settings"],
    queryFn: () => llmSettingsApi.getUserSettings(),
  });

  // Fetch available models
  const { data: builtInModels, isLoading: isLoadingModels } = useQuery({
    queryKey: ["llm-built-in-models"],
    queryFn: () => llmSettingsApi.getBuiltInModels(),
  });

  // Transform built-in models to flat array
  const availableModels = useMemo(
    () => flattenBuiltInModels(builtInModels),
    [builtInModels],
  );

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UserLLMSettingsUpdate) =>
      llmSettingsApi.updateUserSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-llm-settings"] });
      queryClient.invalidateQueries({
        queryKey: ["llm-effective-settings", orgId, teamId],
      });
    },
  });

  const isLoading = isLoadingEffective || isLoadingUser || isLoadingModels;

  // Check if user customization is allowed
  const canCustomize = effectiveSettings?.can_change_model ?? false;
  const canChangeParameters = effectiveSettings?.can_change_parameters ?? false;

  if (isLoading) {
    return (
      <SettingsCard>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </SettingsCard>
    );
  }

  if (!canCustomize && !canChangeParameters) {
    return (
      <SettingsCard>
        <div className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="size-4" />
            {t("llm_user_customization_disabled")}
          </div>
        </div>
      </SettingsCard>
    );
  }

  // Use effective settings as defaults when user hasn't set preferences
  const currentProvider =
    userSettings?.preferred_provider ??
    effectiveSettings?.provider ??
    "anthropic";
  const currentModel =
    userSettings?.preferred_model ?? effectiveSettings?.model ?? "";
  const currentTemperature =
    userSettings?.preferred_temperature ??
    effectiveSettings?.temperature ??
    0.7;

  // Group models by provider
  const modelsByProvider = availableModels.reduce(
    (acc, model) => {
      const provider = model.is_custom ? "custom" : model.provider;
      if (!acc[provider]) acc[provider] = [];
      acc[provider].push(model);
      return acc;
    },
    {} as Record<string, ModelInfo[]>,
  );

  const getProviderLabel = (provider: string) => {
    const opt = PROVIDER_OPTIONS.find((p) => p.value === provider);
    return opt?.label || provider;
  };

  const handleUpdate = (data: UserLLMSettingsUpdate) => {
    updateMutation.mutate(data);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("llm_user_settings_desc")}
      </p>

      {/* Model Selection */}
      {canCustomize && (
        <SettingsCard>
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              {t("llm_preferred_model")}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("llm_preferred_model_desc")}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label
                  htmlFor="user-provider"
                  className={cn(
                    updateMutation.isPending && "text-muted-foreground",
                  )}
                >
                  {t("llm_provider")}
                </Label>
                <Select
                  value={currentProvider}
                  onValueChange={(v) => handleUpdate({ preferred_provider: v })}
                  disabled={updateMutation.isPending}
                >
                  <SelectTrigger id="user-provider">
                    <SelectValue placeholder={t("llm_select_provider")} />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="user-model"
                  className={cn(
                    updateMutation.isPending && "text-muted-foreground",
                  )}
                >
                  {t("llm_model")}
                </Label>
                <Select
                  value={currentModel}
                  onValueChange={(v) => handleUpdate({ preferred_model: v })}
                  disabled={updateMutation.isPending}
                >
                  <SelectTrigger id="user-model">
                    <SelectValue placeholder={t("llm_select_model")} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(modelsByProvider).map(
                      ([provider, models]) => (
                        <div key={provider}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            {getProviderLabel(provider)}
                          </div>
                          {models.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.name}
                            </SelectItem>
                          ))}
                        </div>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </SettingsCard>
      )}

      {/* Temperature */}
      {canChangeParameters && (
        <SettingsCard>
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              {t("llm_preferred_temperature")}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  className={cn(
                    updateMutation.isPending && "text-muted-foreground",
                  )}
                >
                  {t("llm_temperature")}
                </Label>
                <span className="text-sm text-muted-foreground">
                  {currentTemperature.toFixed(1)}
                </span>
              </div>
              <Slider
                value={[currentTemperature]}
                onValueChange={(values) =>
                  handleUpdate({ preferred_temperature: values[0] })
                }
                min={0}
                max={2}
                step={0.1}
                disabled={updateMutation.isPending}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                {t("llm_temperature_desc")}
              </p>
            </div>
          </div>
        </SettingsCard>
      )}

      {/* Reset to defaults */}
      {(userSettings?.preferred_provider ||
        userSettings?.preferred_model ||
        userSettings?.preferred_temperature !== null) && (
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground underline"
          onClick={() =>
            handleUpdate({
              preferred_provider: null,
              preferred_model: null,
              preferred_temperature: null,
            })
          }
          disabled={updateMutation.isPending}
        >
          {t("llm_reset_to_defaults")}
        </button>
      )}
    </div>
  );
}
