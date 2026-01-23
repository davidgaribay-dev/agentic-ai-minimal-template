import { type Locator, type Page, expect } from "@playwright/test";
import { TIMEOUTS } from "../utils";

export class SignupPage {
  readonly page: Page;

  readonly emailForm: Locator;
  readonly emailInput: Locator;
  readonly emailContinueButton: Locator;

  readonly passwordForm: Locator;
  readonly passwordInput: Locator;
  readonly passwordSubmitButton: Locator;

  readonly nameForm: Locator;
  readonly nameInput: Locator;
  readonly nameSubmitButton: Locator;
  readonly nameBackButton: Locator;

  readonly workspaceForm: Locator;
  readonly workspaceInput: Locator;
  readonly workspaceLogoUpload: Locator;
  readonly workspaceLogoRemove: Locator;
  readonly workspaceSubmitButton: Locator;
  readonly workspaceBackButton: Locator;

  readonly teamForm: Locator;
  readonly teamInput: Locator;
  readonly teamLogoUpload: Locator;
  readonly teamLogoRemove: Locator;
  readonly finalSubmitButton: Locator;

  readonly errorMessage: Locator;
  readonly loginLink: Locator;

  constructor(page: Page) {
    this.page = page;

    this.emailForm = page.getByTestId("signup-form-email");
    this.emailInput = page.getByTestId("signup-email-input");
    this.emailContinueButton = page.getByTestId("signup-continue-button");

    this.passwordForm = page.getByTestId("signup-form-password");
    this.passwordInput = page.getByTestId("signup-password-input");
    this.passwordSubmitButton = page.getByTestId("signup-password-submit");

    this.nameForm = page.getByTestId("signup-form-name");
    this.nameInput = page.getByTestId("signup-name-input");
    this.nameSubmitButton = page.getByTestId("signup-name-submit");
    this.nameBackButton = page.getByTestId("signup-name-back");

    this.workspaceForm = page.getByTestId("signup-form-workspace");
    this.workspaceInput = page.getByTestId("signup-workspace-input");
    this.workspaceLogoUpload = page.getByTestId("signup-workspace-logo-upload");
    this.workspaceLogoRemove = page.getByTestId("signup-workspace-logo-remove");
    this.workspaceSubmitButton = page.getByTestId("signup-workspace-submit");
    this.workspaceBackButton = page.getByTestId("signup-workspace-back");

    this.teamForm = page.getByTestId("signup-form-team");
    this.teamInput = page.getByTestId("signup-team-input");
    this.teamLogoUpload = page.getByTestId("signup-team-logo-upload");
    this.teamLogoRemove = page.getByTestId("signup-team-logo-remove");
    this.finalSubmitButton = page.getByTestId("signup-submit-button");

    this.errorMessage = page.getByTestId("signup-error");
    this.loginLink = page.getByTestId("back-to-login-link");
  }

  async goto() {
    await this.page.goto("/signup");
    await this.expectToBeOnSignupPage();
  }

  async fillEmail(email: string) {
    await expect(this.emailInput).toBeVisible();
    await this.emailInput.fill(email);
    await this.emailContinueButton.click();
  }

  async fillPassword(password: string) {
    await expect(this.passwordInput).toBeVisible();
    await this.passwordInput.fill(password);
    await this.passwordSubmitButton.click();
  }

  async fillName(name: string = "") {
    await expect(this.nameInput).toBeVisible();
    if (name) {
      await this.nameInput.fill(name);
    }
    await this.nameSubmitButton.click();
  }

  async fillWorkspace(workspaceName: string) {
    await expect(this.workspaceInput).toBeVisible();
    await this.workspaceInput.fill(workspaceName);
    await this.workspaceSubmitButton.click();
  }

  async fillTeamAndSubmit(teamName: string = "") {
    await expect(this.teamInput).toBeVisible();
    if (teamName) {
      await this.teamInput.fill(teamName);
    }
    await this.finalSubmitButton.click();
  }

  async completeSignup(options: {
    email: string;
    password: string;
    name?: string;
    workspaceName: string;
    teamName?: string;
  }) {
    await this.expectStep("email");
    await this.fillEmail(options.email);

    await this.expectStep("password");
    await this.fillPassword(options.password);

    await this.expectStep("name");
    await this.fillName(options.name);

    await this.expectStep("workspace");
    await this.fillWorkspace(options.workspaceName);

    await this.expectStep("team");
    await this.fillTeamAndSubmit(options.teamName);
  }

  async goBackFromName() {
    await this.nameBackButton.click();
    await this.expectStep("password");
  }

  async goBackFromWorkspace() {
    await this.workspaceBackButton.click();
    await this.expectStep("name");
  }

  async expectErrorMessage(message?: string | RegExp) {
    await expect(this.errorMessage).toBeVisible();
    if (message) {
      await expect(this.errorMessage).toContainText(message);
    }
  }

  async expectNoError() {
    await expect(this.errorMessage).not.toBeVisible();
  }

  async expectToBeOnSignupPage() {
    await expect(this.page).toHaveURL(/\/signup/);
  }

  async expectStep(step: "email" | "password" | "name" | "workspace" | "team") {
    const formLocators = {
      email: this.emailForm,
      password: this.passwordForm,
      name: this.nameForm,
      workspace: this.workspaceForm,
      team: this.teamForm,
    };
    await expect(formLocators[step]).toBeVisible();
  }

  async expectEmailDisplayed(email: string) {
    await expect(this.page.getByText(email)).toBeVisible();
  }

  async expectSignupComplete() {
    await expect(this.page).not.toHaveURL(/\/signup/, { timeout: TIMEOUTS.long });
    await expect(this.page).toHaveURL(/\/chat/, { timeout: TIMEOUTS.medium });
  }

  async expectSubmitButtonLoading() {
    await expect(this.finalSubmitButton).toBeDisabled();
  }

  async expectSubmitButtonEnabled() {
    await expect(this.finalSubmitButton).toBeEnabled();
  }
}
