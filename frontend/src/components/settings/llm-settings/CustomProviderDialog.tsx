/**
 * Dialog for adding/editing custom OpenAI-compatible LLM providers.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, CheckCircle, XCircle } from "lucide-react";

import {
  llmSettingsApi,
  type CustomLLMProvider,
  type CustomLLMProviderCreate,
  type CustomLLMProviderUpdate,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SettingsCard } from "../settings-layout";

interface CustomProviderDialogProps {
  orgId: string;
  teamId?: string;
  provider?: CustomLLMProvider;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function CustomProviderDialog({
  orgId,
  teamId,
  provider,
  trigger,
  onSuccess,
}: CustomProviderDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEditing = !!provider;

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(provider?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(provider?.base_url ?? "");
  const [apiKey, setApiKey] = useState("");
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [testMessage, setTestMessage] = useState("");

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CustomLLMProviderCreate) =>
      llmSettingsApi.createCustomProvider(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["custom-llm-providers", orgId],
      });
      setOpen(false);
      resetForm();
      onSuccess?.();
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: CustomLLMProviderUpdate) =>
      llmSettingsApi.updateCustomProvider(orgId, provider!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["custom-llm-providers", orgId],
      });
      setOpen(false);
      resetForm();
      onSuccess?.();
    },
  });

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: () => llmSettingsApi.testCustomProvider(orgId, provider!.id),
    onSuccess: (result) => {
      setTestStatus(result.status === "success" ? "success" : "error");
      setTestMessage(result.message);
    },
    onError: (error: Error) => {
      setTestStatus("error");
      setTestMessage(error.message);
    },
  });

  const resetForm = () => {
    if (!isEditing) {
      setName("");
      setBaseUrl("");
      setApiKey("");
    }
    setTestStatus("idle");
    setTestMessage("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditing) {
      const updateData: CustomLLMProviderUpdate = {
        name: name !== provider.name ? name : undefined,
        base_url: baseUrl !== provider.base_url ? baseUrl : undefined,
        api_key: apiKey || undefined,
      };
      updateMutation.mutate(updateData);
    } else {
      const createData: CustomLLMProviderCreate = {
        name,
        base_url: baseUrl,
        api_key: apiKey || undefined,
        team_id: teamId,
      };
      createMutation.mutate(createData);
    }
  };

  const handleTest = () => {
    if (!provider) return;
    setTestStatus("testing");
    testMutation.mutate();
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const canSubmit = name.trim() && baseUrl.trim() && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Plus className="size-4 mr-2" />
            {t("llm_add_provider")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? t("llm_edit_provider") : t("llm_add_provider")}
            </DialogTitle>
            <DialogDescription>
              {t("llm_custom_provider_desc")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="provider-name">{t("llm_provider_name")}</Label>
              <Input
                id="provider-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ollama, LiteLLM, etc."
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider-url">{t("llm_provider_base_url")}</Label>
              <Input
                id="provider-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                {t("llm_base_url_hint")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider-key">{t("llm_provider_api_key")}</Label>
              <Input
                id="provider-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={isEditing ? "••••••••" : t("llm_api_key_optional")}
                disabled={isSubmitting}
              />
              {isEditing && provider.has_api_key && (
                <p className="text-xs text-muted-foreground">
                  {t("llm_api_key_set")}
                </p>
              )}
            </div>

            {/* Test connection (only for existing providers) */}
            {isEditing && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTest}
                    disabled={testStatus === "testing"}
                  >
                    {testStatus === "testing" ? (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    ) : null}
                    {t("llm_test_connection")}
                  </Button>
                  {testStatus === "success" && (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <CheckCircle className="size-4" />
                      {t("llm_connection_success")}
                    </span>
                  )}
                  {testStatus === "error" && (
                    <span className="flex items-center gap-1 text-sm text-destructive">
                      <XCircle className="size-4" />
                      {t("llm_connection_failed")}
                    </span>
                  )}
                </div>
                {testMessage && testStatus === "error" && (
                  <p className="text-xs text-destructive">{testMessage}</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              {t("com_cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
              {isEditing ? t("com_save") : t("com_create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface CustomProviderListProps {
  orgId: string;
  teamId?: string;
  providers: CustomLLMProvider[];
  isLoading?: boolean;
}

export function CustomProviderList({
  orgId,
  teamId,
  providers,
  isLoading,
}: CustomProviderListProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (providerId: string) =>
      llmSettingsApi.deleteCustomProvider(orgId, providerId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["custom-llm-providers", orgId],
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({
      providerId,
      enabled,
    }: {
      providerId: string;
      enabled: boolean;
    }) =>
      llmSettingsApi.updateCustomProvider(orgId, providerId, {
        is_enabled: enabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["custom-llm-providers", orgId],
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        {t("llm_no_custom_providers")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {providers.map((provider) => (
        <SettingsCard key={provider.id}>
          <div className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{provider.name}</span>
                {!provider.is_enabled && (
                  <span className="text-xs text-muted-foreground">
                    ({t("com_disabled")})
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {provider.base_url}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={provider.is_enabled}
                onCheckedChange={(enabled) =>
                  toggleMutation.mutate({ providerId: provider.id, enabled })
                }
                disabled={toggleMutation.isPending}
              />
              <CustomProviderDialog
                orgId={orgId}
                teamId={teamId}
                provider={provider}
                trigger={
                  <Button variant="ghost" size="sm">
                    {t("com_edit")}
                  </Button>
                }
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t("llm_delete_provider_title")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("llm_delete_provider_desc", { name: provider.name })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("com_cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate(provider.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t("com_delete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </SettingsCard>
      ))}
    </div>
  );
}
