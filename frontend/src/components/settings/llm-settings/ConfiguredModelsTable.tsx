/**
 * Data table showing configured LLM models.
 *
 * Displays the default model in a proper data table format with columns for:
 * - Model name with provider icon
 * - Provider
 * - Temperature
 * - Status (default)
 * - Actions (edit, delete)
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { Star, MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { DataTable } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import type { BuiltInModels } from "@/lib/api";

// Provider styling
const PROVIDER_STYLES: Record<
  string,
  { icon: string; color: string; name: string }
> = {
  anthropic: {
    icon: "🤖",
    color: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    name: "Anthropic",
  },
  openai: {
    icon: "🧠",
    color: "bg-green-500/15 text-green-600 dark:text-green-400",
    name: "OpenAI",
  },
  google: {
    icon: "✨",
    color: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    name: "Google",
  },
  custom: {
    icon: "🔧",
    color: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
    name: "Custom",
  },
};

interface ConfiguredModel {
  id: string;
  provider: string;
  modelId: string;
  modelName: string;
  displayName: string | null;
  temperature: number;
  isDefault: boolean;
}

interface ConfiguredModelsTableProps {
  builtInModels: BuiltInModels | undefined;
  defaultProvider: string;
  defaultModel: string;
  defaultModelDisplayName: string | null;
  defaultTemperature: number;
  enabledProviders: string[];
  onSetDefault: (provider: string, model: string) => void;
  onEdit: (
    provider: string,
    model: string,
    temperature: number,
    displayName: string | null,
  ) => void;
  onDelete?: () => void;
  isUpdating?: boolean;
}

export function ConfiguredModelsTable({
  builtInModels,
  defaultProvider,
  defaultModel,
  defaultModelDisplayName,
  defaultTemperature,
  onEdit,
  onDelete,
  isUpdating = false,
}: ConfiguredModelsTableProps) {
  const { t } = useTranslation();
  const [editingModel, setEditingModel] = useState<ConfiguredModel | null>(
    null,
  );
  const [editTemperature, setEditTemperature] = useState(0.7);
  const [editDisplayName, setEditDisplayName] = useState<string>("");
  const [deletingModel, setDeletingModel] = useState<ConfiguredModel | null>(
    null,
  );

  // Build list of configured models - currently shows the default model
  const configuredModels = useMemo<ConfiguredModel[]>(() => {
    if (!builtInModels || !defaultProvider || !defaultModel) return [];

    const providerModels = builtInModels[defaultProvider];
    if (!providerModels) return [];

    const model = providerModels.find((m) => m.id === defaultModel);
    if (!model) return [];

    return [
      {
        id: `${defaultProvider}:${model.id}`,
        provider: defaultProvider,
        modelId: model.id,
        modelName: model.name,
        displayName: defaultModelDisplayName,
        temperature: defaultTemperature,
        isDefault: true,
      },
    ];
  }, [
    builtInModels,
    defaultProvider,
    defaultModel,
    defaultModelDisplayName,
    defaultTemperature,
  ]);

  const handleOpenEdit = (model: ConfiguredModel) => {
    setEditTemperature(model.temperature);
    setEditDisplayName(model.displayName ?? "");
    setEditingModel(model);
  };

  const handleSaveEdit = () => {
    if (editingModel) {
      const displayName = editDisplayName.trim() || null;
      onEdit(
        editingModel.provider,
        editingModel.modelId,
        editTemperature,
        displayName,
      );
      setEditingModel(null);
    }
  };

  const handleConfirmDelete = () => {
    if (deletingModel && onDelete) {
      onDelete();
      setDeletingModel(null);
    }
  };

  const columns: ColumnDef<ConfiguredModel>[] = useMemo(
    () => [
      {
        accessorKey: "modelName",
        header: t("llm_model"),
        cell: ({ row }) => {
          const model = row.original;
          const style =
            PROVIDER_STYLES[model.provider] || PROVIDER_STYLES.custom;
          return (
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex size-7 items-center justify-center rounded-full",
                  style.color,
                )}
              >
                <span className="text-sm">{style.icon}</span>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {model.displayName || model.modelName}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {model.displayName ? model.modelName : model.modelId}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "provider",
        header: t("llm_provider"),
        cell: ({ row }) => {
          const provider = row.original.provider;
          const style = PROVIDER_STYLES[provider] || PROVIDER_STYLES.custom;
          return <span className="text-sm">{style.name}</span>;
        },
      },
      {
        accessorKey: "temperature",
        header: t("llm_temperature"),
        cell: ({ row }) => (
          <span className="text-sm">{row.original.temperature.toFixed(1)}</span>
        ),
      },
      {
        accessorKey: "isDefault",
        header: t("com_status"),
        cell: ({ row }) =>
          row.original.isDefault ? (
            <Badge
              variant="secondary"
              className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0 text-xs h-5"
            >
              <Star className="mr-1 size-2.5 fill-current" />
              {t("llm_default")}
            </Badge>
          ) : null,
      },
      {
        id: "actions",
        header: () => <div className="text-right">{t("com_actions")}</div>,
        cell: ({ row }) => {
          const model = row.original;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7">
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => handleOpenEdit(model)}>
                    <Pencil className="mr-2 size-3.5" />
                    {t("llm_edit_model")}
                  </DropdownMenuItem>
                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeletingModel(model)}
                      >
                        <Trash2 className="mr-2 size-3.5" />
                        {t("llm_delete_model")}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [t, onDelete],
  );

  if (configuredModels.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        {t("llm_no_models_configured")}
      </p>
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={configuredModels}
        searchKey="modelName"
        searchPlaceholder={t("llm_search_models")}
      />

      {/* Edit Model Dialog */}
      <Dialog
        open={!!editingModel}
        onOpenChange={(open) => !open && setEditingModel(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("llm_edit_model")}</DialogTitle>
            <DialogDescription>
              {t("llm_edit_model_desc", {
                model: editingModel?.modelName ?? "",
              })}
            </DialogDescription>
          </DialogHeader>

          {editingModel && (
            <div className="space-y-4 py-4">
              {/* Model info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full",
                    PROVIDER_STYLES[editingModel.provider]?.color ||
                      PROVIDER_STYLES.custom.color,
                  )}
                >
                  <span className="text-lg">
                    {PROVIDER_STYLES[editingModel.provider]?.icon ||
                      PROVIDER_STYLES.custom.icon}
                  </span>
                </div>
                <div>
                  <div className="font-medium">{editingModel.modelName}</div>
                  <div className="text-xs text-muted-foreground">
                    {PROVIDER_STYLES[editingModel.provider]?.name ||
                      editingModel.provider}
                  </div>
                </div>
              </div>

              {/* Display name input */}
              <div className="space-y-2">
                <Label htmlFor="displayName">{t("llm_display_name")}</Label>
                <Input
                  id="displayName"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder={editingModel.modelName}
                />
                <p className="text-xs text-muted-foreground">
                  {t("llm_display_name_desc")}
                </p>
              </div>

              {/* Temperature slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{t("llm_temperature")}</Label>
                  <span className="text-sm text-muted-foreground">
                    {editTemperature.toFixed(1)}
                  </span>
                </div>
                <Slider
                  value={[editTemperature]}
                  onValueChange={(values) => setEditTemperature(values[0])}
                  min={0}
                  max={2}
                  step={0.1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  {t("llm_temperature_desc")}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingModel(null)}>
              {t("com_cancel")}
            </Button>
            <Button onClick={handleSaveEdit} disabled={isUpdating}>
              {isUpdating && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t("com_save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingModel}
        onOpenChange={(open) => !open && setDeletingModel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("llm_delete_model_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("llm_delete_model_desc", {
                model: deletingModel?.modelName ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("com_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isUpdating}
            >
              {isUpdating && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t("com_delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
