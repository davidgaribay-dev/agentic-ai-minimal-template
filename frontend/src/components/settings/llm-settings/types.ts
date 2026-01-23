/**
 * Types for LLM settings components.
 */

import type {
  LLMSettingsUpdateBase,
  OrganizationLLMSettingsUpdate,
  TeamLLMSettingsUpdate,
  UserLLMSettingsUpdate,
  ModelInfo,
} from "@/lib/api";

/** Re-export base type for use in components */
export type { LLMSettingsUpdateBase };

export type SettingsLevel = "org" | "team" | "user";
export type DisabledByLevel = "org" | "team" | null;

export interface LLMSettingsBaseProps {
  /** Current default provider */
  defaultProvider: string;
  /** Current default model */
  defaultModel: string;
  /** Current default temperature */
  defaultTemperature: number;
  /** Current max tokens */
  defaultMaxTokens: number | null;
  /** Available models for selection */
  availableModels: ModelInfo[];
  /** Loading state */
  isLoading?: boolean;
  /** Which higher level disabled customization */
  disabledBy?: DisabledByLevel;
  /** Settings level */
  level: SettingsLevel;
}

export interface OrgLLMSettingsProps extends LLMSettingsBaseProps {
  level: "org";
  orgId: string;
  /** Whether teams can customize */
  allowTeamCustomization: boolean;
  /** Whether users can customize */
  allowUserCustomization: boolean;
  /** Whether per-request model selection is allowed */
  allowPerRequestSelection: boolean;
  /** Enabled providers */
  enabledProviders: string[];
  /** Disabled models */
  disabledModels: string[];
  /** Fallback enabled */
  fallbackEnabled: boolean;
  /** Fallback models */
  fallbackModels: string[];
  /** Update handler */
  onUpdate: (data: OrganizationLLMSettingsUpdate) => void;
}

export interface TeamLLMSettingsProps extends LLMSettingsBaseProps {
  level: "team";
  orgId: string;
  teamId: string;
  /** Whether users can customize */
  allowUserCustomization: boolean;
  /** Disabled models at team level */
  disabledModels: string[];
  /** Update handler */
  onUpdate: (data: TeamLLMSettingsUpdate) => void;
}

export interface UserLLMSettingsProps extends LLMSettingsBaseProps {
  level: "user";
  /** Update handler */
  onUpdate: (data: UserLLMSettingsUpdate) => void;
}

export type LLMSettingsProps =
  | OrgLLMSettingsProps
  | TeamLLMSettingsProps
  | UserLLMSettingsProps;

/** Built-in provider options */
export const PROVIDER_OPTIONS = [
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI (GPT)" },
  { value: "google", label: "Google (Gemini)" },
] as const;
