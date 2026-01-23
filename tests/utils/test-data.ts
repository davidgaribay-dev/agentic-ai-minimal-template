import { randomUUID } from "crypto";

export const TEST_USERS = {
  admin: {
    email: "admin@example.com",
    password: "changethis",
  },
  invalid: {
    email: "invalid@example.com",
    password: "wrongpassword",
  },
} as const;

/**
 * Generate a unique test email using UUID for guaranteed uniqueness in parallel tests.
 */
export function generateTestEmail(prefix = "test"): string {
  const unique = randomUUID().substring(0, 8);
  return `${prefix}-${unique}@test.example.com`;
}

export function generateTestPassword(): string {
  return `TestPass${Date.now()}!`;
}

export function generateWorkspaceName(prefix = "Test Workspace"): string {
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix} ${random}`;
}

export function generateTeamName(prefix = "Test Team"): string {
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix} ${random}`;
}

export function generateFullName(): string {
  const firstNames = ["Alice", "Bob", "Charlie", "Diana", "Eve"];
  const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones"];
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${firstName} ${lastName}`;
}

export function createSignupTestData(overrides?: {
  email?: string;
  password?: string;
  name?: string;
  workspaceName?: string;
  teamName?: string;
}) {
  return {
    email: overrides?.email ?? generateTestEmail("signup"),
    password: overrides?.password ?? generateTestPassword(),
    name: overrides?.name ?? generateFullName(),
    workspaceName: overrides?.workspaceName ?? generateWorkspaceName(),
    teamName: overrides?.teamName ?? generateTeamName(),
  };
}

export const MIN_PASSWORD_LENGTH = 8;
export const SHORT_PASSWORD = "short";
export const INVALID_EMAIL = "not-an-email";

// Team test data
export type OrgRole = "owner" | "admin" | "member";
export type TeamRole = "admin" | "member" | "viewer";

export function generateTeamDescription(): string {
  return `Test team created at ${new Date().toISOString()}`;
}

export interface TeamTestData {
  name: string;
  description: string;
}

export function createTeamTestData(overrides?: Partial<TeamTestData>): TeamTestData {
  return {
    name: overrides?.name ?? generateTeamName(),
    description: overrides?.description ?? generateTeamDescription(),
  };
}

// Invitation test data
export interface InvitationTestData {
  email: string;
  orgRole: OrgRole;
  teamRole?: TeamRole;
}

export function createInvitationTestData(overrides?: Partial<InvitationTestData>): InvitationTestData {
  return {
    email: overrides?.email ?? generateTestEmail("invite"),
    orgRole: overrides?.orgRole ?? "member",
    teamRole: overrides?.teamRole,
  };
}

export function createBulkInvitationTestData(count: number): InvitationTestData[] {
  return Array.from({ length: count }, () => createInvitationTestData());
}
