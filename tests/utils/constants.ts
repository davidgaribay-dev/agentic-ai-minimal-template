/**
 * Test timeout constants for consistent timeout handling across E2E tests.
 * Using named constants prevents magic numbers and makes adjustments easier.
 */
export const TIMEOUTS = {
  /** Short timeout for quick operations (5 seconds) */
  short: 5_000,
  /** Medium timeout for standard operations like page loads and auth (10 seconds) */
  medium: 10_000,
  /** Long timeout for complex operations like multi-step signups (15 seconds) */
  long: 15_000,
  /** Extended timeout for very slow operations (30 seconds) */
  extended: 30_000,
} as const;

export type TimeoutDuration = (typeof TIMEOUTS)[keyof typeof TIMEOUTS];
