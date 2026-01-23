import { apiTest as test, expect } from "../../../fixtures";
import { expectSuccessResponse } from "../../../utils/api-helpers";
import { logTestData } from "../../../utils/logger";
import type {
  ListResponse,
  Organization,
  Team,
} from "../../../utils";

/**
 * Settings API Tests
 *
 * Tests for hierarchical settings (RAG, Theme, LLM)
 * - RAG Settings: /v1/organizations/{org_id}/rag-settings, /v1/users/me/rag-settings
 * - Theme Settings: /v1/organizations/{org_id}/theme-settings, /v1/users/me/theme-settings
 * - LLM Settings: /v1/organizations/{org_id}/llm-settings, /v1/users/me/llm-settings
 */

// Actual backend schemas - RAG Settings
interface OrganizationRAGSettings {
  id: string;
  organization_id: string;
  rag_enabled: boolean;
  rag_customization_enabled: boolean;
  allow_team_customization: boolean;
  allow_user_customization: boolean;
  chunk_size: number;
  chunk_overlap: number;
  chunks_per_query: number;
  similarity_threshold: number;
  use_hybrid_search: boolean;
  reranking_enabled: boolean;
  query_rewriting_enabled: boolean;
  max_documents_per_user: number;
  max_document_size_mb: number;
  max_total_storage_gb: number;
  allowed_file_types: string[];
}

interface TeamRAGSettings {
  id: string;
  team_id: string;
  rag_enabled: boolean;
  rag_customization_enabled: boolean;
  allow_user_customization: boolean;
  chunk_size: number;
  chunk_overlap: number;
  chunks_per_query: number;
  similarity_threshold: number;
  use_hybrid_search: boolean;
  reranking_enabled: boolean;
  query_rewriting_enabled: boolean;
}

interface UserRAGSettings {
  id: string;
  user_id: string;
  rag_enabled: boolean;
  chunks_per_query: number;
  similarity_threshold: number;
}

interface EffectiveRAGSettings {
  rag_enabled: boolean;
  rag_disabled_by: string | null;
  chunk_size: number;
  chunk_overlap: number;
  chunks_per_query: number;
  similarity_threshold: number;
}

// Theme Settings interfaces - actual backend schema
interface OrganizationThemeSettings {
  id: string;
  organization_id: string;
  default_theme_mode: string;
  default_light_theme: string;
  default_dark_theme: string;
  custom_light_theme: Record<string, string> | null;
  custom_dark_theme: Record<string, string> | null;
  theme_customization_enabled: boolean;
  allow_team_customization: boolean;
  allow_user_customization: boolean;
  created_at: string;
  updated_at: string;
}

interface UserThemeSettings {
  id: string;
  user_id: string;
  theme_mode: string;
  light_theme: string;
  dark_theme: string;
  custom_light_theme: Record<string, string> | null;
  custom_dark_theme: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

interface PredefinedTheme {
  id: string;
  name: string;
  is_dark: boolean;
}

// LLM Settings interfaces
interface OrganizationLLMSettings {
  id: string;
  organization_id: string;
  default_provider: string;
  default_model: string;
  default_temperature: number;
  default_max_tokens: number | null;
  fallback_enabled: boolean;
  fallback_models: string[];
  allow_team_customization: boolean;
  allow_user_customization: boolean;
  allow_per_request_model_selection: boolean;
  enabled_providers: string[];
  disabled_models: string[];
}

interface TeamLLMSettings {
  id: string;
  team_id: string;
  default_provider: string | null;
  default_model: string | null;
  default_temperature: number | null;
  default_max_tokens: number | null;
  allow_user_customization: boolean;
  disabled_models: string[];
}

interface UserLLMSettings {
  id: string;
  user_id: string;
  preferred_provider: string | null;
  preferred_model: string | null;
  preferred_temperature: number | null;
}

// ================== RAG Settings Tests ==================

test.describe("RAG Settings API - Organization", () => {
  let orgId: string;

  test.beforeAll(async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get("/v1/organizations/");
    const data = await expectSuccessResponse<ListResponse<Organization>>(response);
    expect(data.data.length).toBeGreaterThan(0);
    orgId = data.data[0].id;
  });

  test("should get organization RAG settings", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/rag-settings`
    );

    const settings = await expectSuccessResponse<OrganizationRAGSettings>(response);

    expect(typeof settings.rag_enabled).toBe("boolean");
    expect(typeof settings.chunk_size).toBe("number");
    expect(typeof settings.similarity_threshold).toBe("number");
    expect(typeof settings.allow_team_customization).toBe("boolean");
  });

  test("should update organization RAG settings", async (
    { authenticatedApiContext },
    testInfo
  ) => {
    logTestData({ testName: testInfo.title, orgId });

    const response = await authenticatedApiContext.put(
      `/v1/organizations/${orgId}/rag-settings`,
      {
        data: {
          rag_enabled: true,
          chunk_size: 1000,
          similarity_threshold: 0.7,
        },
      }
    );

    const settings = await expectSuccessResponse<OrganizationRAGSettings>(response);

    expect(settings.rag_enabled).toBe(true);
    expect(settings.chunk_size).toBe(1000);
    expect(settings.similarity_threshold).toBe(0.7);
  });
});

test.describe("RAG Settings API - Team", () => {
  let orgId: string;
  let teamId: string;

  test.beforeAll(async ({ authenticatedApiContext }) => {
    const orgResponse = await authenticatedApiContext.get("/v1/organizations/");
    const orgData = await expectSuccessResponse<ListResponse<Organization>>(orgResponse);
    orgId = orgData.data[0].id;

    const teamsResponse = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/teams/`
    );
    const teamsData = await expectSuccessResponse<ListResponse<Team>>(teamsResponse);
    expect(teamsData.data.length).toBeGreaterThan(0);
    teamId = teamsData.data[0].id;
  });

  test("should get team RAG settings", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/teams/${teamId}/rag-settings`
    );

    const settings = await expectSuccessResponse<TeamRAGSettings>(response);

    expect(typeof settings.rag_enabled).toBe("boolean");
  });

  test("should update team RAG settings", async ({ authenticatedApiContext }, testInfo) => {
    logTestData({ testName: testInfo.title, teamId });

    const response = await authenticatedApiContext.put(
      `/v1/organizations/${orgId}/teams/${teamId}/rag-settings`,
      {
        data: {
          rag_enabled: true,
          chunks_per_query: 5,
        },
      }
    );

    const settings = await expectSuccessResponse<TeamRAGSettings>(response);

    expect(settings.rag_enabled).toBe(true);
    expect(settings.chunks_per_query).toBe(5);
  });
});

test.describe("RAG Settings API - User", () => {
  test("should get user RAG settings", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get("/v1/users/me/rag-settings");

    const settings = await expectSuccessResponse<UserRAGSettings>(response);

    expect(typeof settings.rag_enabled).toBe("boolean");
  });

  test("should update user RAG settings", async ({ authenticatedApiContext }, testInfo) => {
    logTestData({ testName: testInfo.title });

    const response = await authenticatedApiContext.put("/v1/users/me/rag-settings", {
      data: {
        rag_enabled: true,
        similarity_threshold: 0.8,
      },
    });

    const settings = await expectSuccessResponse<UserRAGSettings>(response);

    expect(settings.rag_enabled).toBe(true);
  });
});

test.describe("RAG Settings API - Effective", () => {
  let orgId: string;
  let teamId: string;

  test.beforeAll(async ({ authenticatedApiContext }) => {
    const orgResponse = await authenticatedApiContext.get("/v1/organizations/");
    const orgData = await expectSuccessResponse<ListResponse<Organization>>(orgResponse);
    orgId = orgData.data[0].id;

    const teamsResponse = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/teams/`
    );
    const teamsData = await expectSuccessResponse<ListResponse<Team>>(teamsResponse);
    teamId = teamsData.data[0].id;
  });

  test("should get effective RAG settings", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/rag-settings/effective?organization_id=${orgId}&team_id=${teamId}`
    );

    const settings = await expectSuccessResponse<EffectiveRAGSettings>(response);

    // Effective settings should have resolved values
    expect(typeof settings.rag_enabled).toBe("boolean");
    expect(typeof settings.chunk_size).toBe("number");
  });
});

// ================== Theme Settings Tests ==================

test.describe("Theme Settings API - Organization", () => {
  let orgId: string;

  test.beforeAll(async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get("/v1/organizations/");
    const data = await expectSuccessResponse<ListResponse<Organization>>(response);
    orgId = data.data[0].id;
  });

  test("should get organization theme settings", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/theme-settings`
    );

    const settings = await expectSuccessResponse<OrganizationThemeSettings>(response);

    expect(typeof settings.allow_team_customization).toBe("boolean");
    expect(typeof settings.allow_user_customization).toBe("boolean");
  });

  test("should update organization theme settings", async (
    { authenticatedApiContext },
    testInfo
  ) => {
    logTestData({ testName: testInfo.title, orgId });

    const response = await authenticatedApiContext.put(
      `/v1/organizations/${orgId}/theme-settings`,
      {
        data: {
          default_light_theme: "github-light",
          default_dark_theme: "one-dark-pro",
          allow_team_customization: true,
        },
      }
    );

    const settings = await expectSuccessResponse<OrganizationThemeSettings>(response);

    expect(settings.default_light_theme).toBe("github-light");
    expect(settings.default_dark_theme).toBe("one-dark-pro");
    expect(settings.allow_team_customization).toBe(true);
  });
});

test.describe("Theme Settings API - User", () => {
  test("should get user theme settings", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get("/v1/users/me/theme-settings");

    const settings = await expectSuccessResponse<UserThemeSettings>(response);

    expect(settings).toBeTruthy();
  });

  test("should update user theme settings", async ({ authenticatedApiContext }, testInfo) => {
    logTestData({ testName: testInfo.title });

    const response = await authenticatedApiContext.put("/v1/users/me/theme-settings", {
      data: {
        light_theme: "github-light",
        dark_theme: "dracula",
      },
    });

    const settings = await expectSuccessResponse<UserThemeSettings>(response);

    expect(settings.light_theme).toBe("github-light");
    expect(settings.dark_theme).toBe("dracula");
  });
});

test.describe("Theme Settings API - Predefined Themes", () => {
  test("should get predefined themes", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      "/v1/theme-settings/predefined-themes"
    );

    // Response is an object keyed by theme id
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    // The predefined themes are returned as an object, not an array
    expect(typeof data).toBe("object");
    expect(Object.keys(data).length).toBeGreaterThan(0);
  });
});

// ================== LLM Settings Tests ==================

test.describe("LLM Settings API - Organization", () => {
  let orgId: string;

  test.beforeAll(async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get("/v1/organizations/");
    const data = await expectSuccessResponse<ListResponse<Organization>>(response);
    orgId = data.data[0].id;
  });

  test("should get organization LLM settings", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/llm-settings`
    );

    const settings = await expectSuccessResponse<OrganizationLLMSettings>(response);

    expect(typeof settings.default_provider).toBe("string");
    expect(typeof settings.default_model).toBe("string");
    expect(typeof settings.allow_team_customization).toBe("boolean");
  });

  test("should update organization LLM settings", async (
    { authenticatedApiContext },
    testInfo
  ) => {
    logTestData({ testName: testInfo.title, orgId });

    const response = await authenticatedApiContext.put(
      `/v1/organizations/${orgId}/llm-settings`,
      {
        data: {
          default_temperature: 0.7,
        },
      }
    );

    const settings = await expectSuccessResponse<OrganizationLLMSettings>(response);

    expect(settings.default_temperature).toBe(0.7);
  });
});

test.describe("LLM Settings API - Team", () => {
  let orgId: string;
  let teamId: string;

  test.beforeAll(async ({ authenticatedApiContext }) => {
    const orgResponse = await authenticatedApiContext.get("/v1/organizations/");
    const orgData = await expectSuccessResponse<ListResponse<Organization>>(orgResponse);
    orgId = orgData.data[0].id;

    const teamsResponse = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/teams/`
    );
    const teamsData = await expectSuccessResponse<ListResponse<Team>>(teamsResponse);
    teamId = teamsData.data[0].id;
  });

  test("should get team LLM settings", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/organizations/${orgId}/teams/${teamId}/llm-settings`
    );

    const settings = await expectSuccessResponse<TeamLLMSettings>(response);

    expect(typeof settings.allow_user_customization).toBe("boolean");
  });

  test("should update team LLM settings", async ({ authenticatedApiContext }, testInfo) => {
    logTestData({ testName: testInfo.title, teamId });

    const response = await authenticatedApiContext.put(
      `/v1/organizations/${orgId}/teams/${teamId}/llm-settings`,
      {
        data: {
          default_temperature: 0.5,
        },
      }
    );

    const settings = await expectSuccessResponse<TeamLLMSettings>(response);

    expect(settings.default_temperature).toBe(0.5);
  });
});

test.describe("LLM Settings API - User", () => {
  test("should get user LLM settings", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get("/v1/users/me/llm-settings");

    const settings = await expectSuccessResponse<UserLLMSettings>(response);

    expect(settings.user_id).toBeTruthy();
  });

  test("should update user LLM settings", async ({ authenticatedApiContext }, testInfo) => {
    logTestData({ testName: testInfo.title });

    const response = await authenticatedApiContext.put("/v1/users/me/llm-settings", {
      data: {
        preferred_temperature: 0.8,
      },
    });

    const settings = await expectSuccessResponse<UserLLMSettings>(response);

    expect(settings.preferred_temperature).toBe(0.8);
  });
});
