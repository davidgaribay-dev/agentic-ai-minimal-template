import { authenticatedTeamTest as test, expect } from "../../fixtures";
import { generateTeamName } from "../../utils/test-data";
import { logTestData } from "../../utils/logger";
import { createResource, deleteResource, getOrgAndTeam } from "../../utils/api-helpers";
import path from "path";
import { fileURLToPath } from "url";
import type { Team } from "../../utils/types";

// ESM compatibility for __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe("Team Settings", () => {

  test.describe("General Section", () => {
    // Note: This test is skipped due to a known caching issue where TanStack Query
    // caches the teams list for 5 minutes, so newly created teams don't appear
    // in the workspace context immediately. The page shows stale team data.
    // TODO: Fix this by invalidating workspace cache after team creation
    test.skip("should display current team name", async () => {
      // This test requires UI team creation to test cache consistency
      // Skipped due to known caching issue
    });

    test("should update team name", async ({ teamSettingsPage, authenticatedApiContext }, testInfo) => {
      const { organization } = await getOrgAndTeam(authenticatedApiContext);
      const teamName = generateTeamName();
      const team = await createResource<Team>(
        authenticatedApiContext,
        `/v1/organizations/${organization.id}/teams`,
        { name: teamName }
      );

      try {
        const newName = generateTeamName("Updated");
        logTestData({ testName: testInfo.title, teamId: team.id, originalName: teamName, newName });

        await teamSettingsPage.gotoGeneralSection(team.id);

        // Update name
        await teamSettingsPage.fillName(newName);
        await teamSettingsPage.expectSaveButtonEnabled();
        await teamSettingsPage.saveChanges();

        // Verify change persisted
        await teamSettingsPage.page.reload();
        await teamSettingsPage.expectNameValue(newName);
      } finally {
        await deleteResource(authenticatedApiContext, `/v1/organizations/${organization.id}/teams/${team.id}`);
      }
    });

    test("should update team description", async ({ teamSettingsPage, authenticatedApiContext }, testInfo) => {
      const { organization } = await getOrgAndTeam(authenticatedApiContext);
      const team = await createResource<Team>(
        authenticatedApiContext,
        `/v1/organizations/${organization.id}/teams`,
        { name: generateTeamName() }
      );

      try {
        const newDescription = `Updated description at ${new Date().toISOString()}`;
        logTestData({ testName: testInfo.title, teamId: team.id, newDescription });

        await teamSettingsPage.gotoGeneralSection(team.id);

        // Update description
        await teamSettingsPage.fillDescription(newDescription);
        await teamSettingsPage.expectSaveButtonEnabled();
        await teamSettingsPage.saveChanges();

        // Verify by checking save button goes back to disabled
        await expect(teamSettingsPage.saveButton).toBeDisabled({ timeout: 5000 });
      } finally {
        await deleteResource(authenticatedApiContext, `/v1/organizations/${organization.id}/teams/${team.id}`);
      }
    });

    test("should show validation error for empty name", async ({ teamSettingsPage, authenticatedApiContext }) => {
      const { organization } = await getOrgAndTeam(authenticatedApiContext);
      const team = await createResource<Team>(
        authenticatedApiContext,
        `/v1/organizations/${organization.id}/teams`,
        { name: generateTeamName() }
      );

      try {
        await teamSettingsPage.gotoGeneralSection(team.id);

        // Clear name
        await teamSettingsPage.fillName("");

        // Save button should still be enabled (dirty state)
        await teamSettingsPage.expectSaveButtonEnabled();

        // Click save
        await teamSettingsPage.saveChanges();

        // Validation error should appear (React Hook Form + Zod validation)
        // The form shows an error message "Name is required" via Zod schema
        await teamSettingsPage.expectValidationError();
      } finally {
        await deleteResource(authenticatedApiContext, `/v1/organizations/${organization.id}/teams/${team.id}`);
      }
    });
  });

  test.describe("Logo Management", () => {
    // This test needs a real image file - we'll create a test fixture
    const testLogoPath = path.join(__dirname, "../../fixtures/test-logo.png");

    test.skip("should upload team logo", async ({ teamSettingsPage, authenticatedApiContext }) => {
      const { organization } = await getOrgAndTeam(authenticatedApiContext);
      const team = await createResource<Team>(
        authenticatedApiContext,
        `/v1/organizations/${organization.id}/teams`,
        { name: generateTeamName() }
      );

      try {
        await teamSettingsPage.gotoGeneralSection(team.id);

        // Upload logo
        await teamSettingsPage.uploadLogo(testLogoPath);

        // Wait for upload to complete and logo to appear
        await teamSettingsPage.expectLogoVisible();
      } finally {
        await deleteResource(authenticatedApiContext, `/v1/organizations/${organization.id}/teams/${team.id}`);
      }
    });

    test.skip("should remove team logo", async ({ teamSettingsPage, authenticatedApiContext }) => {
      const { organization } = await getOrgAndTeam(authenticatedApiContext);
      const team = await createResource<Team>(
        authenticatedApiContext,
        `/v1/organizations/${organization.id}/teams`,
        { name: generateTeamName() }
      );

      try {
        await teamSettingsPage.gotoGeneralSection(team.id);

        // Upload logo first
        await teamSettingsPage.uploadLogo(testLogoPath);
        await teamSettingsPage.expectLogoVisible();

        // Remove logo
        await teamSettingsPage.removeLogo();

        // Logo should be removed
        await teamSettingsPage.expectLogoNotVisible();
      } finally {
        await deleteResource(authenticatedApiContext, `/v1/organizations/${organization.id}/teams/${team.id}`);
      }
    });
  });

  test.describe("Navigation", () => {
    test("should navigate to team settings from sidebar menu", async (
      { page, sidebarPage, teamSettingsPage, authenticatedApiContext },
    ) => {
      const { organization } = await getOrgAndTeam(authenticatedApiContext);
      const team = await createResource<Team>(
        authenticatedApiContext,
        `/v1/organizations/${organization.id}/teams`,
        { name: generateTeamName() }
      );

      try {
        await page.goto("/");
        // Wait for desktop layout to load
        await expect(page.getByTestId("app-root-desktop")).toBeVisible();

        // Click team settings from sidebar menu (SidebarPage already scopes to desktop)
        await sidebarPage.clickTeamSettings(team.id);

        // Should be on team settings page
        await expect(teamSettingsPage.settingsPage).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`/org/team/${team.id}/settings`));
      } finally {
        await deleteResource(authenticatedApiContext, `/v1/organizations/${organization.id}/teams/${team.id}`);
      }
    });
  });
});
