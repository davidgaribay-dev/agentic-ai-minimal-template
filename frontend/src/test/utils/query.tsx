/**
 * TanStack Query Test Utilities
 *
 * Utilities for testing components and hooks that use TanStack Query.
 */

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Creates a QueryClient configured for testing.
 *
 * Key differences from production:
 * - retry: false - Don't retry failed queries (faster tests)
 * - gcTime: 0 - Immediately garbage collect (clean between tests)
 * - staleTime: 0 - Always treat data as stale
 *
 * @example
 * ```ts
 * const queryClient = createTestQueryClient()
 * render(<App />, { wrapper: createQueryWrapper(queryClient) })
 * ```
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Creates a wrapper component that provides QueryClientProvider.
 * Use this with renderHook when testing custom hooks that use queries.
 *
 * @example
 * ```ts
 * const { result } = renderHook(() => useMyQuery(), {
 *   wrapper: createQueryWrapper(),
 * })
 * ```
 */
export function createQueryWrapper(queryClient?: QueryClient) {
  const client = queryClient ?? createTestQueryClient();
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

/**
 * Waits for a query to settle (either succeed or fail).
 * Useful when you need to wait for async operations in tests.
 *
 * @example
 * ```ts
 * await waitForQueryToSettle(queryClient, ['users', userId])
 * ```
 */
export async function waitForQueryToSettle(
  queryClient: QueryClient,
  queryKey: unknown[],
): Promise<void> {
  await queryClient.getQueryCache().find({ queryKey })?.promise;
}

/**
 * Pre-populate the query cache with mock data.
 * Useful for testing components that depend on certain data being available.
 *
 * @example
 * ```ts
 * const queryClient = createTestQueryClient()
 * seedQueryCache(queryClient, ['user'], mockUser)
 * ```
 */
export function seedQueryCache<T>(
  queryClient: QueryClient,
  queryKey: unknown[],
  data: T,
): void {
  queryClient.setQueryData(queryKey, data);
}

/**
 * Clear all queries from the cache.
 * Useful in afterEach hooks to ensure clean state.
 *
 * @example
 * ```ts
 * afterEach(() => {
 *   clearQueryCache(queryClient)
 * })
 * ```
 */
export function clearQueryCache(queryClient: QueryClient): void {
  queryClient.clear();
}

/**
 * Invalidate specific queries in the cache.
 * Triggers refetch of those queries.
 *
 * @example
 * ```ts
 * invalidateQueries(queryClient, ['users'])
 * ```
 */
export function invalidateQueries(
  queryClient: QueryClient,
  queryKey: unknown[],
): Promise<void> {
  return queryClient.invalidateQueries({ queryKey });
}

/**
 * Get the current state of a query from the cache.
 * Useful for assertions in tests.
 *
 * @example
 * ```ts
 * const state = getQueryState(queryClient, ['user', userId])
 * expect(state?.data).toEqual(mockUser)
 * ```
 */
export function getQueryState<T>(
  queryClient: QueryClient,
  queryKey: unknown[],
):
  | { data: T | undefined; error: Error | null; isLoading: boolean }
  | undefined {
  const query = queryClient.getQueryCache().find({ queryKey });
  if (!query) return undefined;

  return {
    data: query.state.data as T | undefined,
    error: query.state.error as Error | null,
    isLoading: query.state.fetchStatus === "fetching",
  };
}
