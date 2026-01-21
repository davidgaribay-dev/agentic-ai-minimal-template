/**
 * localStorage Mock Utilities
 *
 * Provides reusable localStorage mocking for tests.
 * Extracted from auth.test.ts patterns.
 */

import { vi } from "vitest";

export interface LocalStorageMock extends Storage {
  /** Expose internal store for debugging */
  _getStore: () => Record<string, string>;
  /** Expose internal store for direct manipulation in tests */
  _setStore: (store: Record<string, string>) => void;
}

/**
 * Create a fresh localStorage mock with an isolated store.
 * Each test should create a new mock to ensure isolation.
 */
export function createLocalStorageMock(): LocalStorageMock {
  let store: Record<string, string> = {};

  const mock = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    get length() {
      return Object.keys(store).length;
    },
    _getStore: () => store,
    _setStore: (newStore: Record<string, string>) => {
      store = newStore;
    },
  };

  return mock as LocalStorageMock;
}

/**
 * Install a localStorage mock on the window object.
 * Call this in beforeEach to ensure each test has a fresh mock.
 */
export function setupLocalStorage(): LocalStorageMock {
  const mock = createLocalStorageMock();
  Object.defineProperty(window, "localStorage", {
    value: mock,
    writable: true,
  });
  return mock;
}

/**
 * Set up localStorage with authentication tokens.
 * Useful for tests that need an authenticated state.
 */
export function withAuthToken(
  mock: LocalStorageMock,
  options: {
    token?: string;
    refreshToken?: string;
    expiresIn?: number;
  } = {},
): LocalStorageMock {
  const {
    token = "test-access-token",
    refreshToken = "test-refresh-token",
    expiresIn = 1800, // 30 minutes default
  } = options;

  const expiryTime = Date.now() + expiresIn * 1000;

  mock.setItem("auth_token", token);
  mock.setItem("auth_refresh_token", refreshToken);
  mock.setItem("auth_token_expiry", expiryTime.toString());

  return mock;
}

/**
 * Set up localStorage with organization/team context.
 * Useful for tests that need workspace state.
 */
export function withWorkspaceContext(
  mock: LocalStorageMock,
  options: {
    orgId?: string;
    teamId?: string;
  } = {},
): LocalStorageMock {
  const { orgId = "org-123", teamId = "team-123" } = options;

  mock.setItem("currentOrgId", orgId);
  mock.setItem("currentTeamId", teamId);

  return mock;
}
