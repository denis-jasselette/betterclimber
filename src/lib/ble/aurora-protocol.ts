/**
 * Aurora BLE Protocol — Packet Encoder
 *
 * Implements the API v3 (current) protocol used by all Aurora-platform boards
 * (Kilter, Tension, Grasshopper, Decoy, Touchstone, So iLL).
 *
 * References:
 *   - https://github.com/1-max-1/fake_kilter_board  (definitive BLE docs)
 *   - https://github.com/marcodejongh/boardsesh      (TypeScript implementation)
 *   - https://bazun.me/blog/kiterboard/              (reverse-engineering writeup)
 *
 * Protocol summary:
 *   - Data is sent to the Nordic UART RX characteristic in 20-byte chunks.
 *   - Each logical message has the frame:
 *       [0x01][length][checksum][0x02][...payload...][0x03]
 *   - The payload starts with a command byte, followed by hold data.
 *   - API v3: 3 bytes per hold → [pos_lo, pos_hi, RRRGGGBB]
 *   - Multi-hold messages are split across multiple 20-byte BLE packets.
 */

import type { ResolvedHold, RoleId } from '$lib/data/types'
import { ROLE_COLORS } from '$lib/data/types'

// ── BLE constants ─────────────────────────────────────────────────────────────

/** Maximum payload bytes per BLE write (ATT MTU default). */
const BLE_CHUNK_SIZE = 20

/** Frame delimiters */
const SOH = 0x01 // Start of Header
const STX = 0x02 // Start of Text
const ETX = 0x03 // End of Text

/**
 * API v3 command bytes.
 * T = only-packet, R = first, Q = middle, S = last.
 */
const CMD_V3 = {
	ONLY: 0x54, // 'T'
	FIRST: 0x52, // 'R'
	MIDDLE: 0x51, // 'Q'
	LAST: 0x53 // 'S'
} as const

// ── Color encoding ────────────────────────────────────────────────────────────

/**
 * Encode an RGB color into the API v3 single-byte format: RRRGGGBB
 * - 3 bits red   (r >> 5)
 * - 3 bits green (g >> 5)
 * - 2 bits blue  (b >> 6)
 */
function encodeColor(r: number, g: number, b: number): number {
	return (((r >> 5) & 0x07) << 5) | (((g >> 5) & 0x07) << 2) | ((b >> 6) & 0x03)
}

// ── Checksum ──────────────────────────────────────────────────────────────────

/** Aurora checksum: bitwise NOT of the sum of payload bytes, masked to 8 bits. */
function checksum(payload: Uint8Array): number {
	let sum = 0
	for (const b of payload) sum = (sum + b) & 0xff
	return ~sum & 0xff
}

// ── Packet framing ────────────────────────────────────────────────────────────

/**
 * Wrap a payload in the Aurora frame:
 *   [SOH][length][checksum][STX][...payload...][ETX]
 */
function framePacket(payload: Uint8Array): Uint8Array {
	const frame = new Uint8Array(4 + payload.length + 1)
	frame[0] = SOH
	frame[1] = payload.length
	frame[2] = checksum(payload)
	frame[3] = STX
	frame.set(payload, 4)
	frame[4 + payload.length] = ETX
	return frame
}

// ── Hold encoding ─────────────────────────────────────────────────────────────

/**
 * Encode a single hold into 3 API v3 bytes: [pos_lo, pos_hi, RRRGGGBB]
 */
function encodeHold(ledPosition: number, roleId: RoleId): [number, number, number] {
	const color = ROLE_COLORS[roleId]
	return [ledPosition & 0xff, (ledPosition >> 8) & 0xff, encodeColor(color.r, color.g, color.b)]
}

// ── Main encoder ──────────────────────────────────────────────────────────────

/**
 * Encode a list of resolved holds into a sequence of BLE packets.
 *
 * Each returned Uint8Array is at most 20 bytes and ready to write to the
 * Nordic UART RX characteristic.
 *
 * @param holds  Resolved holds from `resolveHolds()`.
 * @returns      Array of BLE packets to write in order.
 */
export function encodeClimbPackets(holds: ResolvedHold[]): Uint8Array[] {
	if (holds.length === 0) {
		// Send an empty "clear board" packet: single frame with only the ONLY command byte
		return [framePacket(new Uint8Array([CMD_V3.ONLY]))]
	}

	// Build the complete payload: [cmd_byte, hold0_b0, hold0_b1, hold0_b2, hold1_b0, ...]
	// The command byte is replaced per-packet based on position.
	// First, build raw hold data (no command byte yet) — 3 bytes per hold.
	const holdBytes: number[] = []
	for (const hold of holds) {
		holdBytes.push(...encodeHold(hold.ledPosition, hold.roleId))
	}

	// Split into chunks. Each chunk payload = [cmd_byte] + up to 19 bytes of hold data.
	const DATA_PER_CHUNK = BLE_CHUNK_SIZE - 4 - 1 // 20 - frame overhead (4) - cmd byte (1) = 15
	const chunks: number[][] = []
	for (let i = 0; i < holdBytes.length; i += DATA_PER_CHUNK) {
		chunks.push(holdBytes.slice(i, i + DATA_PER_CHUNK))
	}

	const packets: Uint8Array[] = []
	for (let i = 0; i < chunks.length; i++) {
		const isFirst = i === 0
		const isLast = i === chunks.length - 1
		let cmd: number
		if (chunks.length === 1) {
			cmd = CMD_V3.ONLY
		} else if (isFirst) {
			cmd = CMD_V3.FIRST
		} else if (isLast) {
			cmd = CMD_V3.LAST
		} else {
			cmd = CMD_V3.MIDDLE
		}

		const payload = new Uint8Array([cmd, ...chunks[i]])
		packets.push(framePacket(payload))
	}

	return packets
}

/**
 * Encode a "clear board" command — turns off all LEDs.
 */
export function encodeClearPacket(): Uint8Array[] {
	return [framePacket(new Uint8Array([CMD_V3.ONLY]))]
}
