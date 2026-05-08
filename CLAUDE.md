# CLAUDE.md — Project Guide

## Worktree Setup

When working in a git worktree (path contains `.claude/worktrees/`), run these once before anything else:

```bash
pnpm install        # node_modules are not shared with the main tree
cp .env.example .env         # real values not needed — presence of DATABASE_URL satisfies svelte-check
```

Without these steps `pnpm check` and `pnpm build` will fail.

## Quality Gates

Before committing, always run in order:

```bash
pnpm lint      # Biome check (lint + format)
pnpm check     # svelte-check (TypeScript + Svelte types)
pnpm build     # Vite production build
pnpm test      # Vitest unit tests
```

All four must pass with zero errors. Fix lint errors with `pnpm format` first (auto-fixes formatting and safe lint violations), then fix remaining errors manually.

## Project Overview

**BetterClimber** — PWA for searching Kilter Board climbs and sending them to a physical board via Web Bluetooth.

Stack: SvelteKit 2 + Svelte 5 + TypeScript + Tailwind CSS v4 + Vite + Biome.

Deployed on Netlify (`@sveltejs/adapter-netlify`). PWA via `vite-plugin-pwa`.

## Architecture

```
src/
  routes/
    +layout.svelte        # Root layout: theme init, settings panel (opens via #settings hash)
    +layout.server.ts     # Reads settings cookie so SSR renders the correct theme/grade
    +page.svelte          # Home: climb search + filter list
    +page.server.ts       # SSR load: parse URL params, run initial DB search
    climb/[uuid]/         # Climb detail: board viz, BLE send, log
    ble-debug/            # Developer page: BLE test patterns + log
    api/climbs/           # REST search + single-climb endpoints (Neon PostgreSQL)
    layout.css            # Tailwind v4 entry point (excluded from Biome CSS lint)
  lib/
    ble/
      aurora-protocol.ts      # API v3 BLE packet encoder (20-byte chunks)
      board-connector.ts      # Plain-class BLE state machine (dead — superseded, see #36)
      board-connector.svelte.ts  # Svelte $state wrapper — the active implementation
    data/
      repository.ts       # Client-side data access — searchClimbs / getClimb / resolveHolds
      types.ts            # All shared types (Climb, ClimbStats, ResolvedHold, Angle, RoleId…)
      log-service.ts      # localStorage tick/attempt/like log
      frames-parser.ts    # Parse Kilter frames string → [{placementId, roleId}]
      climbs.server.ts    # Server-side DB query layer (used by +page.server.ts for SSR)
      mock/               # Static JSON: placements, leds, holes (board geometry only — never changes)
    server/db/
      index.ts            # Drizzle ORM + Neon PostgreSQL connection
      schema.ts           # Table definitions: climbs (318k rows), climb_stats (323k rows)
    components/           # Svelte UI components
    connector.svelte.ts   # Singleton BoardConnector instance
    url-filters.ts        # URL ↔ ClimbFilters serialisation / deserialisation
    results-store.svelte.ts  # Shared results list for prev/next navigation
    settings-store.svelte.ts # Theme + cookie sync
```

## Key Concepts

### BLE Protocol (Aurora API v3)
- Nordic UART RX characteristic, 20-byte chunks
- Frame: `[SOH][length][checksum][STX][...payload...][ETX]`
- 3 bytes per hold: `[pos_lo, pos_hi, RRRGGGBB]`
- Empty holds array → board-clear packet (not an error)
- References: `src/lib/ble/aurora-protocol.ts` header comment

### Data Flow

**BLE (hold lighting):**
```
frames string → parseFrames() → [{placementId, roleId}]
                              → resolveHolds() → [{position, color}]
                              → encodeClimbPackets() → Uint8Array[]
                              → connector.lightUpClimb()
```

**Climb search — two paths:**
```
SSR (initial page load):
  +page.server.ts → climbs.server.ts → Drizzle → Neon PostgreSQL

Client (filter/search changes after hydration):
  repository.ts → fetch /api/climbs → +server.ts → Drizzle → Neon PostgreSQL
```

### Hold Resolution Chain
`placement.id` → `placement.hole_id` → `led.position` (via `leds.json`)

Valid placement IDs start at 1073. IDs below this don't exist in the mock data and produce an empty hold array (which sends a clear packet).

### Refreshing the Dataset
The live database (Neon) is populated with the full Kilter dataset (318k climbs, 323k stat rows). Board geometry (placements, holes, leds) remains as static JSON in `src/lib/data/mock/` and never needs updating.

If you need to re-extract climb data from a fresh Aurora SQLite dump (see `scripts/extract-kilter-db.js`):

1. Get the DB file from an Android device:
   ```bash
   adb backup -noapk com.auroraclimbing.kilterboard
   npx ab-to-tar backup.ab | tar xvf -
   # file: apps/com.auroraclimbing.kilterboard/db/aurora.db
   ```
2. Install the extraction dependency:
   ```bash
   pnpm add -D better-sqlite3
   ```
3. Run:
   ```bash
   pnpm extract-db /path/to/aurora.db
   ```

This outputs SQL or JSON suitable for re-seeding the Neon database.

### Angle Type
`Angle` is a union of numeric literals (all valid board angles). Use `(ALL_ANGLES as ReadonlyArray<number>).includes(parsed)` for runtime narrowing.

### Svelte 5 Patterns
- Use `$state`, `$derived`, `$effect` — no writable stores
- `untrack()` for one-shot initialization inside reactive contexts
- Biome can't see Svelte template usage → `noUnusedImports`/`noUnusedVariables` disabled for `*.svelte` files

## Biome Config Notes

- `layout.css` excluded (Tailwind v4 `@import`/`@plugin`/`@theme` not supported by Biome CSS parser)
- `.claude/` excluded from all Biome processing
- `noUnusedExpressions` disabled globally (Svelte `$effect` tracking expressions)
- `noNonNullAssertion`, `noDocumentCookie`, `noAssignInExpressions` suppressed inline with `biome-ignore` where intentional

## Git / SSH Note

Remote is `git@github.com:denis-jasselette/betterclimber.git`. Push requires SSH key for `denis-jasselette` account, not `djasselette-evs`.
