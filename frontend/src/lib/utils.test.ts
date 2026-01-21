/**
 * Tests for utility functions.
 *
 * Best practices applied:
 * - Uses it.each for parametrized tests (reduces duplication)
 * - Tests edge cases (null, undefined, empty strings)
 * - Security-focused tests for URL validation
 * - Descriptive test names that explain behavior
 */
import { describe, expect, it } from "vitest"

import { cn, getInitials, isValidImageUrl } from "./utils"

describe("cn (className utility)", () => {
  it("merges multiple class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar")
  })

  it("handles conditional classes via boolean expressions", () => {
    const isActive = true
    const isHidden = false
    expect(cn("base", isActive && "active", isHidden && "hidden")).toBe("base active")
  })

  it("filters out undefined and null values", () => {
    expect(cn("base", undefined, null, "end")).toBe("base end")
  })

  it("resolves Tailwind class conflicts (later wins)", () => {
    // This is the key behavior of tailwind-merge
    expect(cn("px-4", "px-2")).toBe("px-2")
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500")
  })

  it("accepts array of class names", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar")
  })

  it("accepts object with boolean values", () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz")
  })

  it("handles empty inputs", () => {
    expect(cn()).toBe("")
    expect(cn("")).toBe("")
    expect(cn(null)).toBe("")
    expect(cn(undefined)).toBe("")
  })
})

describe("getInitials", () => {
  describe("with valid names", () => {
    it.each([
      ["John Doe", "JD"],
      ["John Michael Doe", "JD"], // First and last only
      ["john doe", "JD"], // Handles lowercase
      ["  John   Doe  ", "JD"], // Trims whitespace
      ["Mary-Jane Watson", "MW"], // Hyphenated names
    ])('returns correct initials for "%s"', (name, expected) => {
      expect(getInitials(name)).toBe(expected)
    })
  })

  describe("with single-word names", () => {
    it.each([
      ["John", "JO"], // First two chars, uppercased
      ["J", "J"], // Single char stays as-is
      ["jo", "JO"], // Lowercase single word
    ])('returns "%s" -> "%s"', (name, expected) => {
      expect(getInitials(name)).toBe(expected)
    })
  })

  describe("fallback to email", () => {
    it.each([
      [null, "john@example.com", "JO"],
      [undefined, "john@example.com", "JO"],
      ["", "john@example.com", "JO"],
    ])(
      "uses email when name is %s",
      (name: string | null | undefined, email: string, expected: string) => {
        expect(getInitials(name, email)).toBe(expected)
      }
    )
  })

  describe("fallback to default", () => {
    it.each([
      [null, undefined, "??"],
      [undefined, undefined, "??"],
      ["", undefined, "??"],
      // Note: Passing empty string "" explicitly uses that value, not the default "??"
      [null, "", ""],
    ])(
      'returns expected initials when name is %s and email is %s',
      (name: string | null | undefined, email: string | undefined, expected: string) => {
        expect(getInitials(name, email)).toBe(expected)
      }
    )
  })
})

describe("isValidImageUrl", () => {
  describe("valid URLs", () => {
    it.each([
      ["/images/avatar.png", "relative path"],
      ["/api/media/123", "API path"],
      ["http://example.com/image.png", "http URL"],
      ["https://example.com/image.png", "https URL"],
      ["https://cdn.example.com/path/to/image.jpg?v=1", "URL with query"],
    ])('accepts %s (%s)', (url) => {
      expect(isValidImageUrl(url)).toBe(true)
    })
  })

  describe("invalid URLs - security concerns", () => {
    it.each([
      ["javascript:alert(1)", "javascript protocol"],
      ["JAVASCRIPT:alert(1)", "javascript uppercase"],
      ["javascript:void(0)", "javascript void"],
      ["data:image/png;base64,abc123", "data URL"],
      ["DATA:image/png;base64,abc123", "data URL uppercase"],
      ["vbscript:msgbox(1)", "vbscript protocol"],
    ])('rejects %s (%s)', (url) => {
      expect(isValidImageUrl(url)).toBe(false)
    })
  })

  describe("invalid URLs - unsupported protocols", () => {
    it.each([
      ["ftp://example.com/image.png", "ftp protocol"],
      ["file:///etc/passwd", "file protocol"],
      ["mailto:test@example.com", "mailto protocol"],
    ])('rejects %s (%s)', (url) => {
      expect(isValidImageUrl(url)).toBe(false)
    })
  })

  describe("invalid URLs - malformed input", () => {
    it.each([
      [null, "null"],
      [undefined, "undefined"],
      ["", "empty string"],
      ["not a url", "plain text"],
      ["   ", "whitespace only"],
    ])("rejects %s (%s)", (url: string | null | undefined, _description: string) => {
      expect(isValidImageUrl(url)).toBe(false)
    })
  })

  describe("invalid URLs - embedded attacks", () => {
    it("rejects URL with javascript in query string", () => {
      expect(
        isValidImageUrl("https://example.com/?redirect=javascript:alert(1)")
      ).toBe(false)
    })

    // Note: The implementation checks the raw URL string, not decoded.
    // Percent-encoded characters like %6A are not decoded before checking.
    // This is acceptable as the URL would need to be decoded server-side
    // to actually execute, and browsers don't auto-decode URL paths.
    it("accepts URL with percent-encoded characters (not decoded)", () => {
      // %6A is 'j', but the raw string doesn't contain "javascript:"
      expect(isValidImageUrl("https://example.com/%6Aavascript:alert(1)")).toBe(
        true
      )
    })
  })
})
