/**
 * Dialog for adding or editing an LLM provider API key.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Eye, EyeOff, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { llmSettingsApi } from "@/lib/api";

// Provider documentation URLs for getting API keys
const PROVIDER_DOCS: Record<string, string> = {
  anthropic: "https://console.anthropic.com/settings/keys",
  openai: "https://platform.openai.com/api-keys",
  google: "https://aistudio.google.com/app/apikey",
};

interface EditApiKeyDialogProps {
  orgId: string;
  provider: string;
  providerName: string;
  hasExistingKey: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditApiKeyDialog({
  orgId,
  provider,
  providerName,
  hasExistingKey,
  open,
  onOpenChange,
  onSuccess,
}: EditApiKeyDialogProps) {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Save API key mutation
  const saveMutation = useMutation({
    mutationFn: async (key: string) => {
      await llmSettingsApi.setProviderApiKey(orgId, provider, key);
    },
    onSuccess: () => {
      setApiKey("");
      setError(null);
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message || t("error_failed_to_save"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError(t("llm_api_key_required"));
      return;
    }
    setError(null);
    saveMutation.mutate(apiKey.trim());
  };

  const handleClose = () => {
    setApiKey("");
    setShowKey(false);
    setError(null);
    onOpenChange(false);
  };

  const docsUrl = PROVIDER_DOCS[provider];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {hasExistingKey
                ? t("llm_update_api_key_title", { provider: providerName })
                : t("llm_add_api_key_title", { provider: providerName })}
            </DialogTitle>
            <DialogDescription>
              {hasExistingKey
                ? t("llm_update_api_key_desc")
                : t("llm_add_api_key_desc", { provider: providerName })}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">{t("llm_api_key")}</Label>
              <div className="relative">
                <Input
                  id="api-key"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    hasExistingKey
                      ? "••••••••••••••••"
                      : t("llm_api_key_placeholder")
                  }
                  className="pr-10"
                  autoComplete="off"
                  disabled={saveMutation.isPending}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? (
                    <EyeOff className="size-4 text-muted-foreground" />
                  ) : (
                    <Eye className="size-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {hasExistingKey && (
                <p className="text-xs text-muted-foreground">
                  {t("llm_api_key_update_hint")}
                </p>
              )}
            </div>

            {docsUrl && (
              <div className="text-sm">
                <a
                  href={docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {t("llm_get_api_key", { provider: providerName })}
                  <ExternalLink className="size-3" />
                </a>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={saveMutation.isPending}
            >
              {t("com_cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!apiKey.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              {hasExistingKey ? t("llm_update_key") : t("llm_save_key")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
