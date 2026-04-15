/**
 * Board Connector — Web Bluetooth API wrapper for Aurora boards.
 *
 * Manages the BLE connection lifecycle and provides a clean interface
 * to light up climbs or clear the board.
 *
 * Usage:
 *   const connector = new BoardConnector();
 *   await connector.connect();
 *   await connector.lightUpClimb(resolvedHolds);
 *   await connector.clear();
 *   connector.disconnect();
 *
 * Browser support: Chrome/Edge on Android and desktop.
 * On unsupported browsers (iOS Safari, Firefox), `isSupported` will be false.
 */

import type { ResolvedHold } from '$lib/data/types';
import { encodeClimbPackets, encodeClearPacket } from './aurora-protocol';

// ── BLE UUIDs ─────────────────────────────────────────────────────────────────

/**
 * Aurora Board primary service UUID.
 * Used as a filter in requestDevice() to show only Kilter/Aurora boards.
 */
const AURORA_SERVICE_UUID = '4488b571-7806-4df6-bcff-a2897e4953ff';

/** Nordic UART Service — carries the RX/TX characteristics. */
const NORDIC_UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';

/** RX characteristic — writable. App sends LED commands here. */
const NORDIC_UART_RX_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

// ── State ─────────────────────────────────────────────────────────────────────

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface BoardConnectorState {
	status: ConnectionStatus;
	deviceName: string | null;
	error: string | null;
}

// ── Delay between BLE chunk writes (ms) ──────────────────────────────────────
// The board firmware needs a small gap between packets to avoid buffer overruns.
const WRITE_DELAY_MS = 50;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── BoardConnector class ──────────────────────────────────────────────────────

export class BoardConnector {
	private device: BluetoothDevice | null = null;
	private rxCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

	// Svelte 5 reactive state using $state rune (used when instantiated in a .svelte file)
	// When used outside Svelte, these are plain fields.
	status: ConnectionStatus = 'disconnected';
	deviceName: string | null = null;
	error: string | null = null;

	/** True if Web Bluetooth API is available in this browser. */
	get isSupported(): boolean {
		return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
	}

	/** True when a board is connected and ready to receive commands. */
	get isConnected(): boolean {
		return this.status === 'connected' && this.rxCharacteristic !== null;
	}

	/**
	 * Open the browser's BLE device picker and connect to the selected board.
	 * Filters to Aurora-platform boards only.
	 */
	async connect(): Promise<void> {
		if (!this.isSupported) {
			this.status = 'error';
			this.error = 'Web Bluetooth is not supported in this browser.';
			return;
		}

		if (this.status === 'connecting') return;

		this.status = 'connecting';
		this.error = null;
		this.deviceName = null;

		try {
			this.device = await navigator.bluetooth.requestDevice({
				filters: [{ services: [AURORA_SERVICE_UUID] }],
				optionalServices: [NORDIC_UART_SERVICE_UUID]
			});

			this.deviceName = this.device.name ?? 'Unknown Board';

			// Handle unexpected disconnection
			this.device.addEventListener('gattserverdisconnected', () => {
				this.status = 'disconnected';
				this.rxCharacteristic = null;
				this.deviceName = null;
			});

			const server = await this.device.gatt!.connect();
			const service = await server.getPrimaryService(NORDIC_UART_SERVICE_UUID);
			this.rxCharacteristic = await service.getCharacteristic(NORDIC_UART_RX_UUID);

			this.status = 'connected';
		} catch (err) {
			this.rxCharacteristic = null;
			this.device = null;
			if ((err as DOMException).name === 'NotFoundError') {
				// User cancelled the picker — not an error
				this.status = 'disconnected';
			} else {
				this.status = 'error';
				this.error = err instanceof Error ? err.message : String(err);
			}
		}
	}

	/** Disconnect from the board and reset state. */
	disconnect(): void {
		if (this.device?.gatt?.connected) {
			this.device.gatt.disconnect();
		}
		this.device = null;
		this.rxCharacteristic = null;
		this.status = 'disconnected';
		this.deviceName = null;
		this.error = null;
	}

	/**
	 * Light up a climb on the board.
	 * Encodes the holds into Aurora v3 BLE packets and writes them in sequence.
	 */
	async lightUpClimb(holds: ResolvedHold[]): Promise<void> {
		await this.writePackets(encodeClimbPackets(holds));
	}

	/**
	 * Clear all LEDs on the board.
	 */
	async clear(): Promise<void> {
		await this.writePackets(encodeClearPacket());
	}

	// ── Private ─────────────────────────────────────────────────────────────

	private async writePackets(packets: Uint8Array[]): Promise<void> {
		if (!this.isConnected || !this.rxCharacteristic) {
			throw new Error('Board is not connected.');
		}

		for (let i = 0; i < packets.length; i++) {
			await this.rxCharacteristic.writeValueWithoutResponse(packets[i] as Uint8Array<ArrayBuffer>);
			if (i < packets.length - 1) {
				await sleep(WRITE_DELAY_MS);
			}
		}
	}
}
