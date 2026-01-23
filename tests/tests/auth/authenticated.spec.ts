import { test, expect } from "../../fixtures";

test.describe("Authenticated User", () => {
  test("should be redirected from login page when already authenticated", async ({ page }) => {
    await page.goto("/login");
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("should have access to protected routes", async ({ page }) => {
    await page.goto("/chat");
    await expect(page).toHaveURL(/\/chat/);
  });
});
