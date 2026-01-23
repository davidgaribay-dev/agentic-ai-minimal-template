import { test as base, expect } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";
import { SignupPage } from "../pages/SignupPage";

type AuthFixtures = {
  loginPage: LoginPage;
  signupPage: SignupPage;
};

export const test = base.extend<AuthFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  signupPage: async ({ page }, use) => {
    await use(new SignupPage(page));
  },
});

export const unauthenticatedTest = test.extend({
  storageState: { cookies: [], origins: [] },
});

export { expect };
