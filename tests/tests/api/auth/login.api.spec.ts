import { apiTest as test, expect } from "../../../fixtures";
import {
  expectSuccessResponse,
  expectErrorResponse,
} from "../../../utils/api-helpers";
import { generateTestEmail, generateTestPassword, TEST_USERS } from "../../../utils/test-data";
import { logTestData } from "../../../utils/logger";

/**
 * Authentication API Tests
 *
 * Tests for /v1/auth endpoints following Playwright API testing best practices:
 * - Test isolation (each test is independent)
 * - Validate response status and body
 * - Test both success and error cases
 * - Clean up test data
 */

test.describe("Auth API - Login", () => {
  test("should login successfully with valid credentials", async ({ apiContext }) => {
    // OAuth2 login uses form-urlencoded data
    const response = await apiContext.post("/v1/auth/login", {
      form: {
        username: TEST_USERS.admin.email,
        password: TEST_USERS.admin.password,
      },
    });

    const data = await expectSuccessResponse<{
      access_token: string;
      refresh_token: string;
      token_type: string;
      expires_in: number;
    }>(response);

    expect(data.access_token).toBeTruthy();
    expect(data.refresh_token).toBeTruthy();
    expect(data.token_type).toBe("bearer");
    expect(data.expires_in).toBeGreaterThan(0);
  });

  test("should return 400 for invalid password", async ({ apiContext }) => {
    const response = await apiContext.post("/v1/auth/login", {
      form: {
        username: TEST_USERS.admin.email,
        password: TEST_USERS.invalid.password,
      },
    });

    // API returns 400 Bad Request for invalid credentials
    await expectErrorResponse(response, 400, /incorrect/i);
  });

  test("should return 400 for non-existent user", async ({ apiContext }, testInfo) => {
    const email = generateTestEmail("nonexistent");
    logTestData({ testName: testInfo.title, email });

    const response = await apiContext.post("/v1/auth/login", {
      form: {
        username: email,
        password: "anypassword",
      },
    });

    // API returns 400 Bad Request for invalid credentials
    await expectErrorResponse(response, 400, /incorrect/i);
  });

  test("should return 422 for missing credentials", async ({ apiContext }) => {
    const response = await apiContext.post("/v1/auth/login", {
      form: {},
    });

    // FastAPI returns 422 for validation errors
    expect(response.status()).toBe(422);
  });
});

test.describe("Auth API - Current User", () => {
  test("should return current user info when authenticated", async ({
    authenticatedApiContext,
  }) => {
    // Correct endpoint is /v1/auth/me (not /v1/users/me)
    const response = await authenticatedApiContext.get("/v1/auth/me");

    const user = await expectSuccessResponse<{
      id: string;
      email: string;
      is_active: boolean;
    }>(response);

    expect(user.id).toBeTruthy();
    expect(user.email).toBe(TEST_USERS.admin.email);
    expect(user.is_active).toBe(true);
  });

  test("should return 401 when not authenticated", async ({ apiContext }) => {
    const response = await apiContext.get("/v1/auth/me");
    expect(response.status()).toBe(401);
  });
});

test.describe("Auth API - Signup", () => {
  test("should register new user and organization", async ({ apiContext }, testInfo) => {
    const email = generateTestEmail("register");
    const password = generateTestPassword();
    const orgName = `Test Org ${Date.now()}`;

    logTestData({ testName: testInfo.title, email, orgName });

    // Signup uses form-urlencoded (multipart/form-data)
    const response = await apiContext.post("/v1/auth/signup", {
      form: {
        email,
        password,
        full_name: "Test User",
        organization_name: orgName,
      },
    });

    // Signup returns UserPublic (user info), not tokens
    const user = await expectSuccessResponse<{
      id: string;
      email: string;
      full_name: string | null;
      is_active: boolean;
    }>(response);

    expect(user.id).toBeTruthy();
    expect(user.email).toBe(email);
    expect(user.is_active).toBe(true);
  });

  test("should return 400 for duplicate email", async ({ apiContext }, testInfo) => {
    // First registration
    const email = generateTestEmail("duplicate");
    const password = generateTestPassword();
    const orgName = `Duplicate Test ${Date.now()}`;

    logTestData({ testName: testInfo.title, email, orgName });

    const firstResponse = await apiContext.post("/v1/auth/signup", {
      form: {
        email,
        password,
        full_name: "First User",
        organization_name: orgName,
      },
    });
    expect(firstResponse.ok()).toBeTruthy();

    // Second registration with same email
    const secondResponse = await apiContext.post("/v1/auth/signup", {
      form: {
        email,
        password,
        full_name: "Second User",
        organization_name: `Another ${orgName}`,
      },
    });

    expect(secondResponse.status()).toBe(400);
  });

  test("should handle invalid email format", async ({ apiContext }) => {
    const response = await apiContext.post("/v1/auth/signup", {
      form: {
        email: "invalid-email",
        password: "validpassword123",
        full_name: "Test User",
        organization_name: "Test Workspace",
      },
    });

    // Invalid email format should return 422 validation error
    expect(response.status()).toBe(422);
  });
});

test.describe("Auth API - Token Refresh", () => {
  test("should refresh access token with valid refresh token", async ({
    apiContext,
    authTokens,
  }) => {
    const response = await apiContext.post("/v1/auth/refresh", {
      data: {
        refresh_token: authTokens.refreshToken,
      },
    });

    const data = await expectSuccessResponse<{
      access_token: string;
      refresh_token: string;
      token_type: string;
    }>(response);

    expect(data.access_token).toBeTruthy();
    expect(data.refresh_token).toBeTruthy();
  });

  test("should return 401 for invalid refresh token", async ({ apiContext }) => {
    const response = await apiContext.post("/v1/auth/refresh", {
      data: {
        refresh_token: "invalid-token",
      },
    });

    expect(response.status()).toBe(401);
  });
});

// Note: POST /v1/auth/logout exists for server-side token revocation.
// Client also removes tokens from localStorage for immediate UI logout.
// See backend/auth/token_revocation.py for revocation implementation.
