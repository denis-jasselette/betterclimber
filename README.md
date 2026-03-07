# Kilterboard App

A Progressive Web App for searching, browsing, and sending climbs to your Kilter Board via Bluetooth Low Energy (BLE).

## Features

- **Climb Search** — Filter climbs by angle, grade (V-scale or French), quality, and more
- **BLE Connectivity** — Send climbs directly to your Kilter Board using the Aurora protocol
- **Multiple Angles** — Support for all Kilter Board angles (20°–60°)
- **Grade Systems** — View grades in V-scale or French grading
- **Offline Support** — PWA-enabled for offline access
- **Track Progress** — Mark climbs as attempted, ticked, or liked

## Tech Stack

- **SvelteKit** with Svelte 5
- **TypeScript**
- **TailwindCSS**
- **PWA** (vite-plugin-pwa)

## Getting Started

```sh
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

## Project Structure

```
src/
├── lib/
│   ├── ble/              # Bluetooth Low Energy (BLE) protocol
│   │   ├── aurora-protocol.ts
│   │   ├── board-connector.ts
│   │   └── board-connector.svelte.ts
│   ├── components/      # Svelte UI components
│   ├── data/             # Types, repository, and data access
│   └── *.svelte.ts       # Svelte 5 state stores
└── routes/
    ├── +page.svelte      # Main climb search page
    ├── climb/[uuid]/     # Individual climb detail
    ├── ble-debug/        # BLE debugging tools
    └── settings/         # User preferences
```
