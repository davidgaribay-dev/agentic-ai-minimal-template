/**
 * LLM permissions form component.
 *
 * Shows only the permission toggles for org-level settings:
 * - Allow team customization
 * - Allow user customization
 * - Allow per-request model selection
 */

import { useTranslation } from "react-i18next";
import { Shield } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SettingsCard } from "../settings-layout";

interface LLMPermissionsFormProps {
  allowTeamCustomization: boolean;
  allowPerRequestSelection: boolean;
  isLoading?: boolean;
  onUpdate: (data: {
    allow_team_customization?: boolean;
    allow_per_request_model_selection?: boolean;
  }) => void;
}

export function LLMPermissionsForm({
  allowTeamCustomization,
  allowPerRequestSelection,
  isLoading = false,
  onUpdate,
}: LLMPermissionsFormProps) {
  const { t } = useTranslation();

  return (
    <SettingsCard>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Shield className="size-4" />
          {t("llm_permissions")}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("llm_permissions_desc")}
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="allow-team" className="text-sm font-medium">
                {t("llm_allow_team_customization")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("llm_allow_team_customization_desc")}
              </p>
            </div>
            <Switch
              id="allow-team"
              checked={allowTeamCustomization}
              onCheckedChange={(v) => onUpdate({ allow_team_customization: v })}
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label
                htmlFor="allow-per-request"
                className="text-sm font-medium"
              >
                {t("llm_allow_per_request_selection")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("llm_allow_per_request_selection_desc")}
              </p>
            </div>
            <Switch
              id="allow-per-request"
              checked={allowPerRequestSelection}
              onCheckedChange={(v) =>
                onUpdate({ allow_per_request_model_selection: v })
              }
              disabled={isLoading}
            />
          </div>
        </div>
      </div>
    </SettingsCard>
  );
}
