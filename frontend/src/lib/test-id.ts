/**
 * Test ID utility that conditionally renders data-testid attributes
 * based on VITE_ENABLE_TEST_IDS environment variable.
 *
 * In production, test IDs are stripped to reduce DOM size and hide internals.
 * In development/testing, they enable reliable element selection.
 */

const ENABLE_TEST_IDS = import.meta.env.VITE_ENABLE_TEST_IDS === "true";

/**
 * Returns data-testid prop object if test IDs are enabled, empty object otherwise.
 * @param id - The test ID value
 * @returns Object with data-testid or empty object
 *
 * @example
 * ```tsx
 * <button {...testId('submit-button')}>Submit</button>
 * ```
 */
export function testId(id: string): { "data-testid"?: string } {
  return ENABLE_TEST_IDS ? { "data-testid": id } : {};
}

/**
 * Returns the raw data-testid value if enabled, undefined otherwise.
 * Useful for components that need the raw value or spread props.
 * @param id - The test ID value
 * @returns The test ID string or undefined
 *
 * @example
 * ```tsx
 * <input data-testid={getTestId('email-input')} />
 * ```
 */
export function getTestId(id: string): string | undefined {
  return ENABLE_TEST_IDS ? id : undefined;
}

/**
 * Check if test IDs are enabled (for conditional logic)
 */
export const testIdsEnabled = ENABLE_TEST_IDS;
