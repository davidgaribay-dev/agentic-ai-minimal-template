import { type Locator, type Page, expect } from "@playwright/test";
import { TIMEOUTS } from "../utils";

export class LoginPage {
  readonly page: Page;
  readonly form: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly signUpLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.form = page.getByTestId("login-form");
    this.emailInput = page.getByTestId("login-email-input");
    this.passwordInput = page.getByTestId("login-password-input");
    this.submitButton = page.getByTestId("login-submit-button");
    this.errorMessage = page.getByTestId("login-error");
    this.signUpLink = page.getByTestId("signup-link");
  }

  async goto() {
    await this.page.goto("/login");
    await this.expectToBeOnLoginPage();
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async loginAndWaitForSuccess(email: string, password: string) {
    await this.login(email, password);
    await this.expectToBeLoggedIn();
  }

  async expectErrorMessage(message?: string | RegExp) {
    await expect(this.errorMessage).toBeVisible();
    if (message) {
      await expect(this.errorMessage).toContainText(message);
    }
  }

  async expectToBeOnLoginPage() {
    await expect(this.page).toHaveURL(/\/login/);
  }

  async expectToBeLoggedIn() {
    await expect(this.page).not.toHaveURL(/\/login/, { timeout: TIMEOUTS.medium });
  }

  async expectFormVisible() {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
    await expect(this.submitButton).toBeEnabled();
  }
}
