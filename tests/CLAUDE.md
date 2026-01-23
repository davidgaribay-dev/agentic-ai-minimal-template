# CLAUDE.md

## Overview

Playwright E2E test suite for the Agentic AI Template. Covers both UI tests (browser-based) and API tests (no browser). Tests are isolated from backend unit tests (`backend/tests/`) which use pytest.

## Commands

```bash
npm install                  # Install dependencies
npm run install-browsers     # Install Playwright browsers
npm run test                 # Run all tests (UI + API, all browsers)
npm run test:ui-only         # UI tests on Chromium only (fastest)
npm run test:api-only        # API tests only (no browser)
npm run test:headed          # UI tests with visible browser
npm run test:debug           # Debug mode with step-through
npm run test:ui              # Interactive UI mode
npm run report               # View HTML test report
npm run codegen              # Generate tests via recording
```

Browser-specific:
```bash
npm run test:chromium        # Chromium only
npm run test:firefox         # Firefox only
npm run test:webkit          # WebKit (Safari) only
```

## Project Structure

```
tests/
├── playwright.config.ts     # Test configuration (projects, browsers, timeouts)
├── fixtures/
│   ├── index.ts             # Barrel export for all fixtures
│   ├── auth.fixture.ts      # UI test fixtures (authenticated/unauthenticated)
│   ├── teams.fixture.ts     # Team-scoped test fixtures
│   └── api.fixture.ts       # API test fixtures with auth contexts
├── pages/                   # Page Object Model classes
│   ├── index.ts             # Barrel export
│   ├── LoginPage.ts         # Login form interactions
│   ├── SignupPage.ts        # Signup flow
│   ├── SidebarPage.ts       # Sidebar navigation
│   ├── TeamDialogPage.ts    # Create/edit team dialogs
│   ├── TeamSettingsPage.ts  # Team settings panels
│   ├── OrgSettingsPage.ts   # Organization settings
│   └── InvitationPage.ts    # Invitation flows
├── utils/
│   ├── index.ts             # Barrel export
│   ├── test-data.ts         # Test data generators (emails, passwords, names)
│   ├── api-helpers.ts       # Response validation, resource management
│   └── logger.ts            # Winston logger for debugging
└── tests/                   # Test files
    ├── auth.setup.ts        # Authentication setup (runs before UI tests)
    ├── auth/                # Auth UI tests (login, signup)
    ├── teams/               # Team management UI tests
    ├── invitations/         # Invitation flow UI tests
    └── api/                 # API tests (no browser)
        ├── auth/            # /v1/auth endpoints
        ├── organizations/   # /v1/organizations endpoints
        ├── teams/           # /v1/teams endpoints
        ├── settings/        # /v1/settings endpoints
        ├── prompts/         # /v1/prompts endpoints
        ├── conversations/   # /v1/conversations endpoints
        ├── documents/       # /v1/documents endpoints (RAG)
        ├── media/           # /v1/media endpoints
        ├── mcp/             # /v1/mcp-servers endpoints
        ├── guardrails/      # /v1/guardrails endpoints
        └── invitations/     # /v1/invitations endpoints
```

## Test Types

### UI Tests (`*.spec.ts`)

Browser-based tests using Playwright's page interactions. Run on Chromium, Firefox, and WebKit.

```typescript
import { unauthenticatedTest as test, expect } from "../../fixtures";

test.describe("Login", () => {
  test("should login successfully", async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.loginAndWaitForSuccess("admin@example.com", "changethis");
  });
});
```

### API Tests (`*.api.spec.ts`)

Direct HTTP tests without browser. Faster for testing backend endpoints.

```typescript
import { apiTest as test, expect } from "../../../fixtures";
import { expectSuccessResponse, expectErrorResponse } from "../../../utils/api-helpers";

test.describe("Auth API", () => {
  test("should login with valid credentials", async ({ apiContext }) => {
    const response = await apiContext.post("/v1/auth/login", {
      form: { username: "admin@example.com", password: "changethis" },
    });
    const data = await expectSuccessResponse(response);
    expect(data.access_token).toBeTruthy();
  });
});
```

## Fixtures

### UI Test Fixtures (`fixtures/auth.fixture.ts`)

| Fixture | Description |
|---------|-------------|
| `test` | Authenticated UI test (default) |
| `unauthenticatedTest` | UI test without pre-auth |
| `loginPage` | LoginPage instance |
| `signupPage` | SignupPage instance |
| `sidebarPage` | SidebarPage instance |

### Team Fixtures (`fixtures/teams.fixture.ts`)

| Fixture | Description |
|---------|-------------|
| `authenticatedTeamTest` | Authenticated with team context |
| `unauthenticatedTeamTest` | Unauthenticated with team pages |
| `teamDialogPage` | TeamDialogPage instance |
| `teamSettingsPage` | TeamSettingsPage instance |

### API Test Fixtures (`fixtures/api.fixture.ts`)

| Fixture | Description |
|---------|-------------|
| `apiContext` | Unauthenticated API request context |
| `authenticatedApiContext` | Authenticated API request context |
| `authTokens` | Access/refresh tokens for current session |
| `createAuthenticatedContext` | Factory to create auth context for any user |

## Page Object Model

Page objects encapsulate UI interactions for maintainability.

```typescript
// pages/LoginPage.ts
export class LoginPage {
  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByTestId("login-email-input");
    this.passwordInput = page.getByTestId("login-password-input");
    this.submitButton = page.getByTestId("login-submit-button");
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectToBeLoggedIn() {
    await expect(this.page).not.toHaveURL(/\/login/);
  }
}
```

**Always use `data-testid` selectors** via `page.getByTestId()` for reliable element selection.

## Test Data Utilities

```typescript
import {
  TEST_USERS,           // Pre-defined test users (admin, invalid)
  generateTestEmail,    // Unique email: test-{timestamp}-{random}@test.example.com
  generateTestPassword, // Password: TestPass{timestamp}!
  generateTeamName,     // Team name: Test Team {random}
  createSignupTestData, // Full signup data object
  createTeamTestData,   // Team name + description
} from "../utils/test-data";
```

## API Helpers

```typescript
import {
  expectSuccessResponse,  // Validate 200 and return typed JSON
  expectErrorResponse,    // Validate error status and detail message
  createResource,         // POST and return typed resource with ID
  deleteResource,         // DELETE with cleanup (accepts 200/204/404)
  fetchAllPages,          // Paginate through all results
  waitForCondition,       // Poll until condition is true
} from "../utils/api-helpers";
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `E2E_BASE_URL` | `http://localhost:5173` | Frontend URL for UI tests |
| `API_BASE_URL` | `http://localhost:8000` | Backend URL for API tests |
| `TEST_USER_EMAIL` | `admin@example.com` | Default test user email |
| `TEST_USER_PASSWORD` | `changethis` | Default test user password |
| `CI` | - | Set in CI to enable retries, single worker |

### Projects (playwright.config.ts)

| Project | Pattern | Description |
|---------|---------|-------------|
| `setup` | `*.setup.ts` | Auth setup (runs first) |
| `chromium` | `*.spec.ts` (not `.api.`) | UI tests on Chrome |
| `firefox` | `*.spec.ts` (not `.api.`) | UI tests on Firefox |
| `webkit` | `*.spec.ts` (not `.api.`) | UI tests on Safari |
| `api` | `*.api.spec.ts` | API tests (no browser) |

### Timeouts

- Test timeout: 60s
- Action timeout: 10s
- Navigation timeout: 30s
- Expect timeout: 10s

### Web Server (Local Dev)

When not in CI, Playwright auto-starts the frontend:
```typescript
webServer: {
  command: "VITE_ENABLE_TEST_IDS=true npm run dev",
  cwd: "../frontend",
  url: "http://localhost:5173",
}
```

## Writing Tests

### Naming Convention

- UI tests: `{feature}.spec.ts` (e.g., `login.spec.ts`)
- API tests: `{feature}.api.spec.ts` (e.g., `login.api.spec.ts`)

### Test Structure

```typescript
import { authenticatedTeamTest as test, expect } from "../../fixtures";

test.describe("Feature Name", () => {
  test.beforeEach(async ({ page }) => {
    // Setup per test
  });

  test("should do something", async ({ page, teamDialogPage }) => {
    // Arrange
    // Act
    // Assert
  });
});
```

### Best Practices

1. **Use fixtures for setup** - Don't repeat auth/navigation in every test
2. **Page Objects for UI** - Keep selectors in page classes, not test files
3. **`data-testid` selectors** - Never use CSS classes or text content for selectors
4. **Generate unique test data** - Use `generateTestEmail()` etc. to avoid collisions
5. **Clean up resources** - Use `deleteResource()` in `afterEach` when creating data
6. **Separate UI and API tests** - API tests are faster, use them for edge cases
7. **Test isolation** - Each test should be independent and repeatable

### Adding a New Page Object

1. Create `pages/NewPage.ts`:
```typescript
import { type Locator, type Page, expect } from "@playwright/test";

export class NewPage {
  readonly page: Page;
  readonly someButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.someButton = page.getByTestId("some-button");
  }

  async goto() {
    await this.page.goto("/new-route");
  }
}
```

2. Export from `pages/index.ts`:
```typescript
export { NewPage } from "./NewPage";
```

3. Add to fixture if needed:
```typescript
// fixtures/auth.fixture.ts
newPage: async ({ page }, use) => {
  await use(new NewPage(page));
},
```

### Adding a New API Test

1. Create `tests/api/{feature}/{feature}.api.spec.ts`:
```typescript
import { apiTest as test, expect } from "../../../fixtures";
import { expectSuccessResponse } from "../../../utils/api-helpers";

test.describe("Feature API", () => {
  test("should get resource", async ({ authenticatedApiContext }) => {
    const response = await authenticatedApiContext.get("/v1/feature");
    const data = await expectSuccessResponse(response);
    expect(data).toBeDefined();
  });
});
```

## Debugging

```bash
# Run with visible browser
npm run test:headed

# Run in debug mode (step through)
npm run test:debug

# Run specific test file
npx playwright test tests/auth/login.spec.ts

# Run tests matching pattern
npx playwright test -g "should login"

# Generate tests by recording
npm run codegen
```

### Viewing Results

```bash
# View HTML report
npm run report

# Trace viewer (for failed tests with trace)
npx playwright show-trace test-results/path/to/trace.zip
```

## CI Integration

In CI (`CI=true`):
- Retries: 2 (for flaky test handling)
- Workers: 1 (sequential execution)
- Web server: Not started (expects pre-running services)
- Reporter: Includes GitHub Actions annotations

Artifacts collected:
- `playwright-report/` - HTML report
- `test-results/` - Screenshots, videos, traces on failure
