/**
 * Centralized TanStack Query option presets for consistent caching behavior.
 *
 * These presets ensure uniform staleTime and gcTime settings across the app,
 * preventing unnecessary refetches and improving performance.
 *
 * Usage:
 *   import { queryDefaults } from "@/lib/query-defaults";
 *
 *   const { data } = useQuery({
 *     queryKey: ["organizations"],
 *     queryFn: getOrganizations,
 *     ...queryDefaults.stable,
 *   });
 *
 * Guidelines:
 * - stable: Data that rarely changes (orgs, teams, user settings)
 * - standard: Data that changes moderately (conversations, documents)
 * - volatile: Real-time data (status, presence, live updates)
 * - static: Never changes (themes, constants, enums)
 */

/**
 * Query option presets with consistent staleTime and gcTime values.
 *
 * staleTime: How long data is considered "fresh" (won't trigger refetch)
 * gcTime: How long inactive data stays in cache before garbage collection
 */
export const queryDefaults = {
  /**
   * Stable data: Organizations, teams, user settings.
   * Changes infrequently, safe to cache for longer.
   * - staleTime: 5 minutes (won't refetch for 5 min)
   * - gcTime: 10 minutes (stays cached 10 min after unmount)
   */
  stable: {
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  },

  /**
   * Standard data: Conversations, documents, messages.
   * Updates moderately, balance between freshness and efficiency.
   * - staleTime: 1 minute
   * - gcTime: 5 minutes
   */
  standard: {
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
  },

  /**
   * Volatile data: Real-time status, presence, live indicators.
   * Changes frequently, needs fresher data.
   * - staleTime: 30 seconds
   * - gcTime: 1 minute
   */
  volatile: {
    staleTime: 1000 * 30,
    gcTime: 1000 * 60,
  },

  /**
   * Static data: Themes, constants, enums, configuration.
   * Never changes during session, cache indefinitely.
   * - staleTime: Infinity (always fresh)
   * - gcTime: Infinity (never garbage collected)
   */
  static: {
    staleTime: Infinity,
    gcTime: Infinity,
  },
} as const;

/** Type for query preset keys */
export type QueryPreset = keyof typeof queryDefaults;
