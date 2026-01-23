import { unauthenticatedTest as test, expect } from "../../fixtures";
import { TEST_USERS } from "../../utils/test-data";

test.describe("Login", () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test("should display login form with all required elements", async ({ loginPage }) => {
    await loginPage.expectToBeOnLoginPage();
    await loginPage.expectFormVisible();
  });

  test("should login successfully with valid credentials", async ({ loginPage }) => {
    await loginPage.loginAndWaitForSuccess(
      TEST_USERS.admin.email,
      TEST_USERS.admin.password
    );
  });

  test("should show error message with invalid credentials", async ({ loginPage }) => {
    await loginPage.login(
      TEST_USERS.invalid.email,
      TEST_USERS.invalid.password
    );
    await loginPage.expectErrorMessage(/incorrect|invalid/i);
  });

  test("should have link to signup page", async ({ loginPage }) => {
    await expect(loginPage.signUpLink).toBeVisible();
  });

  test("should navigate to signup page when clicking signup link", async ({ loginPage }) => {
    await loginPage.signUpLink.click();
    await expect(loginPage.page).toHaveURL(/\/signup/);
  });
});
