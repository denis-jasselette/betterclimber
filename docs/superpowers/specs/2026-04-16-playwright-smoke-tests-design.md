# Playwright Smoke Test Suite — Design Spec

**Date:** 2026-04-16
**Issue:** #19

## Goal

Detect obvious regressions (broken navigation, unresponsive buttons, missing UI elements) before they reach production. Tests run locally against a dev server using mock data (399 climbs), and in CI as a separate job after lint/check/build passes.

---

## Setup

### Dependencies

- `@playwright/test` added to `devDependencies`
- New script in `package.json`: `"test:e2e": "playwright test"`

### `playwright.config.ts` (project root)

- `testDir: ./tests`
- Single browser project: **Chromium only** (covers the regression risk, fastest CI)
- `webServer`:
  - Command: `pnpm dev`
  - Port: `5173`
  - `reuseExistingServer: true` (local runs reuse an existing dev server)
- `baseURL: http://localhost:5173`
- `retries: 1` in CI (`process.env.CI ? 1 : 0`) for flake protection

### `.gitignore` additions

```
test-results/
playwright-report/
```

---

## Test Files

### `tests/home.test.ts`

Covers the main search/filter page (`/`).

| Test | Assertion |
|------|-----------|
| Page loads | URL contains `angle=45`, climb cards visible (count > 0) |
| Angle dropdown | Selecting a different angle updates the URL |
| Text search | Typing a query filters the results list |
| Filter drawer | Opening the drawer reveals campus/route toggles |
| Grade slider | Slider component is present in the DOM |

### `tests/climb.test.ts`

Covers the climb detail page (`/climb/[uuid]`). Uses a known UUID from `src/lib/data/mock/climbs.json` (first entry).

| Test | Assertion |
|------|-----------|
| Page loads | Climb title visible |
| Board visualization | SVG element with hold circles renders |
| BLE button state | Connect button visible; shows disconnected/connect state (no board connected in test env) |
| Prev/Next navigation | Both navigation buttons present in the DOM |

### `tests/settings.test.ts`

Covers the settings page (`/settings`).

| Test | Assertion |
|------|-----------|
| Page loads | `/settings` returns 200, heading visible |
| Theme toggle | Toggle element present |

---

## CI Integration

New `e2e` job in `.github/workflows/ci.yml`:

```yaml
e2e:
  needs: ci
  runs-on: ubuntu-latest
  env:
    DATABASE_URL: postgresql://ci:ci@localhost/ci
  steps:
    - uses: actions/checkout@v6
    - uses: pnpm/action-setup@v6
      with:
        version: 10.33.0
    - uses: actions/setup-node@v6
      with:
        node-version: 22
        cache: pnpm
    - name: Install dependencies
      run: pnpm install --ignore-scripts
    - name: Install Playwright browsers
      run: pnpm exec playwright install --with-deps chromium
    - name: Run E2E tests
      run: pnpm test:e2e
    - name: Upload report
      if: failure()
      uses: actions/upload-artifact@v4
      with:
        name: playwright-report
        path: playwright-report/
```

---

## Out of Scope

- Firefox / WebKit / mobile viewports (single Chromium is sufficient for smoke testing)
- BLE interaction (Web Bluetooth not available in headless Chromium; assert button state only)
- Visual regression / screenshot diffing
- Vitest component tests (separate concern)
