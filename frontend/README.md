# Frontend

React 19 + TypeScript + Vite 7 + TanStack Router + shadcn/ui + Tailwind v4 + i18next

## Quick Start

```bash
npm install          # Install dependencies
npm run dev          # Dev server at localhost:5173
npm run build        # Production build (includes type check)
npm run lint         # ESLint
npm run typecheck    # TypeScript type check only
npm run format       # Format with Prettier
```

## Documentation

See **[CLAUDE.md](CLAUDE.md)** for complete documentation:
- Architecture and project structure
- API client modules (`lib/api/`)
- Authentication and workspace context
- Chat system and SSE streaming
- i18n translation patterns
- Component guidelines
- Test ID conventions for Playwright

## Testing

**Note**: E2E/Playwright tests are in the root `tests/` folder, not here.

```bash
cd ../tests
npm run test          # All E2E tests
npm run test:ui-only  # UI tests only (browser)
npm run test:api-only # API tests only (no browser)
npm run test:headed   # Visible browser
npm run report        # View HTML report
```

## Key Patterns

- **Path aliases**: `@/` → `./src/`
- **API proxy**: `/api/*` → `VITE_API_URL` (strips `/api` prefix)
- **State**: TanStack Query (server) + Zustand (client) + React Context (selection)
- **i18n**: Never hardcode strings - use `useTranslation()` hook
- **Test IDs**: All interactive elements need `data-testid` for Playwright

## Environment

```bash
VITE_PORT=5173
VITE_API_URL=http://localhost:8000
VITE_ENABLE_TEST_IDS=true  # Enable test IDs for Playwright
```
