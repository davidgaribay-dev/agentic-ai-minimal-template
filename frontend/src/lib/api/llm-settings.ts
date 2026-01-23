/**
 * LLM Settings API module.
 *
 * Handles LLM provider and model configuration at organization, team, and user levels.
 * Supports hierarchical settings with custom OpenAI-compatible endpoints.
 */

import { apiClient, getAuthHeader } from "./client";

export type LLMProvider = "anthropic" | "openai" | "google" | "custom";

export interface ModelCapability {
  TOOL_CALLING: "tool_calling";
  VISION: "vision";
  STREAMING: "streaming";
  STRUCTURED_OUTPUT: "structured_output";
  REASONING: "reasoning";
  LONG_CONTEXT: "long_context";
  DOCUMENT: "document";
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  capabilities: string[];
  max_context_tokens?: number;
  max_output_tokens?: number;
  is_custom: boolean;
  custom_provider_id?: string;
}

export interface LLMSettingsBase {
  default_provider: string;
  default_model: string;
  default_model_display_name: string | null;
  default_temperature: number;
  default_max_tokens: number | null;
  default_top_p: number;
}

export interface OrganizationLLMSettings extends LLMSettingsBase {
  id: string;
  organization_id: string;
  fallback_enabled: boolean;
  fallback_models: string[];
  allow_team_customization: boolean;
  allow_user_customization: boolean;
  allow_per_request_model_selection: boolean;
  enabled_providers: string[];
  disabled_models: string[];
  created_at: string;
  updated_at: string;
}

export interface TeamLLMSettings {
  id: string;
  team_id: string;
  default_provider: string | null;
  default_model: string | null;
  default_temperature: number | null;
  default_max_tokens: number | null;
  allow_user_customization: boolean;
  disabled_models: string[];
  created_at: string;
  updated_at: string;
}

export interface UserLLMSettings {
  id: string;
  user_id: string;
  preferred_provider: string | null;
  preferred_model: string | null;
  preferred_temperature: number | null;
  created_at: string;
  updated_at: string;
}

/** Common update fields shared between org and team levels */
export interface LLMSettingsUpdateBase {
  default_provider?: string | null;
  default_model?: string | null;
  default_temperature?: number | null;
}

export interface OrganizationLLMSettingsUpdate extends LLMSettingsUpdateBase {
  default_model_display_name?: string | null;
  default_max_tokens?: number | null;
  default_top_p?: number;
  fallback_enabled?: boolean;
  fallback_models?: string[];
  allow_team_customization?: boolean;
  allow_user_customization?: boolean;
  allow_per_request_model_selection?: boolean;
  enabled_providers?: string[];
  disabled_models?: string[];
}

export interface TeamLLMSettingsUpdate extends LLMSettingsUpdateBase {
  default_max_tokens?: number | null;
  allow_user_customization?: boolean;
  disabled_models?: string[];
}

export interface UserLLMSettingsUpdate {
  preferred_provider?: string | null;
  preferred_model?: string | null;
  preferred_temperature?: number | null;
}

export type SettingsSource = "org" | "team" | "user";

export interface EffectiveLLMSettings {
  provider: string;
  model: string;
  temperature: number;
  max_tokens: number | null;
  top_p: number;
  fallback_enabled: boolean;
  fallback_models: string[];
  available_providers: string[];
  available_models: ModelInfo[];
  can_change_model: boolean;
  can_change_parameters: boolean;
  per_request_selection_allowed: boolean;
  settings_source: SettingsSource;
}

export interface CustomLLMProvider {
  id: string;
  organization_id: string;
  team_id: string | null;
  name: string;
  provider_type: string;
  base_url: string;
  available_models: Array<{
    id: string;
    name: string;
    capabilities?: string[];
    max_context_tokens?: number;
    max_output_tokens?: number;
  }>;
  is_enabled: boolean;
  has_api_key: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomLLMProviderCreate {
  name: string;
  base_url: string;
  api_key?: string;
  available_models?: Array<{
    id: string;
    name: string;
    capabilities?: string[];
  }>;
  team_id?: string;
}

export interface CustomLLMProviderUpdate {
  name?: string;
  base_url?: string;
  api_key?: string;
  available_models?: Array<{
    id: string;
    name: string;
    capabilities?: string[];
  }>;
  is_enabled?: boolean;
}

export interface TestConnectionResult {
  status: "success" | "error";
  message: string;
}

export type BuiltInModels = Record<
  string,
  Array<{
    id: string;
    name: string;
    capabilities: string[];
    max_context_tokens?: number;
    max_output_tokens?: number;
  }>
>;

export const llmSettingsApi = {
  // -------------------------------------------------------------------------
  // Organization LLM Settings
  // -------------------------------------------------------------------------

  /** Get organization LLM settings */
  getOrgSettings: (orgId: string) =>
    apiClient.get<OrganizationLLMSettings>(
      `/v1/organizations/${orgId}/llm-settings`,
      { headers: getAuthHeader() },
    ),

  /** Update organization LLM settings */
  updateOrgSettings: (orgId: string, settings: OrganizationLLMSettingsUpdate) =>
    apiClient.put<OrganizationLLMSettings>(
      `/v1/organizations/${orgId}/llm-settings`,
      settings,
      { headers: getAuthHeader() },
    ),

  /** Get available models for the organization context */
  getAvailableModels: (orgId: string, teamId?: string) => {
    const params = new URLSearchParams();
    if (teamId) params.append("team_id", teamId);
    const queryString = params.toString();
    return apiClient.get<ModelInfo[]>(
      `/v1/organizations/${orgId}/llm-settings/available-models${queryString ? `?${queryString}` : ""}`,
      { headers: getAuthHeader() },
    );
  },

  // -------------------------------------------------------------------------
  // Team LLM Settings
  // -------------------------------------------------------------------------

  /** Get team LLM settings */
  getTeamSettings: (orgId: string, teamId: string) =>
    apiClient.get<TeamLLMSettings>(
      `/v1/organizations/${orgId}/teams/${teamId}/llm-settings`,
      { headers: getAuthHeader() },
    ),

  /** Update team LLM settings */
  updateTeamSettings: (
    orgId: string,
    teamId: string,
    settings: TeamLLMSettingsUpdate,
  ) =>
    apiClient.put<TeamLLMSettings>(
      `/v1/organizations/${orgId}/teams/${teamId}/llm-settings`,
      settings,
      { headers: getAuthHeader() },
    ),

  // -------------------------------------------------------------------------
  // User LLM Settings
  // -------------------------------------------------------------------------

  /** Get user LLM settings */
  getUserSettings: () =>
    apiClient.get<UserLLMSettings>("/v1/users/me/llm-settings", {
      headers: getAuthHeader(),
    }),

  /** Update user LLM settings */
  updateUserSettings: (settings: UserLLMSettingsUpdate) =>
    apiClient.put<UserLLMSettings>("/v1/users/me/llm-settings", settings, {
      headers: getAuthHeader(),
    }),

  // -------------------------------------------------------------------------
  // Effective Settings (Computed)
  // -------------------------------------------------------------------------

  /** Get effective LLM settings (computed from hierarchy) */
  getEffectiveSettings: (organizationId: string, teamId?: string) => {
    const params = new URLSearchParams();
    params.append("organization_id", organizationId);
    if (teamId) params.append("team_id", teamId);
    return apiClient.get<EffectiveLLMSettings>(
      `/v1/llm-settings/effective?${params.toString()}`,
      { headers: getAuthHeader() },
    );
  },

  // -------------------------------------------------------------------------
  // Built-in Models Reference
  // -------------------------------------------------------------------------

  /** Get catalog of built-in models by provider */
  getBuiltInModels: () =>
    apiClient.get<BuiltInModels>("/v1/llm-settings/built-in-models", {
      headers: getAuthHeader(),
    }),

  // -------------------------------------------------------------------------
  // Custom Providers
  // -------------------------------------------------------------------------

  /** List custom LLM providers for the organization */
  listCustomProviders: (orgId: string, teamId?: string) => {
    const params = new URLSearchParams();
    if (teamId) params.append("team_id", teamId);
    const queryString = params.toString();
    return apiClient.get<CustomLLMProvider[]>(
      `/v1/organizations/${orgId}/custom-providers${queryString ? `?${queryString}` : ""}`,
      { headers: getAuthHeader() },
    );
  },

  /** Create a custom LLM provider */
  createCustomProvider: (orgId: string, provider: CustomLLMProviderCreate) =>
    apiClient.post<CustomLLMProvider>(
      `/v1/organizations/${orgId}/custom-providers`,
      provider,
      { headers: getAuthHeader() },
    ),

  /** Get a custom LLM provider by ID */
  getCustomProvider: (orgId: string, providerId: string) =>
    apiClient.get<CustomLLMProvider>(
      `/v1/organizations/${orgId}/custom-providers/${providerId}`,
      { headers: getAuthHeader() },
    ),

  /** Update a custom LLM provider */
  updateCustomProvider: (
    orgId: string,
    providerId: string,
    updates: CustomLLMProviderUpdate,
  ) =>
    apiClient.put<CustomLLMProvider>(
      `/v1/organizations/${orgId}/custom-providers/${providerId}`,
      updates,
      { headers: getAuthHeader() },
    ),

  /** Delete a custom LLM provider */
  deleteCustomProvider: (orgId: string, providerId: string) =>
    apiClient.delete(
      `/v1/organizations/${orgId}/custom-providers/${providerId}`,
      {
        headers: getAuthHeader(),
      },
    ),

  /** Test connection to a custom LLM provider */
  testCustomProvider: (orgId: string, providerId: string) =>
    apiClient.post<TestConnectionResult>(
      `/v1/organizations/${orgId}/custom-providers/${providerId}/test`,
      {},
      { headers: getAuthHeader() },
    ),

  // -------------------------------------------------------------------------
  // Provider API Keys
  // -------------------------------------------------------------------------

  /** Get API key status for all built-in providers */
  getProviderApiKeyStatus: (orgId: string) =>
    apiClient.get<Record<string, boolean>>(
      `/v1/organizations/${orgId}/llm-settings/api-key-status`,
      { headers: getAuthHeader() },
    ),

  /** Set API key for a built-in provider */
  setProviderApiKey: (orgId: string, provider: string, apiKey: string) =>
    apiClient.put(
      `/v1/organizations/${orgId}/llm-settings/api-key/${provider}`,
      { api_key: apiKey },
      { headers: getAuthHeader() },
    ),

  /** Delete API key for a built-in provider */
  deleteProviderApiKey: (orgId: string, provider: string) =>
    apiClient.delete(
      `/v1/organizations/${orgId}/llm-settings/api-key/${provider}`,
      { headers: getAuthHeader() },
    ),

  // -------------------------------------------------------------------------
  // Team-level Provider API Keys
  // -------------------------------------------------------------------------

  /** Get API key status for all built-in providers at team level */
  getTeamProviderApiKeyStatus: (orgId: string, teamId: string) =>
    apiClient.get<Record<string, boolean>>(
      `/v1/organizations/${orgId}/teams/${teamId}/llm-settings/api-key-status`,
      { headers: getAuthHeader() },
    ),

  /** Set API key for a built-in provider at team level */
  setTeamProviderApiKey: (
    orgId: string,
    teamId: string,
    provider: string,
    apiKey: string,
  ) =>
    apiClient.put(
      `/v1/organizations/${orgId}/teams/${teamId}/llm-settings/api-key/${provider}`,
      { api_key: apiKey },
      { headers: getAuthHeader() },
    ),

  /** Delete API key for a built-in provider at team level */
  deleteTeamProviderApiKey: (orgId: string, teamId: string, provider: string) =>
    apiClient.delete(
      `/v1/organizations/${orgId}/teams/${teamId}/llm-settings/api-key/${provider}`,
      { headers: getAuthHeader() },
    ),
};
