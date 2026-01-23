import { type Locator, type Page, expect } from "@playwright/test";

/**
 * Page object for sending invitations from org settings.
 *
 * Selector Strategy:
 * - Primary: getByTestId() for most elements (stable, explicit)
 * - Role-based: getByRole("option") for dropdown options (Radix Select portals to body,
 *   making testid-based selection impractical; role-based is the standard approach for
 *   accessible dropdown components)
 */
export class InvitationDialogPage {
  readonly page: Page;
  readonly dialog: Locator;
  readonly emailsInput: Locator;
  readonly roleSelect: Locator;
  readonly sendButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.getByTestId("invite-member-dialog");
    this.emailsInput = page.getByTestId("invite-emails-input");
    this.roleSelect = page.getByTestId("invite-role-select");
    this.sendButton = page.getByTestId("send-invites-button");
  }

  async fillEmails(emails: string | string[]) {
    const emailList = Array.isArray(emails) ? emails.join("\n") : emails;
    await this.emailsInput.fill(emailList);
  }

  async selectRole(role: "owner" | "admin" | "member") {
    await this.roleSelect.click();
    const roleOption = this.page.getByRole("option", { name: new RegExp(role, "i") });
    await roleOption.click();
  }

  async selectTeams(teamNames: string[]) {
    const teamsSelect = this.page.getByTestId("invite-teams-select");
    for (const teamName of teamNames) {
      await teamsSelect.click();
      const teamOption = this.page.getByRole("option", { name: teamName });
      await teamOption.click();
    }
  }

  async sendInvites() {
    await this.sendButton.click();
  }

  async expectDialogOpen() {
    await expect(this.dialog).toBeVisible();
  }

  async expectDialogClosed() {
    await expect(this.dialog).not.toBeVisible();
  }

  async expectInvitesSent() {
    // After sending, the dialog shows a success message like "1 invitation(s) sent successfully"
    const successMessage = this.dialog.getByText(/sent successfully/i);
    await expect(successMessage).toBeVisible();
  }

  async getInviteLink(email: string) {
    // After sending, invite links are shown
    const linkContainer = this.page.getByTestId(`invite-link-${email}`);
    if (await linkContainer.isVisible()) {
      return linkContainer.textContent();
    }
    return null;
  }

  async copyInviteLink(email: string) {
    const copyButton = this.page.getByTestId(`copy-invite-link-${email}`);
    await copyButton.click();
  }
}

/**
 * Page object for pending invitations section
 */
export class PendingInvitationsPage {
  readonly page: Page;
  readonly section: Locator;

  constructor(page: Page) {
    this.page = page;
    this.section = page.getByTestId("pending-invitations-section");
  }

  getInvitationRow(email: string) {
    return this.section.getByRole("row", { name: new RegExp(email, "i") });
  }

  async expectInvitationVisible(email: string) {
    const row = this.getInvitationRow(email);
    await expect(row).toBeVisible();
  }

  async resendInvitation(invitationId: string) {
    const resendButton = this.page.getByTestId(`invitation-resend-${invitationId}`);
    await resendButton.click();
  }

  async cancelInvitation(invitationId: string) {
    const cancelButton = this.page.getByTestId(`invitation-cancel-${invitationId}`);
    await cancelButton.click();
  }
}

/**
 * Page object for invitation acceptance page (/invite?token=...)
 */
export class InviteAcceptPage {
  readonly page: Page;
  readonly invitePage: Locator;
  readonly inviteForm: Locator;
  readonly nameInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly acceptButton: Locator;
  readonly errorContainer: Locator;
  readonly emailMismatchError: Locator;

  constructor(page: Page) {
    this.page = page;
    this.invitePage = page.getByTestId("invite-page");
    this.inviteForm = page.getByTestId("invite-form");
    this.nameInput = page.getByTestId("invite-name-input");
    this.passwordInput = page.getByTestId("invite-password-input");
    this.confirmPasswordInput = page.getByTestId("invite-confirm-password-input");
    this.submitButton = page.getByTestId("invite-submit-button");
    this.acceptButton = page.getByTestId("invite-accept-button");
    this.errorContainer = page.getByTestId("invite-error");
    this.emailMismatchError = page.getByTestId("invite-email-mismatch-error");
  }

  async goto(token: string) {
    await this.page.goto(`/invite?token=${token}`);
    await expect(this.invitePage).toBeVisible();
  }

  async fillName(name: string) {
    await this.nameInput.fill(name);
  }

  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  async fillConfirmPassword(password: string) {
    await this.confirmPasswordInput.fill(password);
  }

  async submitNewUser(name: string, password: string) {
    await this.fillName(name);
    await this.fillPassword(password);
    await this.fillConfirmPassword(password);
    await this.submitButton.click();
  }

  async acceptAsExistingUser() {
    await expect(this.acceptButton).toBeVisible();
    await this.acceptButton.click();
  }

  async expectInviteDetails(details: {
    organizationName?: string;
    teamName?: string;
    role?: string;
    invitedBy?: string;
  }) {
    if (details.organizationName) {
      await expect(this.invitePage.getByText(details.organizationName)).toBeVisible();
    }
    if (details.teamName) {
      await expect(this.invitePage.getByText(details.teamName)).toBeVisible();
    }
    if (details.role) {
      await expect(this.invitePage.getByText(new RegExp(details.role, "i"))).toBeVisible();
    }
    if (details.invitedBy) {
      await expect(this.invitePage.getByText(details.invitedBy)).toBeVisible();
    }
  }

  async expectJoinSuccess() {
    // After successful join, user should be redirected to home
    await expect(this.page).toHaveURL("/");
  }

  async expectError(message?: string | RegExp) {
    await expect(this.errorContainer).toBeVisible();
    if (message) {
      await expect(this.errorContainer).toContainText(message);
    }
  }

  async expectEmailMismatchError() {
    await expect(this.emailMismatchError).toBeVisible();
  }

  async expectFormVisible() {
    await expect(this.inviteForm).toBeVisible();
  }

  async expectAcceptButtonVisible() {
    await expect(this.acceptButton).toBeVisible();
  }
}
