/**
 * Wizard dialog for adding a new LLM model configuration.
 *
 * Flow:
 * 1. Select provider from a grid
 * 2. Set API key for that provider (required if not already configured)
 * 3. Select model from that provider and configure (temperature, etc.)
 */

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  ChevronRight,
  ChevronLeft,
  Check,
  Search,
  Loader2,
  Sparkles,
  Eye,
  Wrench,
  MessageSquare,
  Zap,
  Brain,
  FileText,
  Key,
  ExternalLink,
  Star,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { llmSettingsApi, type OrganizationLLMSettingsUpdate } from "@/lib/api";

// Provider configuration with icons, branding, and API key links
const PROVIDERS: Record<
  string,
  {
    name: string;
    icon: string;
    color: string;
    selectedColor: string;
    description: string;
    apiKeyUrl?: string;
  }
> = {
  anthropic: {
    name: "Anthropic",
    icon: "🤖",
    color: "bg-orange-500/10 border-orange-500/30 hover:border-orange-500/50",
    selectedColor: "bg-orange-500/20 border-orange-500",
    description: "Claude models with advanced reasoning",
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
  },
  openai: {
    name: "OpenAI",
    icon: "🧠",
    color: "bg-green-500/10 border-green-500/30 hover:border-green-500/50",
    selectedColor: "bg-green-500/20 border-green-500",
    description: "GPT & O-series models",
    apiKeyUrl: "https://platform.openai.com/api-keys",
  },
  google: {
    name: "Google",
    icon: "✨",
    color: "bg-blue-500/10 border-blue-500/30 hover:border-blue-500/50",
    selectedColor: "bg-blue-500/20 border-blue-500",
    description: "Gemini multimodal models",
    apiKeyUrl: "https://aistudio.google.com/app/apikey",
  },
};

// Capability icons
const CAPABILITY_ICONS: Record<string, React.ReactNode> = {
  tool_calling: <Wrench className="size-3" />,
  vision: <Eye className="size-3" />,
  streaming: <Zap className="size-3" />,
  structured_output: <FileText className="size-3" />,
  reasoning: <Brain className="size-3" />,
  long_context: <MessageSquare className="size-3" />,
  document: <FileText className="size-3" />,
};

interface ModelInfo {
  id: string;
  name: string;
  capabilities: string[];
  max_context_tokens?: number;
  max_output_tokens?: number;
}

type WizardStep = "provider" | "apikey" | "model";

interface AddModelWizardProps {
  orgId: string;
  enabledProviders: string[];
  defaultProvider: string;
  defaultModel: string;
  defaultTemperature: number;
  providerApiKeyStatus: Record<string, boolean>;
  onSuccess?: () => void;
}

export function AddModelWizard({
  orgId,
  enabledProviders,
  defaultModel,
  defaultTemperature,
  providerApiKeyStatus,
  onSuccess,
}: AddModelWizardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>("provider");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelInfo | null>(null);
  const [temperature, setTemperature] = useState(defaultTemperature);
  const [apiKey, setApiKey] = useState("");
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [setAsDefault, setSetAsDefault] = useState(true);
  const [modelSearch, setModelSearch] = useState("");
  const [savingApiKey, setSavingApiKey] = useState(false);

  // Fetch built-in models
  const { data: builtInModels } = useQuery({
    queryKey: ["llm-built-in-models"],
    queryFn: () => llmSettingsApi.getBuiltInModels(),
  });

  // Get models for selected provider
  const providerModels = useMemo<ModelInfo[]>(() => {
    if (!selectedProvider || !builtInModels) return [];
    return builtInModels[selectedProvider] || [];
  }, [selectedProvider, builtInModels]);

  // Filter models based on search
  const filteredModels = useMemo(() => {
    if (!modelSearch) return providerModels;
    const search = modelSearch.toLowerCase();
    return providerModels.filter(
      (m) =>
        m.name.toLowerCase().includes(search) ||
        m.id.toLowerCase().includes(search),
    );
  }, [modelSearch, providerModels]);

  // Check if API key is already configured for selected provider
  const hasApiKey = selectedProvider
    ? providerApiKeyStatus[selectedProvider]
    : false;

  // Save API key mutation
  const saveApiKeyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProvider || !apiKey) return;
      await llmSettingsApi.setProviderApiKey(orgId, selectedProvider, apiKey);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["provider-api-key-status", orgId],
      });
      setApiKeySaved(true);
      setSavingApiKey(false);
    },
    onError: () => {
      setSavingApiKey(false);
    },
  });

  // Save model as default mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProvider || !selectedModel) return;

      const updates: OrganizationLLMSettingsUpdate = {};

      if (setAsDefault) {
        updates.default_provider = selectedProvider;
        updates.default_model = selectedModel.id;
        updates.default_temperature = temperature;
      }

      if (Object.keys(updates).length > 0) {
        await llmSettingsApi.updateOrgSettings(orgId, updates);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-llm-settings", orgId] });
      handleClose();
      onSuccess?.();
    },
  });

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setStep("provider");
      setSelectedProvider(null);
      setSelectedModel(null);
      setTemperature(defaultTemperature);
      setApiKey("");
      setApiKeySaved(false);
      setSetAsDefault(true);
      setModelSearch("");
    }, 200);
  };

  const handleProviderSelect = (provider: string) => {
    setSelectedProvider(provider);
    setSelectedModel(null);
    setApiKey("");
    setApiKeySaved(false);
    setModelSearch("");
  };

  const handleSaveApiKey = () => {
    setSavingApiKey(true);
    saveApiKeyMutation.mutate();
  };

  const handleNext = () => {
    if (step === "provider" && selectedProvider) {
      // If API key already configured, skip to model selection
      if (hasApiKey) {
        setStep("model");
      } else {
        setStep("apikey");
      }
    } else if (step === "apikey" && (hasApiKey || apiKeySaved)) {
      setStep("model");
    }
  };

  const handleBack = () => {
    if (step === "apikey") {
      setStep("provider");
    } else if (step === "model") {
      // If API key was already configured, go back to provider
      // Otherwise go back to API key step
      if (hasApiKey && !apiKeySaved) {
        setStep("provider");
      } else {
        setStep("apikey");
      }
    }
  };

  const handleSave = () => {
    saveMutation.mutate();
  };

  const canProceed = () => {
    if (step === "provider") return !!selectedProvider;
    if (step === "apikey") return hasApiKey || apiKeySaved;
    if (step === "model") return !!selectedModel;
    return false;
  };

  const getStepNumber = () => {
    if (step === "provider") return 1;
    if (step === "apikey") return 2;
    return 3;
  };

  const providerInfo = selectedProvider ? PROVIDERS[selectedProvider] : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4 mr-2" />
          {t("llm_add_model")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5" />
            {t("llm_add_model_title")}
          </DialogTitle>
          <DialogDescription>
            {step === "provider" && t("llm_select_provider_desc")}
            {step === "apikey" && t("llm_setup_api_key_desc")}
            {step === "model" && t("llm_select_model_desc")}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          {["provider", "apikey", "model"].map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={cn(
                  "size-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  getStepNumber() > i + 1
                    ? "bg-primary text-primary-foreground"
                    : getStepNumber() === i + 1
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {getStepNumber() > i + 1 ? <Check className="size-4" /> : i + 1}
              </div>
              {i < 2 && (
                <div
                  className={cn(
                    "w-12 h-0.5 mx-1",
                    getStepNumber() > i + 1 ? "bg-primary" : "bg-muted",
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-hidden min-h-[300px]">
          {/* Step 1: Provider Selection */}
          {step === "provider" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {enabledProviders
                  .filter((p) => PROVIDERS[p])
                  .map((providerId) => {
                    const provider = PROVIDERS[providerId];
                    const isSelected = selectedProvider === providerId;
                    const keyConfigured = providerApiKeyStatus[providerId];

                    return (
                      <button
                        key={providerId}
                        type="button"
                        onClick={() => handleProviderSelect(providerId)}
                        className={cn(
                          "p-4 rounded-lg border-2 text-left transition-all",
                          isSelected ? provider.selectedColor : provider.color,
                        )}
                      >
                        <div className="text-2xl mb-2">{provider.icon}</div>
                        <div className="font-medium">{provider.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {provider.description}
                        </div>
                        {keyConfigured && (
                          <div className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                            <Check className="size-3" />
                            {t("llm_key_configured")}
                          </div>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Step 2: API Key Setup */}
          {step === "apikey" && selectedProvider && providerInfo && (
            <div className="space-y-6">
              {/* Provider header */}
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border">
                <div
                  className={cn(
                    "flex size-12 items-center justify-center rounded-lg",
                    providerInfo.color.split(" ")[0],
                  )}
                >
                  <span className="text-2xl">{providerInfo.icon}</span>
                </div>
                <div>
                  <div className="font-medium text-lg">{providerInfo.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {providerInfo.description}
                  </div>
                </div>
              </div>

              {hasApiKey || apiKeySaved ? (
                /* API Key already configured */
                <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/5">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <Check className="size-5" />
                    <span className="font-medium">
                      {t("llm_api_key_configured")}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {t("llm_api_key_configured_desc")}
                  </p>
                </div>
              ) : (
                /* API Key input */
                <div className="space-y-4">
                  <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
                    <div className="flex items-center gap-2 mb-3">
                      <Key className="size-4 text-amber-600" />
                      <Label htmlFor="api-key" className="font-medium">
                        {t("llm_api_key")}{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                    </div>
                    <Input
                      id="api-key"
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={t("llm_api_key_placeholder")}
                      className="mb-3"
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {t("llm_api_key_required_to_use", {
                          provider: providerInfo.name,
                        })}
                      </p>
                      {providerInfo.apiKeyUrl && (
                        <a
                          href={providerInfo.apiKeyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          {t("llm_get_api_key", {
                            provider: providerInfo.name,
                          })}
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={handleSaveApiKey}
                    disabled={!apiKey || savingApiKey}
                    className="w-full"
                  >
                    {savingApiKey && (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    )}
                    {t("llm_save_key")}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Model Selection & Configuration */}
          {step === "model" && selectedProvider && providerInfo && (
            <div className="space-y-4 h-full flex flex-col">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder={t("llm_search_models")}
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Models list */}
              <div className="flex-1 overflow-y-auto space-y-2 max-h-[200px] pr-2">
                {filteredModels.map((model) => {
                  const isSelected = selectedModel?.id === model.id;
                  const isDefault = model.id === defaultModel;

                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => setSelectedModel(model)}
                      className={cn(
                        "w-full p-3 rounded-lg border text-left transition-all",
                        isSelected
                          ? "bg-primary/10 border-primary ring-2 ring-primary/20"
                          : "bg-card hover:bg-muted/50 border-border",
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{model.name}</span>
                            {isDefault && (
                              <Badge
                                variant="secondary"
                                className="text-xs h-5 px-1.5"
                              >
                                <Star className="size-3 mr-1 fill-current" />
                                {t("llm_current_default")}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">
                            {model.id}
                          </div>
                          {/* Capabilities */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {model.capabilities?.slice(0, 4).map((cap) => (
                              <span
                                key={cap}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs"
                                title={cap.replace(/_/g, " ")}
                              >
                                {CAPABILITY_ICONS[cap]}
                              </span>
                            ))}
                            {(model.capabilities?.length || 0) > 4 && (
                              <span className="text-xs text-muted-foreground">
                                +{(model.capabilities?.length || 0) - 4}
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="size-5 text-primary shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}

                {filteredModels.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {t("llm_no_models_found")}
                  </div>
                )}
              </div>

              {/* Configuration when model selected */}
              {selectedModel && (
                <div className="space-y-4 pt-4 border-t">
                  {/* Temperature */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{t("llm_temperature")}</Label>
                      <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                        {temperature.toFixed(1)}
                      </span>
                    </div>
                    <Slider
                      value={[temperature]}
                      onValueChange={(v) => setTemperature(v[0])}
                      min={0}
                      max={2}
                      step={0.1}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("llm_temperature_desc")}
                    </p>
                  </div>

                  {/* Set as default */}
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <div className="font-medium text-sm">
                        {t("llm_set_as_default")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t("llm_set_as_default_desc")}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSetAsDefault(!setAsDefault)}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        setAsDefault ? "bg-primary" : "bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block size-4 transform rounded-full bg-white transition-transform",
                          setAsDefault ? "translate-x-6" : "translate-x-1",
                        )}
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between mt-4">
          <div>
            {step !== "provider" && (
              <Button variant="ghost" onClick={handleBack}>
                <ChevronLeft className="size-4 mr-1" />
                {t("com_back")}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              {t("com_cancel")}
            </Button>
            {step === "model" ? (
              <Button
                onClick={handleSave}
                disabled={!canProceed() || saveMutation.isPending}
              >
                {saveMutation.isPending && (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                )}
                {t("llm_save_model")}
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={!canProceed()}>
                {t("com_continue")}
                <ChevronRight className="size-4 ml-1" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
