import { type Locator, type Page, expect } from "@playwright/test";
import { logger } from "../utils/logger";

/**
 * Page object for team settings page.
 *
 * Note: The app renders both desktop and mobile layouts simultaneously.
 * We scope all locators within the desktop root to avoid duplicate testId matches.
 */
export class TeamSettingsPage {
  readonly page: Page;
  /** The visible desktop root container - all locators are scoped within this */
  readonly desktopRoot: Locator;
  readonly settingsPage: Locator;
  readonly generalSection: Locator;
  readonly peopleSection: Locator;
  readonly entityDetails: Locator;
  readonly nameInput: Locator;
  readonly saveButton: Locator;
  readonly membersSection: Locator;

  constructor(page: Page) {
    this.page = page;
    // Scope all locators within the visible desktop root to avoid duplicate testId matches
    this.desktopRoot = page.getByTestId("app-root-desktop");
    this.settingsPage = this.desktopRoot.getByTestId("team-settings-page");
    this.generalSection = this.desktopRoot.getByTestId("team-settings-section-general");
    this.peopleSection = this.desktopRoot.getByTestId("team-settings-section-people");
    this.entityDetails = this.desktopRoot.getByTestId("entity-details");
    this.nameInput = this.desktopRoot.getByTestId("entity-name-input");
    this.saveButton = this.desktopRoot.getByTestId("entity-save-button");
    this.membersSection = this.desktopRoot.getByTestId("team-members-section");
  }

  async goto(teamId: string, section: string = "general") {
    const url = `/org/team/${teamId}/settings/${section}`;
    logger.debug("navigation", { page: "TeamSettingsPage", action: "navigating", url });
    await this.page.goto(url, { waitUntil: "networkidle" });
    logger.debug("navigation", {
      page: "TeamSettingsPage",
      action: "navigated",
      currentUrl: this.page.url(),
    });
    await expect(this.settingsPage).toBeVisible();
  }

  async gotoGeneralSection(teamId: string) {
    await this.goto(teamId, "general");
    await expect(this.generalSection).toBeVisible();
  }

  async gotoPeopleSection(teamId: string) {
    await this.goto(teamId, "people");
    await expect(this.peopleSection).toBeVisible();
  }

  // General settings
  async fillName(name: string) {
    await this.nameInput.clear();
    await this.nameInput.fill(name);
  }

  async fillDescription(description: string) {
    const textarea = this.desktopRoot.getByTestId("entity-description-textarea");
    await textarea.clear();
    await textarea.fill(description);
  }

  async saveChanges() {
    await this.saveButton.click();
  }

  async expectSaveButtonEnabled() {
    await expect(this.saveButton).toBeEnabled();
  }

  async expectSaveButtonDisabled() {
    await expect(this.saveButton).toBeDisabled();
  }

  async expectNameValue(name: string) {
    await expect(this.nameInput).toHaveValue(name);
  }

  async expectValidationError() {
    // React Hook Form with Zod shows validation errors as text
    // The error message is "Name is required" from Zod schema
    const errorMessage = this.entityDetails.getByText(/required/i);
    await expect(errorMessage).toBeVisible();
  }

  // Logo management
  getLogoButton() {
    // The logo button is a dropdown trigger in entity details
    return this.entityDetails.getByTestId("entity-logo-button");
  }

  async clickLogoButton() {
    const button = this.getLogoButton();
    await button.click();
  }

  async uploadLogo(filePath: string) {
    // Set up file chooser listener before clicking
    const fileChooserPromise = this.page.waitForEvent("filechooser");

    // Click logo to open dropdown
    await this.clickLogoButton();

    // Click upload option (scoped within desktop root)
    const uploadOption = this.desktopRoot.getByRole("menuitem", { name: /upload|change/i });
    await uploadOption.click();

    // Handle file chooser
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);
  }

  async removeLogo() {
    await this.clickLogoButton();
    const removeOption = this.desktopRoot.getByRole("menuitem", { name: /remove/i });
    await removeOption.click();
  }

  async expectLogoVisible() {
    const logoImage = this.entityDetails.locator("img").first();
    await expect(logoImage).toBeVisible();
  }

  async expectLogoNotVisible() {
    const logoImage = this.entityDetails.locator("img").first();
    await expect(logoImage).not.toBeVisible();
  }

  // Team members management
  getAddMemberButton() {
    return this.desktopRoot.getByTestId("add-team-member-trigger");
  }

  async clickAddMember() {
    const button = this.getAddMemberButton();
    await button.click();
  }

  getMemberActionsButton(memberId: string) {
    return this.desktopRoot.getByTestId(`team-member-actions-${memberId}`);
  }

  async openMemberMenu(memberId: string) {
    const button = this.getMemberActionsButton(memberId);
    await button.click();
  }

  async expectMemberInList(email: string) {
    const memberRow = this.membersSection.getByText(email);
    await expect(memberRow).toBeVisible();
  }
}
