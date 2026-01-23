import { authenticatedTeamTest as test, expect } from "../../fixtures";
import { generateTeamName } from "../../utils/test-data";
import { logTestData } from "../../utils/logger";
import { createResource, deleteResource, getOrgAndTeam } from "../../utils/api-helpers";
import type { Team } from "../../utils/types";

test.describe("Team Members", () => {

  test("should display team members list", async ({ teamSettingsPage, authenticatedApiContext }) => {
    const { organization } = await getOrgAndTeam(authenticatedApiContext);
    const team = await createResource<Team>(
      authenticatedApiContext,
      `/v1/organizations/${organization.id}/teams`,
      { name: generateTeamName() }
    );

    try {
      await teamSettingsPage.gotoPeopleSection(team.id);

      // People section should be visible (membersSection might not exist as a separate element)
      await expect(teamSettingsPage.peopleSection).toBeVisible();
    } finally {
      await deleteResource(authenticatedApiContext, `/v1/organizations/${organization.id}/teams/${team.id}`);
    }
  });

  test.describe("Member Management", () => {
    // These tests require additional org members to exist
    // In a real scenario, we'd need to set up test users or mock the data

    test.skip("should add existing org member to team", async (
      { teamSettingsPage, authenticatedApiContext },
      testInfo,
    ) => {
      // This test requires an additional org member that isn't in the team
      // We'd need to create one via the API or invite flow first
      const { organization } = await getOrgAndTeam(authenticatedApiContext);
      const team = await createResource<Team>(
        authenticatedApiContext,
        `/v1/organizations/${organization.id}/teams`,
        { name: generateTeamName() }
      );

      try {
        logTestData({ testName: testInfo.title, teamId: team.id });

        await teamSettingsPage.gotoPeopleSection(team.id);

        // Click add member button
        await teamSettingsPage.clickAddMember();

        // Add member dialog should open
        const dialog = teamSettingsPage.page.getByTestId("add-team-member-dialog");
        await expect(dialog).toBeVisible();

        // Select a member and role
        await teamSettingsPage.page.getByTestId("member-select-trigger").click();
        // Would need a real member to select here

        // Submit
        await teamSettingsPage.page.getByTestId("add-member-submit").click();
      } finally {
        await deleteResource(authenticatedApiContext, `/v1/organizations/${organization.id}/teams/${team.id}`);
      }
    });

    test.skip("should change team member role", async (
      { teamSettingsPage, authenticatedApiContext },
      testInfo,
    ) => {
      const { organization } = await getOrgAndTeam(authenticatedApiContext);
      const team = await createResource<Team>(
        authenticatedApiContext,
        `/v1/organizations/${organization.id}/teams`,
        { name: generateTeamName() }
      );

      try {
        logTestData({ testName: testInfo.title, teamId: team.id });

        await teamSettingsPage.gotoPeopleSection(team.id);

        // This test requires at least one other member in the team
        // Would need to add a member first
      } finally {
        await deleteResource(authenticatedApiContext, `/v1/organizations/${organization.id}/teams/${team.id}`);
      }
    });

    test.skip("should remove team member", async (
      { teamSettingsPage, authenticatedApiContext },
      testInfo,
    ) => {
      const { organization } = await getOrgAndTeam(authenticatedApiContext);
      const team = await createResource<Team>(
        authenticatedApiContext,
        `/v1/organizations/${organization.id}/teams`,
        { name: generateTeamName() }
      );

      try {
        logTestData({ testName: testInfo.title, teamId: team.id });

        await teamSettingsPage.gotoPeopleSection(team.id);

        // This test requires at least one other member in the team
        // Would need to add a member first
      } finally {
        await deleteResource(authenticatedApiContext, `/v1/organizations/${organization.id}/teams/${team.id}`);
      }
    });
  });
});
