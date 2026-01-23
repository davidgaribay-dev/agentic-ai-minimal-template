/**
 * Organization RAG settings component using the new SettingsCard pattern.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FileSearch,
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
import { Badge } from "@/components/ui/badge";
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
  useOrgRAGSettings,
  useUpdateOrgRAGSettings,
  useDocuments,
} from "@/lib/queries";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentList } from "@/components/documents/document-list";
import { SettingsCard } from "./settings-layout";
import type { OrganizationRAGSettingsUpdate } from "@/lib/api";
import { testId } from "@/lib/test-id";

interface OrgRAGSettingsProps {
  orgId: string;
}

export function OrgRAGSettings({ orgId }: OrgRAGSettingsProps) {
  const { t } = useTranslation();
  const { data: orgSettings, isLoading } = useOrgRAGSettings(orgId);
  const updateMutation = useUpdateOrgRAGSettings(orgId);
  const { refetch: refetchDocuments } = useDocuments({
    organization_id: orgId,
  });

  const [settingsOpen, setSettingsOpen] = useState(true);
  const [documentsOpen, setDocumentsOpen] = useState(true);

  const handleUpdate = (updates: OrganizationRAGSettingsUpdate) => {
    updateMutation.mutate(updates);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!orgSettings) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{t("rag_failed_load")}</AlertDescription>
      </Alert>
    );
  }

  const ragEnabled = orgSettings.rag_enabled;
  const ragCustomizationEnabled = orgSettings.rag_customization_enabled;

  return (
    <div className="space-y-4" {...testId("org-rag-settings")}>
      {/* Master toggle and settings card */}
      <SettingsCard>
        <div className="p-4 space-y-4">
          {/* Main toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 pr-4">
              <div className="flex items-center gap-2">
                <FileSearch className="size-4" />
                <Label htmlFor="rag-enabled" className="text-sm font-medium">
                  {t("rag_title")}
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("rag_enable_desc")}
              </p>
            </div>
            <Switch
              {...testId("org-rag-enabled-toggle")}
              id="rag-enabled"
              checked={ragEnabled}
              onCheckedChange={(checked) =>
                handleUpdate({ rag_enabled: checked })
              }
              disabled={updateMutation.isPending}
            />
          </div>

          {/* Override controls */}
          <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
            <div className="text-sm font-medium">
              {t("rag_customization_controls")}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="rag-customization-enabled"
                    className="text-sm"
                  >
                    {t("rag_allow_customization")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("rag_allow_customization_desc")}
                  </p>
                </div>
                <Switch
                  id="rag-customization-enabled"
                  checked={ragCustomizationEnabled}
                  onCheckedChange={(checked) =>
                    handleUpdate({ rag_customization_enabled: checked })
                  }
                  disabled={!ragEnabled || updateMutation.isPending}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="allow-team-customization" className="text-sm">
                    {t("rag_team_customization")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("rag_team_customization_desc")}
                  </p>
                </div>
                <Switch
                  id="allow-team-customization"
                  checked={orgSettings.allow_team_customization}
                  onCheckedChange={(checked) =>
                    handleUpdate({ allow_team_customization: checked })
                  }
                  disabled={
                    !ragEnabled ||
                    !ragCustomizationEnabled ||
                    updateMutation.isPending
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="allow-user-customization" className="text-sm">
                    {t("rag_user_customization")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("rag_user_customization_desc")}
                  </p>
                </div>
                <Switch
                  id="allow-user-customization"
                  checked={orgSettings.allow_user_customization}
                  onCheckedChange={(checked) =>
                    handleUpdate({ allow_user_customization: checked })
                  }
                  disabled={
                    !ragEnabled ||
                    !ragCustomizationEnabled ||
                    updateMutation.isPending
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* Processing settings card */}
      <SettingsCard>
        <div className="p-4">
          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium hover:text-foreground/80">
              <Info className="size-4" />
              {t("rag_processing_settings")}
              {settingsOpen ? (
                <ChevronDown className="size-4 ml-auto text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 ml-auto text-muted-foreground" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              {/* Processing Settings */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label
                          htmlFor="chunk-size"
                          className="flex items-center gap-1 text-sm"
                        >
                          {t("rag_chunk_size")}
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </Label>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{t("rag_chunk_size_desc")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Input
                    id="chunk-size"
                    type="number"
                    min={100}
                    max={4000}
                    value={orgSettings.chunk_size}
                    onChange={(e) =>
                      handleUpdate({ chunk_size: parseInt(e.target.value, 10) })
                    }
                    disabled={!ragEnabled || updateMutation.isPending}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("rag_chunk_size_recommended")}
                  </p>
                </div>

                <div className="space-y-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label
                          htmlFor="chunk-overlap"
                          className="flex items-center gap-1 text-sm"
                        >
                          {t("rag_chunk_overlap")}
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </Label>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          {t("rag_chunk_overlap_desc")}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Input
                    id="chunk-overlap"
                    type="number"
                    min={0}
                    max={1000}
                    value={orgSettings.chunk_overlap}
                    onChange={(e) =>
                      handleUpdate({
                        chunk_overlap: parseInt(e.target.value, 10),
                      })
                    }
                    disabled={!ragEnabled || updateMutation.isPending}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("rag_chunk_overlap_recommended")}
                  </p>
                </div>
              </div>

              {/* Search Settings */}
              <div className="pt-2">
                <h4 className="text-sm font-medium mb-3">
                  {t("rag_search_settings")}
                </h4>
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
                      value={orgSettings.chunks_per_query}
                      onChange={(e) =>
                        handleUpdate({
                          chunks_per_query: parseInt(e.target.value, 10),
                        })
                      }
                      disabled={!ragEnabled || updateMutation.isPending}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("rag_results_recommended")}
                    </p>
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
                      value={orgSettings.similarity_threshold}
                      onChange={(e) =>
                        handleUpdate({
                          similarity_threshold: parseFloat(e.target.value),
                        })
                      }
                      disabled={!ragEnabled || updateMutation.isPending}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("rag_similarity_recommended")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Resource Limits */}
              <div className="pt-2">
                <h4 className="text-sm font-medium mb-3">
                  {t("rag_resource_limits")}
                </h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="max-documents" className="text-sm">
                      {t("rag_max_docs_per_user")}
                    </Label>
                    <Input
                      id="max-documents"
                      type="number"
                      min={1}
                      max={10000}
                      value={orgSettings.max_documents_per_user}
                      onChange={(e) =>
                        handleUpdate({
                          max_documents_per_user: parseInt(e.target.value, 10),
                        })
                      }
                      disabled={!ragEnabled || updateMutation.isPending}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("rag_max_docs_desc")}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max-size" className="text-sm">
                      {t("rag_max_doc_size")}
                    </Label>
                    <Input
                      id="max-size"
                      type="number"
                      min={1}
                      max={500}
                      value={orgSettings.max_document_size_mb}
                      onChange={(e) =>
                        handleUpdate({
                          max_document_size_mb: parseInt(e.target.value, 10),
                        })
                      }
                      disabled={!ragEnabled || updateMutation.isPending}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("rag_max_doc_size_desc")}
                    </p>
                  </div>
                </div>
              </div>

              {/* File Types */}
              <div className="pt-2">
                <h4 className="text-sm font-medium mb-3">
                  {t("rag_supported_types")}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {orgSettings.allowed_file_types.slice(0, 15).map((type) => (
                    <Badge key={type} variant="secondary">
                      {type}
                    </Badge>
                  ))}
                  {orgSettings.allowed_file_types.length > 15 && (
                    <Badge variant="outline">
                      {t("com_more_count", {
                        count: orgSettings.allowed_file_types.length - 15,
                      })}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {t("rag_types_count", {
                    count: orgSettings.allowed_file_types.length,
                  })}
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </SettingsCard>

      {/* Organization Documents Section */}
      <SettingsCard>
        <div className="p-4">
          <Collapsible open={documentsOpen} onOpenChange={setDocumentsOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium hover:text-foreground/80">
              <Upload className="size-4" />
              {t("rag_org_documents")}
              {documentsOpen ? (
                <ChevronDown className="size-4 ml-auto text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 ml-auto text-muted-foreground" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                {t("rag_org_documents_desc")}
              </p>
              {ragEnabled ? (
                <>
                  <DocumentUpload
                    orgId={orgId}
                    fixedScope="org"
                    onUploadComplete={() => refetchDocuments()}
                  />
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium mb-4">
                      {t("rag_uploaded_documents")}
                    </h4>
                    <DocumentList orgId={orgId} scope="org" />
                  </div>
                </>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {t("rag_enable_to_upload", {
                      scope: t("com_organization").toLowerCase(),
                    })}
                  </AlertDescription>
                </Alert>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </SettingsCard>
    </div>
  );
}
