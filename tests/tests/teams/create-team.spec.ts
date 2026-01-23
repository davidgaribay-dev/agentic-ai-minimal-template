import { authenticatedTeamTest as test, expect } from "../../fixtures";
import { createTeamTestData } from "../../utils/test-data";
import { logTestData } from "../../utils/logger";

test.describe("Team Creation", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page (authenticated)
    await page.goto("/");
    // Wait for desktop layout to load (contains the sidebar)
    // We use desktop root to scope all locators and avoid duplicate testId matches
    await expect(page.getByTestId("app-root-desktop")).toBeVisible();
  });

  test.describe("Via Sidebar", () => {
    test("should create team with name only", async (
      { sidebarPage, teamDialogPage },
      testInfo,
    ) => {
      const teamData = createTeamTestData({ description: "" });
      logTestData({ testName: testInfo.title, ...teamData });

      // Open create team dialog from sidebar
      await sidebarPage.clickCreateTeamButton();
      await teamDialogPage.expectDialogOpen();

      // Fill team name and submit
      await teamDialogPage.createTeam(teamData.name);

      // Dialog should close after successful creation
      await teamDialogPage.expectDialogClosed();

      // New team should appear in sidebar
      await sidebarPage.expectTeamVisible(teamData.name);
    });

    test("should create team with name and description", async (
      { sidebarPage, teamDialogPage },
      testInfo,
    ) => {
      const teamData = createTeamTestData();
      logTestData({ testName: testInfo.title, ...teamData });

      // Open create team dialog from sidebar
      await sidebarPage.clickCreateTeamButton();
      await teamDialogPage.expectDialogOpen();

      // Fill team name and description
      await teamDialogPage.createTeam(teamData.name, teamData.description);

      // Dialog should close after successful creation
      await teamDialogPage.expectDialogClosed();

      // New team should appear in sidebar
      await sidebarPage.expectTeamVisible(teamData.name);
    });

    test("should not allow empty team name", async (
      { sidebarPage, teamDialogPage },
    ) => {
      // Open create team dialog from sidebar
      await sidebarPage.clickCreateTeamButton();
      await teamDialogPage.expectDialogOpen();

      // Submit button should be disabled when name is empty
      await teamDialogPage.expectSubmitDisabled();

      // Fill some text then clear it
      await teamDialogPage.fillTeamName("test");
      await teamDialogPage.expectSubmitEnabled();

      await teamDialogPage.fillTeamName("");
      await teamDialogPage.expectSubmitDisabled();
    });

    test("should auto-switch to new team after creation", async (
      { page, sidebarPage, teamDialogPage },
      testInfo,
    ) => {
      const teamData = createTeamTestData();
      logTestData({ testName: testInfo.title, ...teamData });

      // Open create team dialog and create team
      await sidebarPage.clickCreateTeamButton();
      await teamDialogPage.createTeam(teamData.name);

      // Wait for navigation to team chat
      await page.waitForURL(/\/team\/.*\/chat/);

      // Team should be selected in sidebar (expanded)
      await sidebarPage.expectTeamVisible(teamData.name);
    });
  });

  test.describe("Via Org Settings", () => {
    test("should create team from teams section", async (
      { orgSettingsPage, teamDialogPage },
      testInfo,
    ) => {
      const teamData = createTeamTestData();
      logTestData({ testName: testInfo.title, ...teamData });

      // Navigate to org settings teams section
      await orgSettingsPage.gotoTeamsSection();

      // Click create team button
      await orgSettingsPage.clickCreateTeam();

      // Dialog should open
      await teamDialogPage.expectDialogOpen(true);

      // Fill team name and submit
      await teamDialogPage.createTeam(teamData.name, teamData.description, true);

      // Dialog should close - this confirms the team was created successfully
      await teamDialogPage.expectDialogClosed(true);

      // Search for the team using the search input (handles pagination)
      await orgSettingsPage.searchTeams(teamData.name);

      // Team should appear in filtered results
      await orgSettingsPage.expectTeamInTable(teamData.name);
    });
  });
});
