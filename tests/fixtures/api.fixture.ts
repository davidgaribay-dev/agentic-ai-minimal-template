import { test as base, expect, type APIRequestContext } from "@playwright/test";
import { logger } from "../utils/logger";
import type { AuthTokens } from "../utils/types";
import { TEST_USERS } from "../utils/test-data";

/**
 * API Test Fixtures
 *
 * Provides authenticated and unauthenticated API request contexts for testing.
 * Following Playwright best practices:
 * - Use fixtures for reusability
 * - Separate authenticated vs unauthenticated contexts
 * - Enable logging for debugging
 */

// Test user credentials - centralized in test-data.ts, overridable via environment
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || TEST_USERS.admin.email,
  password: process.env.TEST_USER_PASSWORD || TEST_USERS.admin.password,
};

// API base URL
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

interface ApiFixtures {
  /** Unauthenticated API request context */
  apiContext: APIRequestContext;
  /** Authenticated API request context with valid tokens */
  authenticatedApiContext: APIRequestContext;
  /** Auth tokens for the authenticated context */
  authTokens: AuthTokens;
  /** Helper to create a new authenticated context for a specific user */
  createAuthenticatedContext: (
    email: string,
    password: string
  ) => Promise<{ context: APIRequestContext; tokens: AuthTokens }>;
}

/**
 * Authenticate via API and return tokens
 *
 * Uses OAuth2 form-encoded format (username/password) as per FastAPI standard.
 * Includes comprehensive error handling and logging.
 */
export async function authenticate(
  context: APIRequestContext,
  email: string,
  password: string
): Promise<AuthTokens> {
  logger.info("api-auth", { action: "authenticating", email });

  let response;
  try {
    response = await context.post("/v1/auth/login", {
      form: {
        username: email,
        password: password,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("api-auth", {
      action: "network-error",
      email,
      error: message,
    });
    throw new Error(`Authentication network error for ${email}: ${message}`);
  }

  if (!response.ok()) {
    const body = await response.text();
    logger.error("api-auth", {
      action: "auth-failed",
      email,
      status: response.status(),
      body,
    });
    throw new Error(`Authentication failed for ${email}: ${response.status()} ${body}`);
  }

  // Validate response is JSON before parsing
  const contentType = response.headers()["content-type"] || "";
  if (!contentType.includes("application/json")) {
    const body = await response.text();
    logger.error("api-auth", {
      action: "invalid-response-type",
      email,
      contentType,
      body: body.substring(0, 500),
    });
    throw new Error(`Expected JSON response but got ${contentType}`);
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    const body = await response.text();
    logger.error("api-auth", {
      action: "json-parse-error",
      email,
      body: body.substring(0, 500),
    });
    throw new Error(`Failed to parse auth response as JSON: ${body.substring(0, 200)}`);
  }

  // Validate required token fields exist
  if (!data.access_token || !data.token_type) {
    logger.error("api-auth", {
      action: "invalid-token-response",
      email,
      data,
    });
    throw new Error(`Invalid token response: missing required fields`);
  }

  logger.info("api-auth", { action: "authenticated", email });

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || "",
    tokenType: data.token_type,
  };
}

/**
 * API test fixture with authenticated and unauthenticated contexts
 */
export const apiTest = base.extend<ApiFixtures>({
  // Unauthenticated API context
  // Note: Don't set Content-Type header here - let Playwright set it per-request
  // (form: uses x-www-form-urlencoded, data: uses application/json)
  apiContext: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: {
        Accept: "application/json",
      },
    });

    await use(context);
    await context.dispose();
  },

  // Authenticated API context using default test user
  authenticatedApiContext: async ({ playwright }, use) => {
    // First, create an unauthenticated context for login
    const loginContext = await playwright.request.newContext({
      baseURL: API_BASE_URL,
    });

    // Authenticate
    const tokens = await authenticate(
      loginContext,
      TEST_USER.email,
      TEST_USER.password
    );

    await loginContext.dispose();

    // Create new context with auth header
    const context = await playwright.request.newContext({
      baseURL: API_BASE_URL,
      extraHTTPHeaders: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `${tokens.tokenType} ${tokens.accessToken}`,
      },
    });

    await use(context);
    await context.dispose();
  },

  // Auth tokens for the authenticated context
  authTokens: async ({ playwright }, use) => {
    const loginContext = await playwright.request.newContext({
      baseURL: API_BASE_URL,
    });

    const tokens = await authenticate(
      loginContext,
      TEST_USER.email,
      TEST_USER.password
    );

    await loginContext.dispose();
    await use(tokens);
  },

  // Helper to create authenticated context for any user
  createAuthenticatedContext: async ({ playwright }, use) => {
    const contexts: APIRequestContext[] = [];

    const factory = async (email: string, password: string) => {
      const loginContext = await playwright.request.newContext({
        baseURL: API_BASE_URL,
      });

      const tokens = await authenticate(loginContext, email, password);
      await loginContext.dispose();

      const context = await playwright.request.newContext({
        baseURL: API_BASE_URL,
        extraHTTPHeaders: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `${tokens.tokenType} ${tokens.accessToken}`,
        },
      });

      contexts.push(context);
      return { context, tokens };
    };

    await use(factory);

    // Cleanup all created contexts
    for (const context of contexts) {
      await context.dispose();
    }
  },
});

export { expect };
