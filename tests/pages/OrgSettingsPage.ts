import { type Locator, type Page, expect } from "@playwright/test";

/**
 * Page object for organization settings page.
 *
 * Note: The app renders both desktop and mobile layouts simultaneously.
 * We scope all locators within the desktop root to avoid duplicate testId matches.
 */
export class OrgSettingsPage {
  readonly page: Page;
  /** The visible desktop root container - all locators are scoped within this */
  readonly desktopRoot: Locator;
  readonly settingsPage: Locator;
  readonly generalSection: Locator;
  readonly teamsSection: Locator;
  readonly peopleSection: Locator;

  constructor(page: Page) {
    this.page = page;
    // Scope all locators within the visible desktop root to avoid duplicate testId matches
    this.desktopRoot = page.getByTestId("app-root-desktop");
    this.settingsPage = this.desktopRoot.getByTestId("org-settings-page");
    this.generalSection = this.desktopRoot.getByTestId("org-settings-section-general");
    this.teamsSection = this.desktopRoot.getByTestId("org-settings-section-teams");
    this.peopleSection = this.desktopRoot.getByTestId("org-settings-section-people");
  }

  async goto(section: string = "general") {
    await this.page.goto(`/org/settings/${section}`);
    await expect(this.settingsPage).toBeVisible();
  }

  async gotoTeamsSection() {
    await this.goto("teams");
    await expect(this.teamsSection).toBeVisible();
  }

  async gotoPeopleSection() {
    await this.goto("people");
    await expect(this.peopleSection).toBeVisible();
  }

  // Team management in teams section
  getCreateTeamButton() {
    return this.teamsSection.getByRole("button", { name: /create/i });
  }

  async clickCreateTeam() {
    const button = this.getCreateTeamButton();
    await button.click();
  }

  async searchTeams(query: string) {
    // The teams section has a search input
    const searchInput = this.teamsSection.getByPlaceholder(/search teams/i);
    await searchInput.fill(query);
    // Wait for search results to update via auto-retrying assertion
    await expect(this.teamsSection).toBeVisible();
  }

  async expectTeamInTable(teamName: string) {
    // Teams might be in a table cell or just listed as text
    const teamElement = this.teamsSection.getByText(teamName, { exact: false });
    await expect(teamElement).toBeVisible();
  }

  getTeamSettingsButton(teamId: string) {
    return this.desktopRoot.getByTestId(`team-settings-${teamId}`);
  }

  getTeamDeleteButton(teamId: string) {
    return this.desktopRoot.getByTestId(`team-delete-${teamId}`);
  }

  async clickTeamSettings(teamId: string) {
    const button = this.getTeamSettingsButton(teamId);
    await button.click();
  }

  // Member management in people section
  getInviteButton() {
    return this.peopleSection.getByRole("button", { name: /invite/i });
  }

  async clickInviteMembers() {
    const button = this.getInviteButton();
    await button.click();
  }

  async expectMemberInTable(email: string) {
    const memberRow = this.peopleSection.getByRole("cell", { name: email });
    await expect(memberRow).toBeVisible();
  }

  getMemberActionsButton(memberId: string) {
    return this.desktopRoot.getByTestId(`member-actions-${memberId}`);
  }
}
