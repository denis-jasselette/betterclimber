import { describe, expect, it } from 'vitest'
import type { ResolvedHold } from '$lib/data/types'
import { encodeClearPacket, encodeClimbPackets } from './aurora-protocol'

// ── Constants from the protocol ───────────────────────────────────────────────
const SOH = 0x01
const STX = 0x02
const ETX = 0x03
const CMD_ONLY = 0x54 // 'T'
const CMD_FIRST = 0x52 // 'R'
const CMD_MIDDLE = 0x51 // 'Q'
const CMD_LAST = 0x53 // 'S'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeHold(ledPosition: number, roleId: 12 | 13 | 14 | 15): ResolvedHold {
	return { placementId: 1073, roleId, ledPosition }
}

/** Verify a packet has valid Aurora frame structure. */
function assertFrame(packet: Uint8Array) {
	expect(packet[0]).toBe(SOH)
	expect(packet[3]).toBe(STX)
	expect(packet[packet.length - 1]).toBe(ETX)
	// byte[1] = payload length = packet.length - 5 (SOH + len + cksum + STX + ETX)
	expect(packet[1]).toBe(packet.length - 5)
	// Verify checksum: bitwise NOT of sum of payload bytes
	const payload = packet.slice(4, packet.length - 1)
	let sum = 0
	for (const b of payload) sum = (sum + b) & 0xff
	expect(packet[2]).toBe(~sum & 0xff)
}

// ── encodeColor (tested indirectly through encodeClimbPackets) ────────────────

describe('color encoding (RRRGGGBB) via packet color byte', () => {
	// packet[7] = color byte when there is exactly 1 hold at position 7
	const pos = 7

	it('green (START, roleId 12): 0b00011100', () => {
		const packets = encodeClimbPackets([makeHold(pos, 12)])
		expect(packets[0][7]).toBe(0b00011100) // r=0, g=7, b=0 → 0x1c
	})

	it('cyan (HAND, roleId 13): 0b00011111', () => {
		const packets = encodeClimbPackets([makeHold(pos, 13)])
		expect(packets[0][7]).toBe(0b00011111) // r=0, g=7, b=3 → 0x1f
	})

	it('magenta (FINISH, roleId 14): 0b11100011', () => {
		const packets = encodeClimbPackets([makeHold(pos, 14)])
		expect(packets[0][7]).toBe(0b11100011) // r=7, g=0, b=3 → 0xe3
	})

	it('amber (FOOT, roleId 15): encodes ff/aa/00', () => {
		// 0xff/0xaa/0x00 → (7<<5)|(5<<2)|0 = 0b11110100
		const packets = encodeClimbPackets([makeHold(pos, 15)])
		expect(packets[0][7]).toBe(0b11110100) // 0xf4
	})
})

// ── framePacket / checksum ─────────────────────────────────────────────────────

describe('framePacket structure', () => {
	it('encodeClearPacket has valid frame structure', () => {
		const [packet] = encodeClearPacket()
		assertFrame(packet)
	})

	it('encodeClimbPackets packets each have valid frame structure', () => {
		const holds = Array.from({ length: 6 }, (_, i) => makeHold(i + 1, 12))
		for (const packet of encodeClimbPackets(holds)) {
			assertFrame(packet)
		}
	})

	it('clear packet: byte[0]=SOH, byte[3]=STX, last=ETX, cmd=ONLY', () => {
		const [packet] = encodeClearPacket()
		expect(packet[0]).toBe(SOH)
		expect(packet[3]).toBe(STX)
		expect(packet[packet.length - 1]).toBe(ETX)
		expect(packet[4]).toBe(CMD_ONLY)
	})

	it('each packet payload carries at most 15 hold data bytes', () => {
		// DATA_PER_CHUNK = 20 - 4 (frame header) - 1 (cmd byte) = 15 hold bytes per chunk
		// Full frame = 4 (header) + 1 (cmd) + ≤15 (hold data) + 1 (ETX) = ≤21 bytes
		const holds = Array.from({ length: 10 }, (_, i) => makeHold(i + 1, 12))
		for (const packet of encodeClimbPackets(holds)) {
			// payload = packet minus SOH, len, checksum, STX, ETX = packet.length - 5
			// payload = cmd (1) + hold data (≤15) ≤ 16
			const payloadLen = packet[1]
			expect(payloadLen).toBeLessThanOrEqual(16)
		}
	})
})

// ── encodeClimbPackets ─────────────────────────────────────────────────────────

describe('encodeClimbPackets', () => {
	it('empty holds → single ONLY packet (same as clear)', () => {
		const packets = encodeClimbPackets([])
		expect(packets).toHaveLength(1)
		expect(packets[0][4]).toBe(CMD_ONLY)
	})

	it('empty holds result equals encodeClearPacket', () => {
		expect(encodeClimbPackets([])[0]).toEqual(encodeClearPacket()[0])
	})

	it('1 hold → single ONLY packet', () => {
		const packets = encodeClimbPackets([makeHold(1, 12)])
		expect(packets).toHaveLength(1)
		expect(packets[0][4]).toBe(CMD_ONLY)
	})

	it('5 holds → single ONLY packet (exactly fills one chunk)', () => {
		// DATA_PER_CHUNK = 20 - 4 - 1 = 15 bytes; 5 holds × 3 = 15 bytes
		const holds = Array.from({ length: 5 }, (_, i) => makeHold(i + 1, 12))
		const packets = encodeClimbPackets(holds)
		expect(packets).toHaveLength(1)
		expect(packets[0][4]).toBe(CMD_ONLY)
	})

	it('6 holds → FIRST + LAST (2 packets)', () => {
		const holds = Array.from({ length: 6 }, (_, i) => makeHold(i + 1, 12))
		const packets = encodeClimbPackets(holds)
		expect(packets).toHaveLength(2)
		expect(packets[0][4]).toBe(CMD_FIRST)
		expect(packets[1][4]).toBe(CMD_LAST)
	})

	it('11 holds → FIRST + MIDDLE + LAST (3 packets)', () => {
		// 11 holds × 3 = 33 bytes → chunk sizes: 15 + 15 + 3
		const holds = Array.from({ length: 11 }, (_, i) => makeHold(i + 1, 12))
		const packets = encodeClimbPackets(holds)
		expect(packets).toHaveLength(3)
		expect(packets[0][4]).toBe(CMD_FIRST)
		expect(packets[1][4]).toBe(CMD_MIDDLE)
		expect(packets[2][4]).toBe(CMD_LAST)
	})

	it('encodes ledPosition correctly (little-endian)', () => {
		// ledPosition 0x01FF = 511 → pos_lo = 0xFF, pos_hi = 0x01
		const [packet] = encodeClimbPackets([makeHold(0x01ff, 12)])
		expect(packet[5]).toBe(0xff) // pos_lo
		expect(packet[6]).toBe(0x01) // pos_hi
	})
})

// ── encodeClearPacket ─────────────────────────────────────────────────────────

describe('encodeClearPacket', () => {
	it('returns a single-element array', () => {
		expect(encodeClearPacket()).toHaveLength(1)
	})

	it('packet has valid frame structure', () => {
		assertFrame(encodeClearPacket()[0])
	})
})
