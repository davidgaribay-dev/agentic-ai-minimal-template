/**
 * Tests for API client (client.ts)
 *
 * Tests:
 * - api() function request handling
 * - ApiError class
 * - getApiErrorMessage() formatting
 * - getAuthHeader() token handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { http, HttpResponse } from "msw"
import { server } from "@/test/mocks/server"
import {
  api,
  apiClient,
  ApiError,
  getApiErrorMessage,
  getApiErrorDetail,
  getAuthHeader,
  API_BASE,
} from "./client"
import { setupLocalStorage } from "@/test/utils/localStorage"

describe("ApiError", () => {
  it("creates error with status and statusText", () => {
    const error = new ApiError(404, "Not Found")

    expect(error.name).toBe("ApiError")
    expect(error.status).toBe(404)
    expect(error.statusText).toBe("Not Found")
    expect(error.message).toBe("API error: 404 Not Found")
    expect(error.body).toBeUndefined()
  })

  it("includes error body when provided", () => {
    const body = { detail: "Resource not found" }
    const error = new ApiError(404, "Not Found", body)

    expect(error.body).toEqual(body)
  })

  it("is an instance of Error", () => {
    const error = new ApiError(500, "Internal Server Error")

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(ApiError)
  })
})

describe("getApiErrorMessage", () => {
  it("extracts detail string from ApiError body", () => {
    const error = new ApiError(400, "Bad Request", {
      detail: "Invalid email format",
    })

    expect(getApiErrorMessage(error)).toBe("Invalid email format")
  })

  it("extracts message from ApiError body when no detail", () => {
    const error = new ApiError(400, "Bad Request", {
      message: "Something went wrong",
    })

    expect(getApiErrorMessage(error)).toBe("Something went wrong")
  })

  it("formats Pydantic validation errors", () => {
    const error = new ApiError(422, "Unprocessable Entity", {
      detail: [
        { type: "value_error", loc: ["body", "email"], msg: "invalid email", input: "bad" },
        { type: "value_error", loc: ["body", "password"], msg: "too short", input: "x" },
      ],
    })

    const message = getApiErrorMessage(error)
    expect(message).toContain("email: invalid email")
    expect(message).toContain("password: too short")
  })

  it("returns status code format when body has no detail/message", () => {
    const error = new ApiError(500, "Internal Server Error", { foo: "bar" })

    expect(getApiErrorMessage(error)).toBe("500: Internal Server Error")
  })

  it("returns message from regular Error", () => {
    const error = new Error("Network timeout")

    expect(getApiErrorMessage(error)).toBe("Network timeout")
  })

  it("returns fallback for unknown error types", () => {
    expect(getApiErrorMessage("string error", "Default message")).toBe("Default message")
    expect(getApiErrorMessage(null, "Null fallback")).toBe("Null fallback")
    expect(getApiErrorMessage(undefined, "Undefined fallback")).toBe("Undefined fallback")
  })

  it("handles empty validation error array", () => {
    const error = new ApiError(422, "Unprocessable Entity", {
      detail: [],
    })

    // Empty array returns empty string from formatDetailMessage
    // The function returns this empty string (which is truthy in this context)
    expect(getApiErrorMessage(error)).toBe("")
  })
})

describe("getApiErrorDetail", () => {
  it("extracts detail from ApiError", () => {
    const error = new ApiError(400, "Bad Request", {
      detail: "Invalid input",
    })

    expect(getApiErrorDetail(error)).toBe("Invalid input")
  })

  it("returns undefined for non-ApiError", () => {
    const error = new Error("Regular error")

    expect(getApiErrorDetail(error)).toBeUndefined()
  })

  it("returns undefined when no detail in body", () => {
    const error = new ApiError(400, "Bad Request", {
      message: "Some message",
    })

    expect(getApiErrorDetail(error)).toBeUndefined()
  })
})

describe("api function", () => {
  it("makes GET request and returns JSON", async () => {
    server.use(
      http.get(`${API_BASE}/test`, () => {
        return HttpResponse.json({ data: "test" })
      })
    )

    const result = await api<{ data: string }>("/test")

    expect(result).toEqual({ data: "test" })
  })

  it("makes POST request with JSON body", async () => {
    let capturedBody: unknown

    server.use(
      http.post(`${API_BASE}/test`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ success: true })
      })
    )

    await api("/test", {
      method: "POST",
      body: { name: "test", value: 123 },
    })

    expect(capturedBody).toEqual({ name: "test", value: 123 })
  })

  it("sets Content-Type header for JSON body", async () => {
    let capturedHeaders: Headers | undefined

    server.use(
      http.post(`${API_BASE}/test`, async ({ request }) => {
        capturedHeaders = request.headers
        return HttpResponse.json({ success: true })
      })
    )

    await api("/test", {
      method: "POST",
      body: { data: "test" },
    })

    expect(capturedHeaders?.get("Content-Type")).toBe("application/json")
  })

  it("does not set Content-Type for FormData", async () => {
    let capturedContentType: string | null = null

    server.use(
      http.post(`${API_BASE}/upload`, async ({ request }) => {
        capturedContentType = request.headers.get("Content-Type")
        return HttpResponse.json({ success: true })
      })
    )

    const formData = new FormData()
    formData.append("file", new Blob(["test"]), "test.txt")

    await api("/upload", {
      method: "POST",
      body: formData,
    })

    // Browser sets Content-Type with boundary for multipart/form-data
    expect(capturedContentType).toContain("multipart/form-data")
  })

  it("throws ApiError on non-ok response", async () => {
    server.use(
      http.get(`${API_BASE}/error`, () => {
        return HttpResponse.json(
          { detail: "Not found" },
          { status: 404, statusText: "Not Found" }
        )
      })
    )

    await expect(api("/error")).rejects.toThrow(ApiError)

    try {
      await api("/error")
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      if (error instanceof ApiError) {
        expect(error.status).toBe(404)
        expect(error.body).toEqual({ detail: "Not found" })
      }
    }
  })

  it("includes custom headers", async () => {
    let capturedAuth: string | null = null

    server.use(
      http.get(`${API_BASE}/auth-test`, async ({ request }) => {
        capturedAuth = request.headers.get("Authorization")
        return HttpResponse.json({ success: true })
      })
    )

    await api("/auth-test", {
      headers: { Authorization: "Bearer test-token" },
    })

    expect(capturedAuth).toBe("Bearer test-token")
  })

  it("respects abort signal", async () => {
    server.use(
      http.get(`${API_BASE}/slow`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        return HttpResponse.json({ data: "slow" })
      })
    )

    const controller = new AbortController()

    const promise = api("/slow", { signal: controller.signal })

    // Abort immediately
    controller.abort()

    await expect(promise).rejects.toThrow()
  })
})

describe("apiClient methods", () => {
  it("get makes GET request", async () => {
    server.use(
      http.get(`${API_BASE}/items`, () => {
        return HttpResponse.json({ items: [1, 2, 3] })
      })
    )

    const result = await apiClient.get<{ items: number[] }>("/items")

    expect(result).toEqual({ items: [1, 2, 3] })
  })

  it("post makes POST request", async () => {
    let capturedMethod: string | undefined

    server.use(
      http.post(`${API_BASE}/items`, async ({ request }) => {
        capturedMethod = request.method
        return HttpResponse.json({ id: 1 })
      })
    )

    await apiClient.post("/items", { name: "test" })

    expect(capturedMethod).toBe("POST")
  })

  it("put makes PUT request", async () => {
    let capturedMethod: string | undefined

    server.use(
      http.put(`${API_BASE}/items/1`, async ({ request }) => {
        capturedMethod = request.method
        return HttpResponse.json({ id: 1 })
      })
    )

    await apiClient.put("/items/1", { name: "updated" })

    expect(capturedMethod).toBe("PUT")
  })

  it("patch makes PATCH request", async () => {
    let capturedMethod: string | undefined

    server.use(
      http.patch(`${API_BASE}/items/1`, async ({ request }) => {
        capturedMethod = request.method
        return HttpResponse.json({ id: 1 })
      })
    )

    await apiClient.patch("/items/1", { name: "patched" })

    expect(capturedMethod).toBe("PATCH")
  })

  it("delete makes DELETE request", async () => {
    let capturedMethod: string | undefined

    server.use(
      http.delete(`${API_BASE}/items/1`, async ({ request }) => {
        capturedMethod = request.method
        return HttpResponse.json({ success: true })
      })
    )

    await apiClient.delete("/items/1")

    expect(capturedMethod).toBe("DELETE")
  })
})

describe("getAuthHeader", () => {
  let localStorageMock: ReturnType<typeof setupLocalStorage>

  beforeEach(() => {
    localStorageMock = setupLocalStorage()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns empty object when no token exists", () => {
    const headers = getAuthHeader()

    expect(headers).toEqual({})
  })

  it("returns Authorization header when token exists", () => {
    localStorageMock.setItem("auth_token", "test-token-123")

    const headers = getAuthHeader()

    expect(headers).toEqual({ Authorization: "Bearer test-token-123" })
  })
})
