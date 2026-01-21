/**
 * Custom Render Utilities for Testing
 *
 * Provides a wrapper around React Testing Library's render function
 * that includes all necessary providers (QueryClient, Router, i18n).
 */

import React, { type ReactElement, type ReactNode } from "react";
import {
  render,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "@/locales/i18n";

/**
 * Options for the custom render function.
 */
export interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  /** Custom QueryClient instance (a fresh one is created by default) */
  queryClient?: QueryClient;
  /** Initial route path (not currently implemented, for future use) */
  initialRoute?: string;
  /** Whether to wrap with i18n provider (default: true) */
  withI18n?: boolean;
}

/**
 * Create a fresh QueryClient for testing.
 * Uses shorter timeouts and disables retries for faster tests.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Wrapper component that provides all necessary context providers.
 */
function createWrapper(options: {
  queryClient: QueryClient;
  withI18n: boolean;
}): React.FC<{ children: ReactNode }> {
  const { queryClient, withI18n } = options;

  return function Wrapper({ children }: { children: ReactNode }) {
    let content = children;

    if (withI18n) {
      content = <I18nextProvider i18n={i18n}>{content}</I18nextProvider>;
    }

    return (
      <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>
    );
  };
}

/**
 * Custom render function that wraps components with necessary providers.
 *
 * @example
 * ```tsx
 * import { renderWithProviders, screen } from "@/test/utils/render"
 *
 * it("renders component", () => {
 *   renderWithProviders(<MyComponent />)
 *   expect(screen.getByText("Hello")).toBeInTheDocument()
 * })
 * ```
 */
export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {},
): RenderResult & { queryClient: QueryClient } {
  const {
    queryClient = createTestQueryClient(),
    withI18n = true,
    ...renderOptions
  } = options;

  const Wrapper = createWrapper({ queryClient, withI18n });

  const result = render(ui, { wrapper: Wrapper, ...renderOptions });

  return {
    ...result,
    queryClient,
  };
}

/**
 * Re-export everything from @testing-library/react for convenience.
 */
export * from "@testing-library/react";

/**
 * Override the default render with our custom one.
 */
export { renderWithProviders as render };
