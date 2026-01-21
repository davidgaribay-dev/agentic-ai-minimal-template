/**
 * Tests for auth token management utilities.
 *
 * Best practices applied:
 * - Uses vi.spyOn for time mocking (deterministic tests)
 * - Proper cleanup in beforeEach/afterEach
 * - Tests behavior, not implementation
 * - Each test is independent and isolated
 * - Descriptive test names that explain the behavior
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  getRefreshToken,
  getToken,
  isLoggedIn,
  isTokenExpired,
  removeToken,
  setTokens,
  subscribeToAuth,
} from "./auth"

// Mock localStorage with a fresh store for each test
const createLocalStorageMock = () => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    // Expose store for debugging if needed
    _getStore: () => store,
  }
}

let localStorageMock: ReturnType<typeof createLocalStorageMock>

beforeEach(() => {
  localStorageMock = createLocalStorageMock()
  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    writable: true,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("Auth Token Management", () => {
  describe("getToken", () => {
    it("returns null when no token exists", () => {
      expect(getToken()).toBeNull()
    })

    it("returns stored access token", () => {
      localStorageMock.setItem("auth_token", "test-token-123")

      expect(getToken()).toBe("test-token-123")
    })
  })

  describe("getRefreshToken", () => {
    it("returns null when no refresh token exists", () => {
      expect(getRefreshToken()).toBeNull()
    })

    it("returns stored refresh token", () => {
      localStorageMock.setItem("auth_refresh_token", "refresh-token-456")

      expect(getRefreshToken()).toBe("refresh-token-456")
    })
  })

  describe("setTokens", () => {
    it("stores all token data in localStorage", () => {
      const tokenData = {
        access_token: "access-123",
        refresh_token: "refresh-456",
        token_type: "bearer",
        expires_in: 1800,
      }

      setTokens(tokenData)

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "auth_token",
        "access-123"
      )
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "auth_refresh_token",
        "refresh-456"
      )
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "auth_token_expiry",
        expect.any(String)
      )
    })

    it("calculates expiry timestamp correctly", () => {
      // Mock Date.now for deterministic testing
      const mockNow = 1700000000000
      vi.spyOn(Date, "now").mockReturnValue(mockNow)

      const tokenData = {
        access_token: "access",
        refresh_token: "refresh",
        token_type: "bearer",
        expires_in: 1800, // 30 minutes in seconds
      }

      setTokens(tokenData)

      const expectedExpiry = (mockNow + 1800 * 1000).toString()
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "auth_token_expiry",
        expectedExpiry
      )
    })
  })

  describe("removeToken", () => {
    it("removes all auth-related items from localStorage", () => {
      // Arrange: Set some tokens first
      localStorageMock.setItem("auth_token", "token")
      localStorageMock.setItem("auth_refresh_token", "refresh")
      localStorageMock.setItem("auth_token_expiry", "12345")

      // Act
      removeToken()

      // Assert
      expect(localStorageMock.removeItem).toHaveBeenCalledWith("auth_token")
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        "auth_refresh_token"
      )
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        "auth_token_expiry"
      )
    })
  })

  describe("isLoggedIn", () => {
    it("returns false when no token exists", () => {
      expect(isLoggedIn()).toBe(false)
    })

    it("returns true when token exists", () => {
      localStorageMock.setItem("auth_token", "some-token")

      expect(isLoggedIn()).toBe(true)
    })
  })

  describe("isTokenExpired", () => {
    it("returns true when no expiry is set", () => {
      expect(isTokenExpired()).toBe(true)
    })

    it("returns false when token has not expired", () => {
      // Token expires 5 minutes from now
      const futureExpiry = Date.now() + 5 * 60 * 1000
      localStorageMock.setItem("auth_token_expiry", futureExpiry.toString())

      expect(isTokenExpired()).toBe(false)
    })

    it("returns true when token has expired", () => {
      // Token expired 5 minutes ago
      const pastExpiry = Date.now() - 5 * 60 * 1000
      localStorageMock.setItem("auth_token_expiry", pastExpiry.toString())

      expect(isTokenExpired()).toBe(true)
    })

    it("returns true when token expires within 60 second buffer", () => {
      // Token expires in 30 seconds (within the 60s refresh buffer)
      const soonExpiry = Date.now() + 30 * 1000
      localStorageMock.setItem("auth_token_expiry", soonExpiry.toString())

      expect(isTokenExpired()).toBe(true)
    })

    it("returns false when token expires just outside buffer", () => {
      // Token expires in 90 seconds (outside the 60s buffer)
      const futureExpiry = Date.now() + 90 * 1000
      localStorageMock.setItem("auth_token_expiry", futureExpiry.toString())

      expect(isTokenExpired()).toBe(false)
    })
  })

  describe("subscribeToAuth", () => {
    it("notifies listener when tokens are set", () => {
      const listener = vi.fn()
      const unsubscribe = subscribeToAuth(listener)

      setTokens({
        access_token: "token",
        refresh_token: "refresh",
        token_type: "bearer",
        expires_in: 1800,
      })

      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()
    })

    it("notifies listener when tokens are removed", () => {
      const listener = vi.fn()
      const unsubscribe = subscribeToAuth(listener)

      removeToken()

      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()
    })

    it("stops notifying after unsubscribe", () => {
      const listener = vi.fn()
      const unsubscribe = subscribeToAuth(listener)

      // Unsubscribe immediately
      unsubscribe()

      // Trigger token change
      setTokens({
        access_token: "token",
        refresh_token: "refresh",
        token_type: "bearer",
        expires_in: 1800,
      })

      // Listener should not have been called
      expect(listener).not.toHaveBeenCalled()
    })

    it("supports multiple subscribers", () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      const unsubscribe1 = subscribeToAuth(listener1)
      const unsubscribe2 = subscribeToAuth(listener2)

      setTokens({
        access_token: "token",
        refresh_token: "refresh",
        token_type: "bearer",
        expires_in: 1800,
      })

      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(1)

      unsubscribe1()
      unsubscribe2()
    })
  })
})
