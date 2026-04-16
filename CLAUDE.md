# CLAUDE.md — Project Guide

## Quality Gates

Before committing, always run in order:

```bash
pnpm lint      # Biome check (lint + format)
pnpm check     # svelte-check (TypeScript + Svelte types)
pnpm build     # Vite production build
```

All three must pass with zero errors. Fix lint errors with `pnpm format` first (auto-fixes formatting and safe lint violations), then fix remaining errors manually.

## Project Overview

**BetterClimber** — PWA for searching Kilter Board climbs and sending them to a physical board via Web Bluetooth.

Stack: SvelteKit 2 + Svelte 5 + TypeScript + Tailwind CSS v4 + Vite + Biome.

Deployed on Netlify (`@sveltejs/adapter-netlify`). PWA via `vite-plugin-pwa`.

## Architecture

```
src/
  routes/
    +page.svelte          # Home: climb search + filter list
    +page.ts              # SSR load: parse ?angle param, run initial search
    climb/[uuid]/         # Climb detail: board viz, BLE send, log
    ble-debug/            # Developer page: BLE test patterns + log
    settings/             # Theme + user preferences
    layout.css            # Tailwind v4 entry point (excluded from Biome CSS lint)
  lib/
    ble/
      aurora-protocol.ts      # API v3 BLE packet encoder (20-byte chunks)
      board-connector.ts      # Plain-class BLE state machine
      board-connector.svelte.ts  # Svelte $state wrapper around board-connector
      frames-parser.ts        # Parse Kilter frames string → [{placementId, roleId}]
    data/
      repository.ts       # ONLY data access point — searchClimbs / getClimb / resolveHolds
      types.ts            # All shared types (Climb, ClimbStats, ResolvedHold, Angle, RoleId…)
      log-service.ts      # localStorage tick/attempt/like log
      mock/               # Static JSON: climbs (399), placements (3773), leds, holes, climb-stats
    components/           # Svelte UI components
    connector.svelte.ts   # Singleton connector instance (re-exported)
    search-store.svelte.ts   # Reactive search state (angle + filters)
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
```
frames string → parseFrames() → [{placementId, roleId}]
                              → resolveHolds() → [{position, color}]
                              → encodeClimbPackets() → Uint8Array[]
                              → connector.lightUpClimb()
```

### Hold Resolution Chain
`placement.id` → `placement.hole_id` → `led.position` (via `leds.json`)

Valid placement IDs start at 1073. IDs below this don't exist in the mock data and produce an empty hold array (which sends a clear packet).

### Mock Data Limitation
Only 399 climbs (subset). Full Kilter database has thousands.

To get the full dataset, extract from the Aurora SQLite database (see `scripts/extract-kilter-db.js`):

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

This replaces all five JSON files in `src/lib/data/mock/` with full data. No other code changes needed (`repository.ts` is the only consumer).

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
