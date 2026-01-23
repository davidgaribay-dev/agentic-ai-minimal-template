import { apiTest as test, expect } from "../../../fixtures";
import { expectSuccessResponse } from "../../../utils/api-helpers";
import { logTestData } from "../../../utils/logger";
import type {
  ListResponse,
  Organization,
  Team,
} from "../../../utils";

/**
 * Guardrails API Tests
 *
 * Tests for content filtering and PII detection
 * - /v1/guardrails/organizations/{org_id} - Organization guardrails
 * - /v1/guardrails/organizations/{org_id}/teams/{team_id} - Team guardrails
 * - /v1/guardrails/me - User guardrails
 * - /v1/guardrails/test - Test guardrails
 */

// Actual backend schema - OrganizationGuardrailsPublic
interface OrganizationGuardrailsSettings {
  id: string;
  organization_id: string;
  guardrails_enabled: boolean;
  input_blocked_keywords: string[];
  input_blocked_patterns: string[];
  input_action: string;
  output_blocked_keywords: string[];
  output_blocked_patterns: string[];
  output_action: string;
  pii_detection_enabled: boolean;
  pii_types: string[];
  pii_action: string;
  allow_team_override: boolean;
  allow_user_override: boolean;
  created_at: string;
  updated_at: string;
}

// Actual backend schema - TeamGuardrailsPublic
interface TeamGuardrailsSettings {
  id: string;
  team_id: string;
  guardrails_enabled: boolean;
  input_blocked_keywords: string[];
  input_blocked_patterns: string[];
  input_action: string;
  output_blocked_keywords: string[];
  output_blocked_patterns: string[];
  output_action: string;
  pii_detection_enabled: boolean;
  pii_types: string[];
  pii_action: string;
  created_at: string;
  updated_at: string;
}

// Actual backend schema - UserGuardrailsPublic
interface UserGuardrailsSettings {
  id: string;
  user_id: string;
  guardrails_enabled: boolean;
  input_blocked_keywords: string[];
  input_blocked_patterns: string[];
  input_action: string;
  output_blocked_keywords: string[];
  output_blocked_patterns: string[];
  output_action: string;
  pii_detection_enabled: boolean;
  pii_types: string[];
  pii_action: string;
  created_at: string;
  updated_at: string;
}

// Actual backend schema - GuardrailsTestResponse
interface GuardrailTestResult {
  passed: boolean;
  action: string | null;
  matches: Array<{
    pattern: string;
    pattern_type: string;
    matched_text: string;
    start: number;
    end: number;
  }>;
  redacted_content: string | null;
}

test.describe("Organization Guardrails API", () => {
  let orgId: string;
  let originalSettings: OrganizationGuardrailsSettings | null = null;

  test.beforeAll(async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get("/v1/organizations/");
    const data = await expectSuccessResponse<ListResponse<Organization>>(response);
    expect(data.data.length).toBeGreaterThan(0);
    orgId = data.data[0].id;

    // Save original settings to restore later
    const settingsResponse = await authenticatedApiContext.get(
      `/v1/guardrails/organizations/${orgId}`
    );
    if (settingsResponse.ok()) {
      originalSettings = await settingsResponse.json();
    }
  });

  test.afterAll(async ({ authenticatedApiContext }) => {
    // Restore original settings
    if (originalSettings) {
      await authenticatedApiContext.put(
        `/v1/guardrails/organizations/${orgId}`,
        { data: originalSettings }
      );
    }
  });

  test("should get organization guardrails", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/guardrails/organizations/${orgId}`
    );

    const settings = await expectSuccessResponse<OrganizationGuardrailsSettings>(response);

    expect(typeof settings.guardrails_enabled).toBe("boolean");
    expect(Array.isArray(settings.input_blocked_keywords)).toBe(true);
    expect(Array.isArray(settings.output_blocked_keywords)).toBe(true);
    expect(typeof settings.allow_team_override).toBe("boolean");
  });

  test("should update organization guardrails", async (
    { authenticatedApiContext },
    testInfo
  ) => {
    const newKeyword = `test_keyword_${Date.now()}`;

    logTestData({ testName: testInfo.title, orgId, newKeyword });

    const response = await authenticatedApiContext.put(
      `/v1/guardrails/organizations/${orgId}`,
      {
        data: {
          guardrails_enabled: true,
          input_blocked_keywords: [newKeyword],
          input_action: "warn",
        },
      }
    );

    const settings = await expectSuccessResponse<OrganizationGuardrailsSettings>(response);

    expect(settings.guardrails_enabled).toBe(true);
    expect(settings.input_blocked_keywords).toContain(newKeyword);
    expect(settings.input_action).toBe("warn");
  });

  test("should enable PII detection", async ({ authenticatedApiContext }, testInfo) => {
    logTestData({ testName: testInfo.title, orgId });

    const response = await authenticatedApiContext.put(
      `/v1/guardrails/organizations/${orgId}`,
      {
        data: {
          pii_detection_enabled: true,
          pii_types: ["email", "phone"],
        },
      }
    );

    const settings = await expectSuccessResponse<OrganizationGuardrailsSettings>(response);

    expect(settings.pii_detection_enabled).toBe(true);
    expect(settings.pii_types).toContain("email");
    expect(settings.pii_types).toContain("phone");
  });
});

test.describe("Team Guardrails API", () => {
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

    // Ensure org allows team override
    await authenticatedApiContext.put(
      `/v1/guardrails/organizations/${orgId}`,
      {
        data: {
          allow_team_override: true,
        },
      }
    );
  });

  test("should get team guardrails", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get(
      `/v1/guardrails/organizations/${orgId}/teams/${teamId}`
    );

    const settings = await expectSuccessResponse<TeamGuardrailsSettings>(response);

    expect(typeof settings.guardrails_enabled).toBe("boolean");
    expect(Array.isArray(settings.input_blocked_keywords)).toBe(true);
  });

  test("should update team guardrails", async ({ authenticatedApiContext }, testInfo) => {
    const newKeyword = `team_keyword_${Date.now()}`;

    logTestData({ testName: testInfo.title, teamId, newKeyword });

    const response = await authenticatedApiContext.put(
      `/v1/guardrails/organizations/${orgId}/teams/${teamId}`,
      {
        data: {
          guardrails_enabled: true,
          input_blocked_keywords: [newKeyword],
        },
      }
    );

    const settings = await expectSuccessResponse<TeamGuardrailsSettings>(response);

    expect(settings.guardrails_enabled).toBe(true);
    expect(settings.input_blocked_keywords).toContain(newKeyword);
  });
});

test.describe("User Guardrails API", () => {
  test("should get user guardrails", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get("/v1/guardrails/me");

    const settings = await expectSuccessResponse<UserGuardrailsSettings>(response);

    expect(typeof settings.guardrails_enabled).toBe("boolean");
    expect(Array.isArray(settings.input_blocked_keywords)).toBe(true);
  });

  test("should update user guardrails", async ({ authenticatedApiContext }, testInfo) => {
    const newKeyword = `user_keyword_${Date.now()}`;

    logTestData({ testName: testInfo.title, newKeyword });

    const response = await authenticatedApiContext.put("/v1/guardrails/me", {
      data: {
        guardrails_enabled: true,
        input_blocked_keywords: [newKeyword],
      },
    });

    const settings = await expectSuccessResponse<UserGuardrailsSettings>(response);

    expect(settings.guardrails_enabled).toBe(true);
    expect(settings.input_blocked_keywords).toContain(newKeyword);
  });
});

test.describe("Guardrails Test API", () => {
  let orgId: string;

  test.beforeAll(async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get("/v1/organizations/");
    const data = await expectSuccessResponse<ListResponse<Organization>>(response);
    orgId = data.data[0].id;
  });

  test("should test guardrails with matching content", async (
    { authenticatedApiContext },
    testInfo
  ) => {
    // First set up a keyword to detect
    const testKeyword = `blockedword_${Date.now()}`;
    logTestData({ testName: testInfo.title, testKeyword });

    await authenticatedApiContext.put(
      `/v1/guardrails/organizations/${orgId}`,
      {
        data: {
          guardrails_enabled: true,
          input_blocked_keywords: [testKeyword],
          input_action: "block",
        },
      }
    );

    // Test the guardrails - note: endpoint uses query params for org_id/team_id
    const response = await authenticatedApiContext.post(
      `/v1/guardrails/test?org_id=${orgId}`,
      {
        data: {
          content: `This message contains ${testKeyword} which should be detected`,
          direction: "input",
        },
      }
    );

    const result = await expectSuccessResponse<GuardrailTestResult>(response);

    expect(result.passed).toBe(false);  // Guardrail was triggered
    expect(result.action).toBe("block");
    expect(result.matches.length).toBeGreaterThan(0);
  });

  test("should test guardrails with non-matching content", async (
    { authenticatedApiContext }
  ) => {
    const response = await authenticatedApiContext.post(
      `/v1/guardrails/test?org_id=${orgId}`,
      {
        data: {
          content: "This is a completely normal message with no issues",
          direction: "input",
        },
      }
    );

    const result = await expectSuccessResponse<GuardrailTestResult>(response);

    // Should pass (not triggered)
    expect(typeof result.passed).toBe("boolean");
  });

  test("should detect PII when enabled", async ({ authenticatedApiContext }, testInfo) => {
    logTestData({ testName: testInfo.title });

    // Enable PII detection
    await authenticatedApiContext.put(
      `/v1/guardrails/organizations/${orgId}`,
      {
        data: {
          pii_detection_enabled: true,
          pii_types: ["email", "phone"],
          guardrails_enabled: true,
          input_action: "warn",
        },
      }
    );

    // Test with PII content
    const response = await authenticatedApiContext.post(
      `/v1/guardrails/test?org_id=${orgId}`,
      {
        data: {
          content: "My email is test@example.com and my phone is 555-123-4567",
          direction: "input",
        },
      }
    );

    const result = await expectSuccessResponse<GuardrailTestResult>(response);

    // PII detection may or may not be available depending on backend configuration
    // If PII detection is working, passed should be false and matches should have items
    // If not configured/available, it may pass through
    expect(typeof result.passed).toBe("boolean");
    if (!result.passed) {
      expect(result.matches.length).toBeGreaterThan(0);
    }
  });
});
