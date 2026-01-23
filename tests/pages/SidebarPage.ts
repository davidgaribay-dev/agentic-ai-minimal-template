import { type Locator, type Page, expect } from "@playwright/test";

/**
 * Page object for sidebar interactions.
 *
 * Note: The app renders both desktop (hidden md:grid) and mobile (md:hidden)
 * layouts simultaneously, with CSS controlling visibility. To avoid duplicate
 * testId matches, we scope all locators within the visible desktop root container.
 * This follows Playwright best practices for responsive layouts.
 *
 * @see https://playwright.dev/docs/locators#filtering-locators
 */
export class SidebarPage {
  readonly page: Page;
  /** The visible desktop root container - all sidebar locators are scoped within this */
  readonly desktopRoot: Locator;
  readonly sidebar: Locator;
  readonly teamsSection: Locator;
  readonly teamsSectionHeader: Locator;
  readonly createTeamButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // Scope all locators within the visible desktop root to avoid duplicate testId matches
    // The desktop layout uses "hidden md:grid" so it's visible on desktop viewports
    this.desktopRoot = page.getByTestId("app-root-desktop");
    this.sidebar = this.desktopRoot.getByTestId("app-sidebar-container");
    this.teamsSection = this.desktopRoot.getByTestId("sidebar-section-teams");
    this.teamsSectionHeader = this.desktopRoot.getByTestId("sidebar-section-teams-header");
    this.createTeamButton = this.desktopRoot.getByTestId("sidebar-create-team-button");
  }

  async clickCreateTeamButton() {
    // Hover over the teams section header to reveal the create button
    await this.teamsSectionHeader.hover();
    await expect(this.createTeamButton).toBeVisible();
    await this.createTeamButton.click();
  }

  getTeamItem(teamId: string) {
    return this.desktopRoot.getByTestId(`sidebar-team-item-${teamId}`);
  }

  getTeamMenuButton(teamId: string) {
    return this.desktopRoot.getByTestId(`sidebar-team-menu-${teamId}`);
  }

  getTeamSettingsLink(teamId: string) {
    return this.desktopRoot.getByTestId(`sidebar-team-settings-${teamId}`);
  }

  async openTeamMenu(teamId: string) {
    const teamItem = this.getTeamItem(teamId);
    await teamItem.hover();
    const menuButton = this.getTeamMenuButton(teamId);
    await menuButton.click();
  }

  async clickTeamSettings(teamId: string) {
    await this.openTeamMenu(teamId);
    // Dropdown menus are often portaled to body, so we need to search globally
    // Wait for the dropdown to appear and click the settings link
    const settingsLink = this.page.getByTestId(`sidebar-team-settings-${teamId}`);
    await settingsLink.click();
  }

  async expectTeamVisible(teamName: string) {
    // Use desktopRoot to scope the search within the visible sidebar
    const teamItem = this.desktopRoot.getByRole("button", { name: teamName });
    await expect(teamItem).toBeVisible();
  }

  async expectTeamVisibleById(teamId: string) {
    const teamItem = this.getTeamItem(teamId);
    await expect(teamItem).toBeVisible();
  }

  async expectSidebarVisible() {
    await expect(this.sidebar).toBeVisible();
  }

  async clickTeam(teamName: string) {
    const teamItem = this.desktopRoot.getByRole("button", { name: teamName });
    await teamItem.click();
  }
}
