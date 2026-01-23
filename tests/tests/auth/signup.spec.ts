import { unauthenticatedTest as test, expect } from "../../fixtures";
import {
  createSignupTestData,
  SHORT_PASSWORD,
  TEST_USERS,
} from "../../utils/test-data";
import { logTestData } from "../../utils/logger";

test.describe("Signup Flow", () => {
  test.beforeEach(async ({ signupPage }) => {
    await signupPage.goto();
  });

  test.describe("Happy Path", () => {
    test("should complete full signup flow with all fields", async ({ signupPage }, testInfo) => {
      const testData = createSignupTestData();
      logTestData({ testName: testInfo.title, ...testData });

      await signupPage.completeSignup(testData);
      await signupPage.expectSignupComplete();
    });

    test("should be able to sign out and sign back in after signup", async ({ signupPage, loginPage }, testInfo) => {
      const testData = createSignupTestData();
      logTestData({ testName: testInfo.title, ...testData });

      await signupPage.completeSignup(testData);
      await signupPage.expectSignupComplete();

      const userMenuTrigger = signupPage.page.getByTestId("nav-user-button").first();
      await userMenuTrigger.click();

      const logoutButton = signupPage.page.getByTestId("nav-user-logout");
      await logoutButton.click();

      await expect(signupPage.page).toHaveURL(/\/login/);

      await loginPage.login(testData.email, testData.password);
      await loginPage.expectToBeLoggedIn();
    });

    test("should complete signup with minimal required fields", async ({ signupPage }, testInfo) => {
      const testData = createSignupTestData({
        name: "",
        teamName: "",
      });
      logTestData({ testName: testInfo.title, ...testData });

      await signupPage.expectStep("email");
      await signupPage.fillEmail(testData.email);

      await signupPage.expectStep("password");
      await signupPage.fillPassword(testData.password);

      await signupPage.expectStep("name");
      await signupPage.fillName();

      await signupPage.expectStep("workspace");
      await signupPage.fillWorkspace(testData.workspaceName);

      await signupPage.expectStep("team");
      await signupPage.fillTeamAndSubmit();

      await signupPage.expectSignupComplete();
    });
  });

  test.describe("Step Navigation", () => {
    test("should start on email step", async ({ signupPage }) => {
      await signupPage.expectStep("email");
      await expect(signupPage.emailInput).toBeVisible();
      await expect(signupPage.emailContinueButton).toBeVisible();
    });

    test("should progress through all steps in order", async ({ signupPage }) => {
      const testData = createSignupTestData();

      await signupPage.expectStep("email");
      await signupPage.fillEmail(testData.email);

      await signupPage.expectStep("password");
      await signupPage.expectEmailDisplayed(testData.email);
      await signupPage.fillPassword(testData.password);

      await signupPage.expectStep("name");
      await signupPage.fillName(testData.name);

      await signupPage.expectStep("workspace");
      await signupPage.fillWorkspace(testData.workspaceName);

      await signupPage.expectStep("team");
      await expect(signupPage.finalSubmitButton).toBeVisible();
    });

    test("should allow going back from name step to password step", async ({ signupPage }) => {
      const testData = createSignupTestData();

      await signupPage.fillEmail(testData.email);
      await signupPage.fillPassword(testData.password);
      await signupPage.expectStep("name");

      await signupPage.goBackFromName();
      await signupPage.expectStep("password");
    });

    test("should allow going back from workspace step to name step", async ({ signupPage }) => {
      const testData = createSignupTestData();

      await signupPage.fillEmail(testData.email);
      await signupPage.fillPassword(testData.password);
      await signupPage.fillName(testData.name);
      await signupPage.expectStep("workspace");

      await signupPage.goBackFromWorkspace();
      await signupPage.expectStep("name");
    });

    test("should have link to login page from email step", async ({ signupPage }) => {
      await expect(signupPage.loginLink).toBeVisible();
      await signupPage.loginLink.click();
      await expect(signupPage.page).toHaveURL(/\/login/);
    });
  });

  test.describe("Validation", () => {
    test("should not proceed with password less than 8 characters", async ({ signupPage }) => {
      const testData = createSignupTestData();

      await signupPage.fillEmail(testData.email);
      await signupPage.expectStep("password");

      await signupPage.passwordInput.fill(SHORT_PASSWORD);
      await signupPage.passwordSubmitButton.click();

      await signupPage.expectStep("password");
      await expect(signupPage.passwordInput).toHaveJSProperty("validity.valid", false);
    });

    test("should not proceed when workspace name is empty", async ({ signupPage }) => {
      const testData = createSignupTestData();

      await signupPage.fillEmail(testData.email);
      await signupPage.fillPassword(testData.password);
      await signupPage.fillName(testData.name);
      await signupPage.expectStep("workspace");

      await signupPage.workspaceInput.fill("");
      await signupPage.workspaceSubmitButton.click();

      await signupPage.expectStep("workspace");
      await expect(signupPage.workspaceInput).toHaveJSProperty("validity.valid", false);
    });

    test("should show error when registering with existing email", async ({ signupPage }) => {
      const testData = createSignupTestData({
        email: TEST_USERS.admin.email,
      });

      await signupPage.completeSignup(testData);
      await signupPage.expectErrorMessage(/already|exists|registered/i);
    });
  });

  test.describe("Form Persistence", () => {
    test("should display entered email on password step", async ({ signupPage }) => {
      const testData = createSignupTestData();

      await signupPage.fillEmail(testData.email);
      await signupPage.expectStep("password");
      await signupPage.expectEmailDisplayed(testData.email);
    });

    test("should preserve data when navigating back and forth", async ({ signupPage }) => {
      const testData = createSignupTestData();

      await signupPage.fillEmail(testData.email);
      await signupPage.fillPassword(testData.password);

      await signupPage.expectStep("name");
      await signupPage.nameInput.fill(testData.name);
      await signupPage.nameSubmitButton.click();

      await signupPage.expectStep("workspace");
      await signupPage.goBackFromWorkspace();

      await signupPage.expectStep("name");
      await expect(signupPage.nameInput).toHaveValue(testData.name);
    });
  });

  test.describe("UI State", () => {
    test("should disable submit button while registration is in progress", async ({ signupPage }) => {
      const testData = createSignupTestData();

      await signupPage.fillEmail(testData.email);
      await signupPage.fillPassword(testData.password);
      await signupPage.fillName(testData.name);
      await signupPage.fillWorkspace(testData.workspaceName);
      await signupPage.expectStep("team");

      await signupPage.expectSubmitButtonEnabled();
      await signupPage.finalSubmitButton.click();

      const isDisabled = await signupPage.finalSubmitButton.isDisabled();
      const currentUrl = signupPage.page.url();
      const isStillOnPage = currentUrl.includes("/signup");

      expect(isDisabled || !isStillOnPage).toBeTruthy();
    });
  });
});
