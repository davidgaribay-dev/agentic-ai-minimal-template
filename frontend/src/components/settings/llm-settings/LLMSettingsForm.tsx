/**
 * Main LLM settings form component.
 *
 * Handles org/team/user level LLM configuration.
 */

import { useTranslation } from "react-i18next";
import { Info, Bot, Cpu, Settings2 } from "lucide-react";

import type { ModelInfo } from "@/lib/api";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { testId } from "@/lib/test-id";
import { SettingsCard } from "../settings-layout";

import {
  type LLMSettingsProps,
  type OrgLLMSettingsProps,
  type LLMSettingsUpdateBase,
  PROVIDER_OPTIONS,
} from "./types";

export function LLMSettingsForm(props: LLMSettingsProps) {
  const { t } = useTranslation();
  const {
    defaultProvider,
    defaultModel,
    defaultTemperature,
    availableModels,
    isLoading = false,
    disabledBy,
    level,
  } = props;

  const isDisabledByHigherLevel = !!disabledBy;
  const isDisabled = isDisabledByHigherLevel || isLoading;

  const getTooltipMessage = (): string | null => {
    if (disabledBy === "org") return t("llm_disabled_by_org");
    if (disabledBy === "team") return t("llm_disabled_by_team");
    return null;
  };

  const tooltipMessage = getTooltipMessage();

  // Type-safe update handler using the common base type
  // Both org and team levels use default_* field naming
  const handleUpdate = (data: LLMSettingsUpdateBase) => {
    props.onUpdate(data);
  };

  // Org-specific update handler for permission fields
  const handleOrgUpdate = (
    data:
      | { allow_team_customization: boolean }
      | { allow_user_customization: boolean }
      | { allow_per_request_model_selection: boolean },
  ) => {
    if (level === "org") {
      (props as OrgLLMSettingsProps).onUpdate(data);
    }
  };

  // Team-specific update handler for allow_user_customization
  const handleTeamUpdate = (data: { allow_user_customization: boolean }) => {
    if (level === "team") {
      props.onUpdate(data);
    }
  };

  // Group models by provider for display
  const modelsByProvider = availableModels.reduce(
    (acc, model) => {
      const provider = model.is_custom ? "custom" : model.provider;
      if (!acc[provider]) acc[provider] = [];
      acc[provider].push(model);
      return acc;
    },
    {} as Record<string, ModelInfo[]>,
  );

  // Get provider label
  const getProviderLabel = (provider: string) => {
    const opt = PROVIDER_OPTIONS.find((p) => p.value === provider);
    return opt?.label || provider;
  };

  return (
    <div {...testId("llm-settings")} className="space-y-4">
      {/* Default Model Selection */}
      <SettingsCard>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Bot className="size-4" />
            {t("llm_default_model")}
            {isDisabledByHigherLevel && tooltipMessage && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{tooltipMessage}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("llm_default_model_desc")}
          </p>

          {/* Provider Selection */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label
                htmlFor="provider"
                className={cn(isDisabled && "text-muted-foreground")}
              >
                {t("llm_provider")}
              </Label>
              <Select
                value={defaultProvider}
                onValueChange={(v) => handleUpdate({ default_provider: v })}
                disabled={isDisabled}
              >
                <SelectTrigger {...testId("llm-provider-select")} id="provider">
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

            {/* Model Selection */}
            <div className="space-y-2">
              <Label
                htmlFor="model"
                className={cn(isDisabled && "text-muted-foreground")}
              >
                {t("llm_model")}
              </Label>
              <Select
                value={defaultModel}
                onValueChange={(v) => handleUpdate({ default_model: v })}
                disabled={isDisabled}
              >
                <SelectTrigger {...testId("llm-model-select")} id="model">
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

      {/* Parameters */}
      <SettingsCard>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Settings2 className="size-4" />
            {t("llm_parameters")}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("llm_parameters_desc")}
          </p>

          {/* Temperature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className={cn(isDisabled && "text-muted-foreground")}>
                {t("llm_temperature")}
              </Label>
              <span className="text-sm text-muted-foreground">
                {defaultTemperature.toFixed(1)}
              </span>
            </div>
            <Slider
              {...testId("llm-temperature-slider")}
              value={[defaultTemperature]}
              onValueChange={(values) =>
                handleUpdate({ default_temperature: values[0] })
              }
              min={0}
              max={2}
              step={0.1}
              disabled={isDisabled}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              {t("llm_temperature_desc")}
            </p>
          </div>
        </div>
      </SettingsCard>

      {/* Org-level permissions */}
      {level === "org" && (
        <SettingsCard>
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Cpu className="size-4" />
              {t("llm_permissions")}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("llm_permissions_desc")}
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="allow-team" className="text-sm">
                    {t("llm_allow_team_customization")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("llm_allow_team_customization_desc")}
                  </p>
                </div>
                <Switch
                  {...testId("llm-allow-team-switch")}
                  id="allow-team"
                  checked={
                    (props as OrgLLMSettingsProps).allowTeamCustomization
                  }
                  onCheckedChange={(v) =>
                    handleOrgUpdate({ allow_team_customization: v })
                  }
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="allow-user" className="text-sm">
                    {t("llm_allow_user_customization")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("llm_allow_user_customization_desc")}
                  </p>
                </div>
                <Switch
                  {...testId("llm-allow-user-switch")}
                  id="allow-user"
                  checked={
                    (props as OrgLLMSettingsProps).allowUserCustomization
                  }
                  onCheckedChange={(v) =>
                    handleOrgUpdate({ allow_user_customization: v })
                  }
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="allow-per-request" className="text-sm">
                    {t("llm_allow_per_request_selection")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("llm_allow_per_request_selection_desc")}
                  </p>
                </div>
                <Switch
                  {...testId("llm-allow-per-request-switch")}
                  id="allow-per-request"
                  checked={
                    (props as OrgLLMSettingsProps).allowPerRequestSelection
                  }
                  onCheckedChange={(v) =>
                    handleOrgUpdate({ allow_per_request_model_selection: v })
                  }
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
        </SettingsCard>
      )}

      {/* Team-level permissions */}
      {level === "team" && (
        <SettingsCard>
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Cpu className="size-4" />
              {t("llm_permissions")}
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="allow-user-team" className="text-sm">
                  {t("llm_allow_user_customization")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("llm_allow_user_customization_desc")}
                </p>
              </div>
              <Switch
                {...testId("llm-allow-user-team-switch")}
                id="allow-user-team"
                checked={
                  "allowUserCustomization" in props
                    ? props.allowUserCustomization
                    : true
                }
                onCheckedChange={(v) =>
                  handleTeamUpdate({ allow_user_customization: v })
                }
                disabled={isDisabled}
              />
            </div>
          </div>
        </SettingsCard>
      )}
    </div>
  );
}
