/**
 * Chat model selector for per-message model selection.
 *
 * Allows users to choose a different model for a specific message
 * when per-request model selection is enabled.
 *
 * Only shows models that have been explicitly configured at the org/team level.
 * Currently, orgs/teams configure a single default model, so this selector
 * only appears when there's actually a choice to make (future: multiple configured models).
 */

import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Sparkles } from "lucide-react";

import { llmSettingsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ChatModelSelectorProps {
  orgId: string;
  teamId?: string;
  selectedModel?: string;
  onModelChange: (model: string | undefined) => void;
  disabled?: boolean;
  className?: string;
}

export function ChatModelSelector({
  orgId,
  teamId,
  selectedModel,
  onModelChange,
  disabled,
  className,
}: ChatModelSelectorProps) {
  const { t } = useTranslation();

  // Fetch effective settings - this contains the configured default model
  const {
    data: effectiveSettings,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.llmSettings.effective(orgId, teamId),
    queryFn: () => llmSettingsApi.getEffectiveSettings(orgId, teamId),
    staleTime: 60000, // Cache for 1 minute
  });

  // Log errors for debugging
  if (error) {
    console.error("Failed to load LLM settings:", error);
  }

  // Don't render if per-request selection is not allowed
  if (!effectiveSettings?.per_request_selection_allowed) {
    return null;
  }

  // Currently only one model is configured (the default).
  // The selector only makes sense when there are multiple configured models.
  // For now, we show the current model as informational but don't allow changing.
  // Future: When we support multiple configured models, this will show a dropdown.

  const defaultModelId = effectiveSettings.model;
  const defaultModelName =
    effectiveSettings.available_models?.find((m) => m.id === defaultModelId)
      ?.name || defaultModelId;

  // If there's only the default model configured, just show it as info (no dropdown)
  // This prevents confusion by not showing all built-in models
  const configuredModels =
    effectiveSettings.available_models?.filter(
      (m) => m.id === defaultModelId,
    ) || [];

  if (configuredModels.length <= 1) {
    // Show current model as informational badge (no dropdown)
    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-7 gap-1 text-xs text-muted-foreground cursor-default hover:bg-transparent",
          className,
        )}
        disabled
      >
        <Sparkles className="size-3" />
        <span className="max-w-[120px] truncate">{defaultModelName}</span>
      </Button>
    );
  }

  // Future: When multiple models are configured, show dropdown
  // For now, this code path won't be reached since only 1 model can be configured
  const currentModel = selectedModel
    ? configuredModels.find((m) => m.id === selectedModel)
    : null;

  const displayName =
    currentModel?.name || defaultModelName || t("chat_default_model");

  const handleModelSelect = (modelId: string) => {
    if (modelId === defaultModelId) {
      onModelChange(undefined);
    } else {
      onModelChange(modelId);
    }
  };

  const handleUseDefault = () => {
    onModelChange(undefined);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 gap-1 text-xs text-muted-foreground hover:text-foreground",
            selectedModel && "text-foreground",
            className,
          )}
          disabled={disabled || isLoading}
        >
          <Sparkles className="size-3" />
          <span className="max-w-[120px] truncate">{displayName}</span>
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {selectedModel && (
          <DropdownMenuItem onClick={handleUseDefault}>
            <span className="text-muted-foreground">
              {t("chat_use_default_model")}
            </span>
          </DropdownMenuItem>
        )}
        {configuredModels.map((model) => {
          const isDefault = model.id === defaultModelId;
          const isSelected = model.id === selectedModel;
          return (
            <DropdownMenuItem
              key={model.id}
              onClick={() => handleModelSelect(model.id)}
              className={cn(isSelected && "bg-accent")}
            >
              <span className="flex-1 truncate">{model.name}</span>
              {isDefault && !selectedModel && (
                <span className="text-xs text-muted-foreground ml-2">
                  {t("chat_default")}
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
