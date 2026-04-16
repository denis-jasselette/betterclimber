#!/usr/bin/env node

/**
 * Extract Kilter Board data from the Aurora SQLite database.
 *
 * The Aurora SQLite DB lives on an Android device at:
 *   /data/data/com.auroraclimbing.kilterboard/databases/aurora.db
 *
 * To get the file without a rooted device:
 *   adb backup -noapk com.auroraclimbing.kilterboard
 *   # then unpack with: npx ab-to-tar backup.ab | tar xvf -
 *   # file appears at: apps/com.auroraclimbing.kilterboard/db/aurora.db
 *
 * Usage:
 *   node scripts/extract-kilter-db.js /path/to/aurora.db
 *
 * Outputs updated JSON files to src/lib/data/mock/.
 *
 * Requires better-sqlite3:
 *   pnpm add -D better-sqlite3
 */

import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))

const dbPath = process.argv[2]
if (!dbPath) {
	console.error('Usage: node scripts/extract-kilter-db.js /path/to/aurora.db')
	process.exit(1)
}

let Database
try {
	Database = require('better-sqlite3')
} catch {
	console.error('Run: pnpm add -D better-sqlite3')
	process.exit(1)
}

const db = new Database(dbPath, { readonly: true })
const out = resolve(__dirname, '../src/lib/data/mock')

// ── Helper ────────────────────────────────────────────────────────────────────

function write(name, data) {
	const path = `${out}/${name}`
	writeFileSync(path, JSON.stringify(data, null, '\t'))
	console.log(`  ${name}: ${data.length} records`)
}

// ── Extract tables ────────────────────────────────────────────────────────────

console.log('Extracting from:', dbPath)

// List available tables for diagnostics
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
console.log('Tables found:', tables.map((t) => t.name).join(', '))

// climbs — only layout_id=1 (Kilter 16x12 full board), non-draft, at least 1 frame
const climbs = db
	.prepare(
		`
    SELECT
      uuid,
      layout_id,
      setter_id,
      setter_username,
      name,
      description,
      frames,
      frames_count,
      angle,
      is_draft,
      allow_matches,
      is_campus,
      is_route
    FROM climbs
    WHERE layout_id = 1
      AND is_draft = 0
      AND frames IS NOT NULL
      AND frames != ''
    ORDER BY uuid
  `
	)
	.all()

// Normalise booleans (SQLite stores as 0/1)
const normalisedClimbs = climbs.map((c) => ({
	...c,
	is_draft: c.is_draft === 1,
	allow_matches: c.allow_matches === 1,
	is_campus: c.is_campus === 1,
	is_route: c.is_route === 1
}))

write('climbs.json', normalisedClimbs)

// climb_stats
const climbUuids = new Set(normalisedClimbs.map((c) => c.uuid))
const allStats = db
	.prepare(
		`
    SELECT
      climb_uuid,
      angle,
      difficulty_average,
      benchmark_difficulty,
      quality_average,
      ascent_count
    FROM climb_stats
    ORDER BY climb_uuid, angle
  `
	)
	.all()

// Only keep stats for climbs we exported
const filteredStats = allStats.filter((s) => climbUuids.has(s.climb_uuid))
write('climb-stats.json', filteredStats)

// placements — layout_id=1 only
const placements = db
	.prepare(
		`
    SELECT id, hole_id, set_id, layout_id
    FROM placements
    WHERE layout_id = 1
    ORDER BY id
  `
	)
	.all()
write('placements.json', placements)

// holes — product_id=1 (Kilter board)
const holes = db
	.prepare(
		`
    SELECT id, product_id, name, x, y, mirrored_hole_id, mirror_group
    FROM holes
    WHERE product_id = 1
    ORDER BY id
  `
	)
	.all()
write('holes.json', holes)

// leds
const holeIds = new Set(holes.map((h) => h.id))
const leds = db
	.prepare(
		`
    SELECT id, hole_id, position
    FROM leds
    ORDER BY id
  `
	)
	.all()
	.filter((l) => holeIds.has(l.hole_id))
write('leds.json', leds)

db.close()
console.log('\nDone. Restart the dev server to pick up the new data.')
