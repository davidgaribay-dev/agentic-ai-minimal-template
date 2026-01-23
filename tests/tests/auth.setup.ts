import { test as setup, expect } from "@playwright/test";
import { STORAGE_STATE } from "../playwright.config";
import { TEST_USERS, TIMEOUTS } from "../utils";
import fs from "fs";
import path from "path";

setup.describe("Authentication Setup", () => {
  setup("authenticate via API and save state", async ({ page, request }) => {
    const authDir = path.dirname(STORAGE_STATE);
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    const loginResponse = await request.post("/api/v1/auth/login", {
      form: {
        username: TEST_USERS.admin.email,
        password: TEST_USERS.admin.password,
      },
    });

    expect(loginResponse.ok()).toBeTruthy();

    const tokens = await loginResponse.json();
    expect(tokens.access_token).toBeTruthy();
    expect(tokens.refresh_token).toBeTruthy();

    await page.goto("/");

    const expiryTime = Date.now() + tokens.expires_in * 1000;

    await page.evaluate(
      ({ accessToken, refreshToken, expiry }) => {
        localStorage.setItem("auth_token", accessToken);
        localStorage.setItem("auth_refresh_token", refreshToken);
        localStorage.setItem("auth_token_expiry", expiry.toString());
      },
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiry: expiryTime,
      }
    );

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/\/login/, { timeout: TIMEOUTS.medium });
    await page.context().storageState({ path: STORAGE_STATE });
  });
});
