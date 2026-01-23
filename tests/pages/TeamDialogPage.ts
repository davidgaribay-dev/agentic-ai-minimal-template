import { type Locator, type Page, expect } from "@playwright/test";

export class TeamDialogPage {
  readonly page: Page;

  // Sidebar dialog elements
  readonly dialog: Locator;
  readonly nameInput: Locator;
  readonly descriptionTextarea: Locator;
  readonly submitButton: Locator;

  // Org settings dialog elements (alternative selectors)
  readonly orgDialog: Locator;
  readonly orgNameInput: Locator;
  readonly orgSubmitButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Sidebar create team dialog
    this.dialog = page.getByTestId("create-team-dialog");
    this.nameInput = page.getByTestId("create-team-name-input");
    this.submitButton = page.getByTestId("create-team-submit-button");

    // Description textarea with testId
    this.descriptionTextarea = page.getByTestId("create-team-description-textarea");

    // Org settings create team dialog
    this.orgDialog = page.getByTestId("create-team-dialog-org");
    this.orgNameInput = page.getByTestId("create-team-name-input-org");
    this.orgSubmitButton = page.getByTestId("create-team-submit-org");
  }

  async fillTeamName(name: string, fromOrgSettings = false) {
    const input = fromOrgSettings ? this.orgNameInput : this.nameInput;
    await expect(input).toBeVisible();
    await input.fill(name);
  }

  async fillTeamDescription(description: string) {
    await expect(this.descriptionTextarea).toBeVisible();
    await this.descriptionTextarea.fill(description);
  }

  async submitCreateTeam(fromOrgSettings = false) {
    const button = fromOrgSettings ? this.orgSubmitButton : this.submitButton;
    await button.click();
  }

  async createTeam(name: string, description?: string, fromOrgSettings = false) {
    await this.fillTeamName(name, fromOrgSettings);
    if (description) {
      await this.fillTeamDescription(description);
    }
    await this.submitCreateTeam(fromOrgSettings);
  }

  async expectDialogOpen(fromOrgSettings = false) {
    const dialog = fromOrgSettings ? this.orgDialog : this.dialog;
    await expect(dialog).toBeVisible();
  }

  async expectDialogClosed(fromOrgSettings = false) {
    const dialog = fromOrgSettings ? this.orgDialog : this.dialog;
    await expect(dialog).not.toBeVisible();
  }

  async expectSubmitDisabled(fromOrgSettings = false) {
    const button = fromOrgSettings ? this.orgSubmitButton : this.submitButton;
    await expect(button).toBeDisabled();
  }

  async expectSubmitEnabled(fromOrgSettings = false) {
    const button = fromOrgSettings ? this.orgSubmitButton : this.submitButton;
    await expect(button).toBeEnabled();
  }
}
