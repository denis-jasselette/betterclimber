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
import { browser } from '$app/environment';

// ── Recent boards persistence ─────────────────────────────────────────────────

const RECENT_KEY = 'kilter-recent-boards';
const MAX_RECENT = 5;

function loadRecentBoards(): string[] {
	if (!browser) return [];
	try {
		return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
	} catch {
		return [];
	}
}

function saveRecentBoard(name: string): void {
	if (!browser) return;
	const list = loadRecentBoards().filter((n) => n !== name);
	list.unshift(name);
	localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
}

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

// ── Log entry ─────────────────────────────────────────────────────────────────

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
	id: string;
	ts: number;
	level: LogLevel;
	message: string;
}

// ── State ─────────────────────────────────────────────────────────────────────

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface BoardConnectorState {
	status: ConnectionStatus;
	deviceName: string | null;
	error: string | null;
}

function generateId(): string {
	return Math.random().toString(36).slice(2, 9);
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

	// $state runes make these fields reactive — Svelte components that read
	// status/deviceName/error will re-render when they change.
	status: ConnectionStatus = $state('disconnected');
	deviceName: string | null = $state(null);
	error: string | null = $state(null);
	recentBoards: string[] = $state(loadRecentBoards());
	logEntries: LogEntry[] = $state([]);

	/**
	 * Add a log entry to the debug log.
	 */
	log(level: LogLevel, message: string): void {
		const entry: LogEntry = {
			id: generateId(),
			ts: Date.now(),
			level,
			message
		};
		this.logEntries = [entry, ...this.logEntries].slice(0, 200);
	}

	/** Clear the debug log. */
	clearLog(): void {
		this.logEntries = [];
	}

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
			this.log('error', 'Web Bluetooth is not supported in this browser.');
			return;
		}

		if (this.status === 'connecting') return;

		this.status = 'connecting';
		this.error = null;
		this.deviceName = null;
		this.log('info', 'Opening BLE device picker...');

		try {
			this.device = await navigator.bluetooth.requestDevice({
				filters: [{ services: [AURORA_SERVICE_UUID] }],
				optionalServices: [NORDIC_UART_SERVICE_UUID]
			});

			this.deviceName = this.device.name ?? 'Unknown Board';
			this.log('info', `Device selected: ${this.deviceName}`);

			// Handle unexpected disconnection
			this.device.addEventListener('gattserverdisconnected', () => {
				this.status = 'disconnected';
				this.rxCharacteristic = null;
				this.deviceName = null;
				this.log('warn', 'Board disconnected unexpectedly');
			});

			this.log('debug', 'Connecting to GATT server...');
			const server = await this.device.gatt!.connect();
			this.log('debug', 'Getting Nordic UART service...');
			const service = await server.getPrimaryService(NORDIC_UART_SERVICE_UUID);
			this.log('debug', 'Getting RX characteristic...');
			this.rxCharacteristic = await service.getCharacteristic(NORDIC_UART_RX_UUID);

			this.status = 'connected';
			this.log('info', `Connected to ${this.deviceName}`);

			// Persist to recent boards
			if (this.deviceName) saveRecentBoard(this.deviceName);
			this.recentBoards = loadRecentBoards();
		} catch (err) {
			this.rxCharacteristic = null;
			this.device = null;
			if ((err as DOMException).name === 'NotFoundError') {
				// User cancelled the picker — not an error
				this.status = 'disconnected';
				this.log('info', 'Device picker cancelled');
			} else {
				this.status = 'error';
				this.error = err instanceof Error ? err.message : String(err);
				this.log('error', `Connection failed: ${this.error}`);
			}
		}
	}

	/** Disconnect from the board and reset state. */
	disconnect(): void {
		this.log('info', 'Disconnecting...');
		if (this.device?.gatt?.connected) {
			this.device.gatt.disconnect();
		}
		this.device = null;
		this.rxCharacteristic = null;
		this.status = 'disconnected';
		this.deviceName = null;
		this.error = null;
		this.log('info', 'Disconnected');
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

		this.log('debug', `Sending ${packets.length} packet(s)...`);
		for (let i = 0; i < packets.length; i++) {
			const hex = Array.from(packets[i])
				.map((b) => b.toString(16).padStart(2, '0'))
				.join(' ');
			this.log('debug', `Packet ${i + 1}/${packets.length}: ${hex}`);
			await this.rxCharacteristic.writeValueWithoutResponse(packets[i] as Uint8Array<ArrayBuffer>);
			if (i < packets.length - 1) {
				await sleep(WRITE_DELAY_MS);
			}
		}
		this.log('info', `Sent ${packets.length} packet(s)`);
	}
}
