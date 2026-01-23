import { expect } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";
import { SignupPage } from "../pages/SignupPage";
import { SidebarPage } from "../pages/SidebarPage";
import { TeamDialogPage } from "../pages/TeamDialogPage";
import { OrgSettingsPage } from "../pages/OrgSettingsPage";
import { TeamSettingsPage } from "../pages/TeamSettingsPage";
import {
  InvitationDialogPage,
  PendingInvitationsPage,
  InviteAcceptPage,
} from "../pages/InvitationPage";
import { apiTest } from "./api.fixture";

/**
 * Team Test Fixtures
 *
 * Extends apiTest to inherit authenticatedApiContext and adds page objects
 * for team-related UI testing. This avoids duplicating the authentication
 * logic from api.fixture.ts.
 */

type TeamPageFixtures = {
  loginPage: LoginPage;
  signupPage: SignupPage;
  sidebarPage: SidebarPage;
  teamDialogPage: TeamDialogPage;
  orgSettingsPage: OrgSettingsPage;
  teamSettingsPage: TeamSettingsPage;
  invitationDialogPage: InvitationDialogPage;
  pendingInvitationsPage: PendingInvitationsPage;
  inviteAcceptPage: InviteAcceptPage;
};

// Extend apiTest to inherit authenticatedApiContext fixture
export const teamTest = apiTest.extend<TeamPageFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  signupPage: async ({ page }, use) => {
    await use(new SignupPage(page));
  },
  sidebarPage: async ({ page }, use) => {
    await use(new SidebarPage(page));
  },
  teamDialogPage: async ({ page }, use) => {
    await use(new TeamDialogPage(page));
  },
  orgSettingsPage: async ({ page }, use) => {
    await use(new OrgSettingsPage(page));
  },
  teamSettingsPage: async ({ page }, use) => {
    await use(new TeamSettingsPage(page));
  },
  invitationDialogPage: async ({ page }, use) => {
    await use(new InvitationDialogPage(page));
  },
  pendingInvitationsPage: async ({ page }, use) => {
    await use(new PendingInvitationsPage(page));
  },
  inviteAcceptPage: async ({ page }, use) => {
    await use(new InviteAcceptPage(page));
  },
});

/**
 * Test fixture for team tests that require authentication
 * Uses stored auth state from setup
 */
export const authenticatedTeamTest = teamTest;

/**
 * Test fixture for unauthenticated team tests (e.g., invite acceptance)
 */
export const unauthenticatedTeamTest = teamTest.extend({
  storageState: { cookies: [], origins: [] },
});

export { expect };
