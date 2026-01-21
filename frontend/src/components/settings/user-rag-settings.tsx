/**
 * User RAG settings component using the new SettingsCard pattern.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  User,
  Info,
  Upload,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  useUserRAGSettings,
  useUpdateUserRAGSettings,
  useDocuments,
} from "@/lib/queries";
import { useWorkspace } from "@/lib/workspace";
import { useAuth } from "@/lib/auth";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentList } from "@/components/documents/document-list";
import { SettingsCard } from "./settings-layout";
import type { UserRAGSettingsUpdate } from "@/lib/api";

export function UserRAGSettings() {
  const { t } = useTranslation();
  const { data: userSettings, isLoading } = useUserRAGSettings();
  const updateMutation = useUpdateUserRAGSettings();
  const { currentOrg, currentTeam } = useWorkspace();
  const { user } = useAuth();
  const { refetch: refetchDocuments } = useDocuments({
    organization_id: currentOrg?.id ?? "",
    team_id: currentTeam?.id,
  });

  const [settingsOpen, setSettingsOpen] = useState(true);
  const [documentsOpen, setDocumentsOpen] = useState(true);

  const handleUpdate = (updates: UserRAGSettingsUpdate) => {
    updateMutation.mutate(updates);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!userSettings) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{t("rag_failed_load")}</AlertDescription>
      </Alert>
    );
  }

  const ragEnabled = userSettings.rag_enabled;

  return (
    <div className="space-y-4">
      {/* Master toggle card */}
      <SettingsCard>
        <div className="p-4 space-y-4">
          {/* Main toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 pr-4">
              <div className="flex items-center gap-2">
                <User className="size-4" />
                <Label htmlFor="rag-enabled" className="text-sm font-medium">
                  {t("rag_user_title")}
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("rag_user_desc")}
              </p>
            </div>
            <Switch
              id="rag-enabled"
              checked={ragEnabled}
              onCheckedChange={(checked) =>
                handleUpdate({ rag_enabled: checked })
              }
              disabled={updateMutation.isPending}
            />
          </div>
        </div>
      </SettingsCard>

      {/* Search preferences card */}
      <SettingsCard>
        <div className="p-4">
          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium hover:text-foreground/80">
              <Info className="size-4" />
              {t("rag_search_preferences")}
              {settingsOpen ? (
                <ChevronDown className="size-4 ml-auto text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 ml-auto text-muted-foreground" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label
                          htmlFor="chunks-per-query"
                          className="flex items-center gap-1 text-sm"
                        >
                          {t("rag_results_per_query")}
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </Label>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          {t("rag_results_per_query_desc")}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Input
                    id="chunks-per-query"
                    type="number"
                    min={1}
                    max={20}
                    value={userSettings.chunks_per_query}
                    onChange={(e) =>
                      handleUpdate({
                        chunks_per_query: parseInt(e.target.value, 10),
                      })
                    }
                    disabled={!ragEnabled || updateMutation.isPending}
                  />
                </div>

                <div className="space-y-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label
                          htmlFor="similarity-threshold"
                          className="flex items-center gap-1 text-sm"
                        >
                          {t("rag_similarity_threshold")}
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </Label>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          {t("rag_similarity_threshold_desc")}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Input
                    id="similarity-threshold"
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={userSettings.similarity_threshold}
                    onChange={(e) =>
                      handleUpdate({
                        similarity_threshold: parseFloat(e.target.value),
                      })
                    }
                    disabled={!ragEnabled || updateMutation.isPending}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </SettingsCard>

      {/* Personal Documents Section */}
      <SettingsCard>
        <div className="p-4">
          <Collapsible open={documentsOpen} onOpenChange={setDocumentsOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium hover:text-foreground/80">
              <Upload className="size-4" />
              {t("rag_personal_documents")}
              {documentsOpen ? (
                <ChevronDown className="size-4 ml-auto text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 ml-auto text-muted-foreground" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                {t("rag_personal_documents_desc")}
              </p>
              {!currentOrg || !currentTeam ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {t("rag_select_org_team")}
                  </AlertDescription>
                </Alert>
              ) : !ragEnabled ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {t("rag_enable_to_upload_personal")}
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <DocumentUpload
                    orgId={currentOrg.id}
                    teamId={currentTeam.id}
                    fixedScope="user"
                    onUploadComplete={() => refetchDocuments()}
                  />
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium mb-4">
                      {t("rag_your_documents")}
                    </h4>
                    <DocumentList
                      orgId={currentOrg.id}
                      teamId={currentTeam.id}
                      scope="user"
                      userId={user?.id}
                    />
                  </div>
                </>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </SettingsCard>
    </div>
  );
}
