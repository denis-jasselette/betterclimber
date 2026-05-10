-- Migration: session templates, blocks, exercises, logs + seed data
-- Safe migration: new tables only, no existing tables modified.

CREATE TABLE "session_templates" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"author_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_blocks" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" text NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "session_exercises" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_id" text NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"series_count" integer DEFAULT 1 NOT NULL,
	"rest_s" integer DEFAULT 0 NOT NULL,
	"reps" integer,
	"duration_s" integer,
	"grade_ref" text,
	"climb_count" integer,
	"duration_per_climb_s" integer,
	"rest_between_climbs_s" integer,
	CONSTRAINT "session_exercises_type_check" CHECK (type IN ('reps', 'timed', 'climb')),
	CONSTRAINT "session_exercises_grade_ref_check" CHECK (grade_ref IN ('flash_grade', 'max_grade', 'absolute') OR grade_ref IS NULL)
);
--> statement-breakpoint
CREATE TABLE "session_logs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"template_id" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"rpe" integer,
	"notes" text,
	CONSTRAINT "session_logs_rpe_check" CHECK (rpe BETWEEN 1 AND 10 OR rpe IS NULL)
);
--> statement-breakpoint
ALTER TABLE "session_templates" ADD CONSTRAINT "session_templates_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "session_blocks" ADD CONSTRAINT "session_blocks_template_id_session_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."session_templates"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "session_exercises" ADD CONSTRAINT "session_exercises_block_id_session_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."session_blocks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "session_logs" ADD CONSTRAINT "session_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "session_logs" ADD CONSTRAINT "session_logs_template_id_session_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."session_templates"("id") ON DELETE set null ON UPDATE no action;

-- ── Seed: 5 platform templates ────────────────────────────────────────────────

-- Helper: insert a template and return its id via a CTE chain

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Full Kilter Session
-- ════════════════════════════════════════════════════════════════════════════
WITH t1 AS (
  INSERT INTO session_templates (name, description, is_public)
  VALUES (
    'Full Kilter Session',
    'A complete session covering warm-up, explosivity, circuit bouldering, and mobility.',
    true
  ) RETURNING id
),
-- Block 1: Warm-up
b1_warmup AS (
  INSERT INTO session_blocks (template_id, position, name)
  SELECT id, 1, 'Warm-up' FROM t1 RETURNING id
),
-- Block 2: Explosivity
b1_explosive AS (
  INSERT INTO session_blocks (template_id, position, name)
  SELECT id, 2, 'Explosivity' FROM t1 RETURNING id
),
-- Block 3: Circuit Bouldering
b1_circuit AS (
  INSERT INTO session_blocks (template_id, position, name)
  SELECT id, 3, 'Circuit Bouldering' FROM t1 RETURNING id
),
-- Block 4: Mobility
b1_mobility AS (
  INSERT INTO session_blocks (template_id, position, name)
  SELECT id, 4, 'Mobility' FROM t1 RETURNING id
)
-- Exercises for all blocks
INSERT INTO session_exercises (block_id, position, name, description, type, series_count, rest_s, reps, duration_s, grade_ref, climb_count, duration_per_climb_s, rest_between_climbs_s)
SELECT b.id, e.position, e.name, e.description, e.type, e.series_count, e.rest_s, e.reps, e.duration_s, e.grade_ref, e.climb_count, e.duration_per_climb_s, e.rest_between_climbs_s
FROM (
  SELECT id, 'warmup' AS block FROM b1_warmup
  UNION ALL SELECT id, 'explosive' FROM b1_explosive
  UNION ALL SELECT id, 'circuit' FROM b1_circuit
  UNION ALL SELECT id, 'mobility' FROM b1_mobility
) b
JOIN (VALUES
  ('warmup', 1, 'Scapula pull-ups', NULL::text, 'reps', 3, 0, 10::integer, NULL::integer, NULL::text, NULL::integer, NULL::integer, NULL::integer),
  ('warmup', 2, 'Deep squat hold', NULL::text, 'timed', 3, 0, NULL::integer, 30::integer, NULL::text, NULL::integer, NULL::integer, NULL::integer),
  ('warmup', 3, '20mm edge dead hangs', NULL::text, 'timed', 9, 0, NULL::integer, 5::integer, NULL::text, NULL::integer, NULL::integer, NULL::integer),
  ('explosive', 1, 'Campus board touches (skip a rung)', NULL::text, 'reps', 4, 120, 5::integer, NULL::integer, NULL::text, NULL::integer, NULL::integer, NULL::integer),
  ('explosive', 2, 'Explosive pull-ups', NULL::text, 'reps', 4, 120, 5::integer, NULL::integer, NULL::text, NULL::integer, NULL::integer, NULL::integer),
  ('circuit', 1, 'Choose 4 climbs at your flash grade you have never tried', NULL::text, 'climb', 1, 0, NULL::integer, NULL::integer, 'flash_grade', 4::integer, 300::integer, 300::integer),
  ('mobility', 1, 'Hip flexor stretch', NULL::text, 'timed', 2, 30, NULL::integer, 60::integer, NULL::text, NULL::integer, NULL::integer, NULL::integer),
  ('mobility', 2, 'Shoulder CARs', NULL::text, 'reps', 2, 30, 5::integer, NULL::integer, NULL::text, NULL::integer, NULL::integer, NULL::integer),
  ('mobility', 3, 'Finger tendon glides', NULL::text, 'reps', 3, 0, 10::integer, NULL::integer, NULL::text, NULL::integer, NULL::integer, NULL::integer)
) AS e(block, position, name, description, type, series_count, rest_s, reps, duration_s, grade_ref, climb_count, duration_per_climb_s, rest_between_climbs_s)
ON b.block = e.block;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Power & Strength
-- ════════════════════════════════════════════════════════════════════════════
WITH t2 AS (
  INSERT INTO session_templates (name, description, is_public)
  VALUES (
    'Power & Strength',
    'Build maximum finger strength and pulling power with hangboard and weighted pull-ups.',
    true
  ) RETURNING id
),
b2_warmup AS (
  INSERT INTO session_blocks (template_id, position, name)
  SELECT id, 1, 'Warm-up' FROM t2 RETURNING id
),
b2_hang AS (
  INSERT INTO session_blocks (template_id, position, name)
  SELECT id, 2, 'Hangboard Strength' FROM t2 RETURNING id
),
b2_pull AS (
  INSERT INTO session_blocks (template_id, position, name)
  SELECT id, 3, 'Weighted Pull-ups' FROM t2 RETURNING id
),
b2_cooldown AS (
  INSERT INTO session_blocks (template_id, position, name)
  SELECT id, 4, 'Cool-down' FROM t2 RETURNING id
)
INSERT INTO session_exercises (block_id, position, name, description, type, series_count, rest_s, reps, duration_s, grade_ref, climb_count, duration_per_climb_s, rest_between_climbs_s)
SELECT b.id, e.position, e.name, e.description, e.type, e.series_count, e.rest_s, e.reps, e.duration_s, e.grade_ref, e.climb_count, e.duration_per_climb_s, e.rest_between_climbs_s
FROM (
  SELECT id, 'warmup' AS block FROM b2_warmup
  UNION ALL SELECT id, 'hang' FROM b2_hang
  UNION ALL SELECT id, 'pull' FROM b2_pull
  UNION ALL SELECT id, 'cooldown' FROM b2_cooldown
) b
JOIN (VALUES
  ('warmup', 1, 'Scapula pull-ups', NULL, 'reps', 3, 0, 10, NULL, NULL, NULL, NULL, NULL),
  ('warmup', 2, 'Deep squat hold', NULL, 'timed', 3, 0, NULL, 30, NULL, NULL, NULL, NULL),
  ('warmup', 3, '20mm edge dead hangs', NULL, 'timed', 9, 0, NULL, 5, NULL, NULL, NULL, NULL),
  ('hang', 1, '20mm edge max hangs', '7s on / 3s off × 6. Use added weight or assistance to reach failure at 7–10s.', 'timed', 6, 180, NULL, 7, NULL, NULL, NULL, NULL),
  ('pull', 1, 'Weighted pull-ups', 'Add weight so you reach failure at 5 reps. Log your max weight.', 'reps', 5, 180, 5, NULL, NULL, NULL, NULL, NULL),
  ('cooldown', 1, 'Hip flexor stretch', NULL, 'timed', 2, 30, NULL, 60, NULL, NULL, NULL, NULL),
  ('cooldown', 2, 'Shoulder CARs', NULL, 'reps', 2, 30, 5, NULL, NULL, NULL, NULL, NULL),
  ('cooldown', 3, 'Finger tendon glides', NULL, 'reps', 3, 0, 10, NULL, NULL, NULL, NULL, NULL)
) AS e(block, position, name, description, type, series_count, rest_s, reps, duration_s, grade_ref, climb_count, duration_per_climb_s, rest_between_climbs_s)
ON b.block = e.block;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Power Endurance — 4×4 Circuits
-- ════════════════════════════════════════════════════════════════════════════
WITH t3 AS (
  INSERT INTO session_templates (name, description, is_public)
  VALUES (
    'Power Endurance — 4×4 Circuits',
    'Train power endurance with 4×4 circuits at your flash grade.',
    true
  ) RETURNING id
),
b3_warmup AS (
  INSERT INTO session_blocks (template_id, position, name)
  SELECT id, 1, 'Warm-up' FROM t3 RETURNING id
),
b3_circuits AS (
  INSERT INTO session_blocks (template_id, position, name)
  SELECT id, 2, '4×4 Circuits' FROM t3 RETURNING id
)
INSERT INTO session_exercises (block_id, position, name, description, type, series_count, rest_s, reps, duration_s, grade_ref, climb_count, duration_per_climb_s, rest_between_climbs_s)
SELECT b.id, e.position, e.name, e.description, e.type, e.series_count, e.rest_s, e.reps, e.duration_s, e.grade_ref, e.climb_count, e.duration_per_climb_s, e.rest_between_climbs_s
FROM (
  SELECT id, 'warmup' AS block FROM b3_warmup
  UNION ALL SELECT id, 'circuits' FROM b3_circuits
) b
JOIN (VALUES
  ('warmup', 1, 'Scapula pull-ups', NULL, 'reps', 3, 0, 10, NULL, NULL, NULL, NULL, NULL),
  ('warmup', 2, 'Deep squat hold', NULL, 'timed', 3, 0, NULL, 30, NULL, NULL, NULL, NULL),
  ('warmup', 3, '20mm edge dead hangs', NULL, 'timed', 9, 0, NULL, 5, NULL, NULL, NULL, NULL),
  ('circuits', 1, '4×4 circuit', 'Climb 4 problems at your flash grade back to back without rest, then rest 4 min. Repeat 4 times.', 'climb', 4, 240, NULL, NULL, 'flash_grade', 4, 240, 0)
) AS e(block, position, name, description, type, series_count, rest_s, reps, duration_s, grade_ref, climb_count, duration_per_climb_s, rest_between_climbs_s)
ON b.block = e.block;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Beginner Foundations
-- ════════════════════════════════════════════════════════════════════════════
WITH t4 AS (
  INSERT INTO session_templates (name, description, is_public)
  VALUES (
    'Beginner Foundations',
    'Build basic movement patterns and technique with easy climbing drills.',
    true
  ) RETURNING id
),
b4_warmup AS (
  INSERT INTO session_blocks (template_id, position, name)
  SELECT id, 1, 'Warm-up' FROM t4 RETURNING id
),
b4_drills AS (
  INSERT INTO session_blocks (template_id, position, name)
  SELECT id, 2, 'Technique Drills' FROM t4 RETURNING id
),
b4_cooldown AS (
  INSERT INTO session_blocks (template_id, position, name)
  SELECT id, 3, 'Cool-down' FROM t4 RETURNING id
)
INSERT INTO session_exercises (block_id, position, name, description, type, series_count, rest_s, reps, duration_s, grade_ref, climb_count, duration_per_climb_s, rest_between_climbs_s)
SELECT b.id, e.position, e.name, e.description, e.type, e.series_count, e.rest_s, e.reps, e.duration_s, e.grade_ref, e.climb_count, e.duration_per_climb_s, e.rest_between_climbs_s
FROM (
  SELECT id, 'warmup' AS block FROM b4_warmup
  UNION ALL SELECT id, 'drills' FROM b4_drills
  UNION ALL SELECT id, 'cooldown' FROM b4_cooldown
) b
JOIN (VALUES
  ('warmup', 1, 'Arm circles', NULL, 'reps', 2, 0, 10, NULL, NULL, NULL, NULL, NULL),
  ('warmup', 2, 'Hip rotations', NULL, 'reps', 2, 0, 10, NULL, NULL, NULL, NULL, NULL),
  ('warmup', 3, 'Easy traversing', 'Traverse the wall at the lowest holds. Focus on balance and footwork.', 'timed', 1, 0, NULL, 120, NULL, NULL, NULL, NULL),
  ('drills', 1, 'Silent feet climbing', 'Choose 3 easy climbs (well below your flash grade). Place your feet silently on every hold — no scraping or adjusting.', 'climb', 1, 0, NULL, NULL, 'flash_grade', 3, 300, 120),
  ('drills', 2, 'Precise foot placement', 'Place the tip of your shoe on the centre of each foothold before moving your hands.', 'climb', 1, 0, NULL, NULL, 'flash_grade', 3, 300, 120),
  ('cooldown', 1, 'Full body stretch', 'Light stretching: hips, shoulders, forearms, fingers.', 'timed', 1, 0, NULL, 300, NULL, NULL, NULL, NULL)
) AS e(block, position, name, description, type, series_count, rest_s, reps, duration_s, grade_ref, climb_count, duration_per_climb_s, rest_between_climbs_s)
ON b.block = e.block;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Active Recovery
-- ════════════════════════════════════════════════════════════════════════════
WITH t5 AS (
  INSERT INTO session_templates (name, description, is_public)
  VALUES (
    'Active Recovery',
    'Light mobility work and easy climbing to promote recovery between hard sessions.',
    true
  ) RETURNING id
),
b5_mobility AS (
  INSERT INTO session_blocks (template_id, position, name)
  SELECT id, 1, 'Mobility Circuit' FROM t5 RETURNING id
),
b5_climbing AS (
  INSERT INTO session_blocks (template_id, position, name)
  SELECT id, 2, 'Relaxed Climbing' FROM t5 RETURNING id
)
INSERT INTO session_exercises (block_id, position, name, description, type, series_count, rest_s, reps, duration_s, grade_ref, climb_count, duration_per_climb_s, rest_between_climbs_s)
SELECT b.id, e.position, e.name, e.description, e.type, e.series_count, e.rest_s, e.reps, e.duration_s, e.grade_ref, e.climb_count, e.duration_per_climb_s, e.rest_between_climbs_s
FROM (
  SELECT id, 'mobility' AS block FROM b5_mobility
  UNION ALL SELECT id, 'climbing' FROM b5_climbing
) b
JOIN (VALUES
  ('mobility', 1, 'Hip 90/90 stretch', NULL, 'timed', 2, 30, NULL, 60, NULL, NULL, NULL, NULL),
  ('mobility', 2, 'Shoulder cross-body stretch', NULL, 'timed', 2, 30, NULL, 45, NULL, NULL, NULL, NULL),
  ('mobility', 3, 'Doorframe pec stretch', NULL, 'timed', 2, 30, NULL, 45, NULL, NULL, NULL, NULL),
  ('mobility', 4, 'Finger prayer stretch', NULL, 'timed', 2, 30, NULL, 30, NULL, NULL, NULL, NULL),
  ('mobility', 5, 'Wrist circles', NULL, 'reps', 2, 0, 10, NULL, NULL, NULL, NULL, NULL),
  ('climbing', 1, 'Easy free climbing', 'Choose climbs well below your flash grade. Move slowly, focus on breathing and efficiency.', 'climb', 1, 0, NULL, NULL, 'flash_grade', 5, 180, 180)
) AS e(block, position, name, description, type, series_count, rest_s, reps, duration_s, grade_ref, climb_count, duration_per_climb_s, rest_between_climbs_s)
ON b.block = e.block;
