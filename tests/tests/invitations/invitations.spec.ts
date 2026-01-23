import {
  authenticatedTeamTest as test,
  unauthenticatedTeamTest,
  expect,
} from "../../fixtures";
import {
  createInvitationTestData,
  createBulkInvitationTestData,
  generateTestPassword,
  generateFullName,
} from "../../utils/test-data";
import { logTestData } from "../../utils/logger";

test.describe("Invitations", () => {
  test.describe("Sending Invitations", () => {
    test.beforeEach(async ({ orgSettingsPage }) => {
      // Navigate to org settings people section
      await orgSettingsPage.gotoPeopleSection();
    });

    test("should send invitation to single email", async (
      { orgSettingsPage, invitationDialogPage },
      testInfo,
    ) => {
      const inviteData = createInvitationTestData();
      logTestData({ testName: testInfo.title, ...inviteData });

      // Click invite members button
      await orgSettingsPage.clickInviteMembers();
      await invitationDialogPage.expectDialogOpen();

      // Fill email and send
      await invitationDialogPage.fillEmails(inviteData.email);
      await invitationDialogPage.sendInvites();

      // Should show success
      await invitationDialogPage.expectInvitesSent();
    });

    test("should send bulk invitations", async (
      { orgSettingsPage, invitationDialogPage },
      testInfo,
    ) => {
      const inviteDataList = createBulkInvitationTestData(3);
      const emails = inviteDataList.map((d) => d.email);
      logTestData({ testName: testInfo.title, emails });

      // Click invite members button
      await orgSettingsPage.clickInviteMembers();
      await invitationDialogPage.expectDialogOpen();

      // Fill multiple emails
      await invitationDialogPage.fillEmails(emails);
      await invitationDialogPage.sendInvites();

      // Should show success
      await invitationDialogPage.expectInvitesSent();
    });

    test.skip("should select role for invitation", async (
      { orgSettingsPage, invitationDialogPage },
      testInfo,
    ) => {
      const inviteData = createInvitationTestData({ orgRole: "admin" });
      logTestData({ testName: testInfo.title, ...inviteData });

      // Click invite members button
      await orgSettingsPage.clickInviteMembers();
      await invitationDialogPage.expectDialogOpen();

      // Fill email and select role
      await invitationDialogPage.fillEmails(inviteData.email);
      await invitationDialogPage.selectRole("admin");
      await invitationDialogPage.sendInvites();

      // Should show success
      await invitationDialogPage.expectInvitesSent();
    });
  });

  test.describe("Pending Invitations", () => {
    test("should show pending invitations section", async (
      { orgSettingsPage },
    ) => {
      // Navigate to org settings people section
      await orgSettingsPage.gotoPeopleSection();

      // Pending invitations section should be visible (or empty state)
      // The section may or may not have invitations depending on test order
      await expect(orgSettingsPage.peopleSection).toBeVisible();
    });

    test.skip("should resend invitation", async (
      { orgSettingsPage, invitationDialogPage, pendingInvitationsPage },
      testInfo,
    ) => {
      const inviteData = createInvitationTestData();
      logTestData({ testName: testInfo.title, ...inviteData });

      // First, create an invitation
      await orgSettingsPage.gotoPeopleSection();
      await orgSettingsPage.clickInviteMembers();
      await invitationDialogPage.fillEmails(inviteData.email);
      await invitationDialogPage.sendInvites();
      await invitationDialogPage.expectInvitesSent();

      // Close dialog and find the pending invitation
      await pendingInvitationsPage.expectInvitationVisible(inviteData.email);

      // Resend would need the invitation ID
      // This test is incomplete without knowing the invitation ID
    });

    test.skip("should cancel pending invitation", async (
      { orgSettingsPage, invitationDialogPage },
      testInfo,
    ) => {
      const inviteData = createInvitationTestData();
      logTestData({ testName: testInfo.title, ...inviteData });

      // First, create an invitation
      await orgSettingsPage.gotoPeopleSection();
      await orgSettingsPage.clickInviteMembers();
      await invitationDialogPage.fillEmails(inviteData.email);
      await invitationDialogPage.sendInvites();
      await invitationDialogPage.expectInvitesSent();

      // Cancel would need the invitation ID
      // This test is incomplete without knowing the invitation ID
    });
  });
});

// Accepting invitations requires unauthenticated context
unauthenticatedTeamTest.describe("Invitation Acceptance", () => {
  // Note: These tests require a valid invitation token
  // In a real E2E test, we'd need to:
  // 1. Create an invitation via API or UI (with an authenticated user)
  // 2. Extract the token
  // 3. Use an unauthenticated context to accept it

  unauthenticatedTeamTest.skip("should display invitation details", async (
    { inviteAcceptPage },
  ) => {
    // This test requires a valid token
    const testToken = "test-token"; // Would need real token

    await inviteAcceptPage.goto(testToken);

    // Should show invitation details
    await inviteAcceptPage.expectInviteDetails({
      organizationName: "Test Workspace",
    });
  });

  unauthenticatedTeamTest.skip("should complete signup via invitation", async (
    { inviteAcceptPage },
    testInfo,
  ) => {
    // This test requires a valid token
    const testToken = "test-token"; // Would need real token
    const password = generateTestPassword();
    const name = generateFullName();

    logTestData({ testName: testInfo.title, name, token: testToken });

    await inviteAcceptPage.goto(testToken);

    // Fill signup form
    await inviteAcceptPage.submitNewUser(name, password);

    // Should redirect to home after successful signup
    await inviteAcceptPage.expectJoinSuccess();
  });

  unauthenticatedTeamTest.skip("should show error for short password", async (
    { inviteAcceptPage },
  ) => {
    const testToken = "test-token"; // Would need real token

    await inviteAcceptPage.goto(testToken);

    // Try to submit with short password
    await inviteAcceptPage.fillName(generateFullName());
    await inviteAcceptPage.fillPassword("short");
    await inviteAcceptPage.fillConfirmPassword("short");
    await inviteAcceptPage.page.getByTestId("invite-submit-button").click();

    // Should show validation error
    await expect(inviteAcceptPage.passwordInput).toHaveJSProperty("validity.valid", false);
  });

  unauthenticatedTeamTest.skip("should show error for mismatched passwords", async (
    { inviteAcceptPage },
  ) => {
    const testToken = "test-token"; // Would need real token

    await inviteAcceptPage.goto(testToken);

    // Fill with mismatched passwords
    await inviteAcceptPage.fillName(generateFullName());
    await inviteAcceptPage.fillPassword(generateTestPassword());
    await inviteAcceptPage.fillConfirmPassword(generateTestPassword()); // Different password

    await inviteAcceptPage.page.getByTestId("invite-submit-button").click();

    // Should show error
    await inviteAcceptPage.expectError(/match|mismatch/i);
  });
});
