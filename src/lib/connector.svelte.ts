/**
 * Shared BoardConnector singleton.
 *
 * Instantiated once at module level so that both the search page and the
 * climb detail page share the same BLE connection without needing to pass
 * the connector through Svelte context or props across routes.
 *
 * IMPORTANT: Do NOT wrap this in $state() — the BoardConnector class already
 * uses $state fields internally, and wrapping it in an outer $state() would
 * create a Svelte deep proxy that breaks the browser's user-gesture requirement
 * for Web Bluetooth (requestDevice() must be called directly from a click handler).
 */

import { BoardConnector } from '$lib/ble/board-connector.svelte';

export const connector = new BoardConnector();
