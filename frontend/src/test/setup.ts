/**
 * Vitest Test Setup
 *
 * This file is loaded before each test file runs.
 * It sets up global mocks and test utilities.
 */

import "@testing-library/jest-dom";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./mocks/server";
import { resetAllStores } from "./utils/store-utils";

// Declare globals for TypeScript
declare global {
  var ResizeObserver: typeof ResizeObserver;
  var IntersectionObserver: typeof IntersectionObserver;
}

// Mock ResizeObserver which is not available in jsdom
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock window.matchMedia which is not available in jsdom
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock IntersectionObserver which is not available in jsdom
globalThis.IntersectionObserver = class IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];

  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
};

// Mock scrollIntoView which is not available in jsdom
Element.prototype.scrollIntoView = () => {};

// Mock crypto.randomUUID if not available
if (!crypto.randomUUID) {
  crypto.randomUUID = () => {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }) as `${string}-${string}-${string}-${string}-${string}`;
  };
}

// MSW Server Setup
beforeAll(() => {
  server.listen({ onUnhandledRequest: "warn" });
});

afterEach(() => {
  // Reset MSW handlers to defaults after each test
  server.resetHandlers();

  // Reset Zustand stores to prevent state leakage between tests
  resetAllStores();
});

afterAll(() => {
  server.close();
});
