#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "psycopg2-binary",
#   "python-dotenv",
# ]
# ///
"""
Import Kilter Board climb data from a local Aurora SQLite database into Neon PostgreSQL.

Usage:
    python scripts/import-to-neon.py /path/to/aurora.db

Reads DATABASE_URL from .env (or the environment).

Requirements (stdlib + one dep):
    pip install psycopg2-binary python-dotenv

What it imports:
    - climbs        (layout_id=1, is_draft=0, has frames) → ~318k rows
    - climb_stats   (for imported climbs only)             → ~323k rows

The board geometry (placements, holes, leds) is NOT imported here — it remains
as static JSON in src/lib/data/mock/ since it never changes.

The script is idempotent: it uses INSERT ... ON CONFLICT DO UPDATE so it can be
re-run to pick up incremental changes from a newer aurora.db file.
"""

import os
import re
import sqlite3
import sys
from datetime import datetime, timezone

BATCH_SIZE = 1000


def load_env():
    """Load .env file if present, then read DATABASE_URL."""
    try:
        from dotenv import load_dotenv  # type: ignore
        load_dotenv()
    except ImportError:
        # Manually parse .env if python-dotenv is not installed
        env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, _, v = line.partition('=')
                        os.environ.setdefault(k.strip(), v.strip())

    url = os.environ.get('DATABASE_URL')
    if not url:
        print('ERROR: DATABASE_URL not set. Copy .env.example → .env and fill it in.')
        sys.exit(1)
    return url


def connect_pg(database_url: str):
    """Connect to PostgreSQL using psycopg2."""
    try:
        import psycopg2  # type: ignore
    except ImportError:
        print('ERROR: psycopg2-binary not installed. Run: pip install psycopg2-binary')
        sys.exit(1)

    # psycopg2 doesn't understand the ?sslmode= query param format from Neon,
    # so convert it: strip the query string and pass sslmode separately.
    url = re.sub(r'\?.*$', '', database_url)
    return psycopg2.connect(url, sslmode='require')


def create_tables(cur):
    """Ensure tables exist (Drizzle migrations are the canonical path, but this
    is a fallback so the import script can be run without running drizzle-kit push)."""
    cur.execute("""
        CREATE TABLE IF NOT EXISTS climbs (
            uuid            VARCHAR(36) PRIMARY KEY,
            layout_id       INTEGER     NOT NULL,
            setter_id       INTEGER     NOT NULL,
            setter_username TEXT        NOT NULL,
            name            TEXT        NOT NULL,
            description     TEXT        NOT NULL DEFAULT '',
            frames          TEXT        NOT NULL,
            frames_count    INTEGER     NOT NULL DEFAULT 0,
            angle           INTEGER,
            is_draft        BOOLEAN     NOT NULL DEFAULT FALSE,
            allow_matches   BOOLEAN     NOT NULL DEFAULT TRUE,
            created_at      TIMESTAMPTZ
        );
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS climb_stats (
            id                    INTEGER     PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
            climb_uuid            VARCHAR(36) NOT NULL REFERENCES climbs(uuid) ON DELETE CASCADE,
            angle                 INTEGER     NOT NULL,
            difficulty_average    FLOAT8      NOT NULL DEFAULT 0,
            benchmark_difficulty  FLOAT8,
            quality_average       FLOAT8      NOT NULL DEFAULT 0,
            ascent_count          INTEGER     NOT NULL DEFAULT 0,
            fa_username           TEXT,
            fa_at                 TIMESTAMPTZ
        );
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS climbs_name_idx ON climbs (name);
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS climbs_setter_username_idx ON climbs (setter_username);
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS climbs_layout_id_idx ON climbs (layout_id);
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS climbs_is_draft_idx ON climbs (is_draft);
    """)
    cur.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS climb_stats_uuid_angle_uidx
            ON climb_stats (climb_uuid, angle);
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS climb_stats_quality_idx ON climb_stats (quality_average);
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS climb_stats_difficulty_idx ON climb_stats (difficulty_average);
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS climb_stats_sort_idx
            ON climb_stats (quality_average DESC, ascent_count DESC, climb_uuid ASC);
    """)


def parse_ts(value) -> str | None:
    """Convert an Aurora timestamp (ISO string or Unix ms) to a PostgreSQL-friendly string."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value / 1000, tz=timezone.utc).isoformat()
        except Exception:
            return None
    return str(value) if value else None


def import_climbs(sqlite_cur, pg_cur) -> set[str]:
    print('Fetching climbs from SQLite...')
    # Note: the real Aurora DB omits allow_matches and frames_count — use defaults.
    sqlite_cur.execute("""
        SELECT
            uuid, layout_id, setter_id, setter_username,
            name, description, frames,
            angle, is_draft, created_at
        FROM climbs
        WHERE layout_id = 1
          AND is_draft = 0
          AND frames IS NOT NULL
          AND frames != ''
        ORDER BY uuid
    """)

    uuids: set[str] = set()
    batch = []
    total = 0

    def flush():
        nonlocal total
        from psycopg2.extras import execute_values  # type: ignore
        execute_values(pg_cur, """
            INSERT INTO climbs
                (uuid, layout_id, setter_id, setter_username, name, description,
                 frames, frames_count, angle, is_draft, allow_matches, created_at)
            VALUES %s
            ON CONFLICT (uuid) DO UPDATE SET
                setter_username = EXCLUDED.setter_username,
                name            = EXCLUDED.name,
                description     = EXCLUDED.description,
                frames          = EXCLUDED.frames,
                angle           = EXCLUDED.angle,
                is_draft        = EXCLUDED.is_draft,
                created_at      = EXCLUDED.created_at
        """, batch, page_size=BATCH_SIZE)
        total += len(batch)
        batch.clear()
        print(f'  climbs: {total} inserted/updated', end='\r', flush=True)

    for row in sqlite_cur:
        (uuid, layout_id, setter_id, setter_username, name, description,
         frames, angle, is_draft, created_at) = row

        uuids.add(uuid)
        batch.append((
            uuid, layout_id, setter_id, setter_username or '',
            name or '', description or '', frames, 0,  # frames_count=0 (not in DB)
            angle, bool(is_draft), True,               # allow_matches=True (not in DB)
            parse_ts(created_at)
        ))

        if len(batch) >= BATCH_SIZE:
            flush()

    if batch:
        flush()

    print(f'\n  climbs: {total} total')
    return uuids


def import_stats(sqlite_cur, pg_cur, climb_uuids: set[str]):
    print('Fetching climb_stats from SQLite...')
    sqlite_cur.execute("""
        SELECT
            climb_uuid, angle,
            difficulty_average, benchmark_difficulty,
            quality_average, ascensionist_count,
            fa_username, fa_at
        FROM climb_stats
        ORDER BY climb_uuid, angle
    """)

    batch = []
    total = 0
    skipped = 0

    def flush():
        nonlocal total
        from psycopg2.extras import execute_values  # type: ignore
        execute_values(pg_cur, """
            INSERT INTO climb_stats
                (climb_uuid, angle, difficulty_average, benchmark_difficulty,
                 quality_average, ascent_count, fa_username, fa_at)
            VALUES %s
            ON CONFLICT (climb_uuid, angle) DO UPDATE SET
                difficulty_average   = EXCLUDED.difficulty_average,
                benchmark_difficulty = EXCLUDED.benchmark_difficulty,
                quality_average      = EXCLUDED.quality_average,
                ascent_count         = EXCLUDED.ascent_count,
                fa_username          = EXCLUDED.fa_username,
                fa_at                = EXCLUDED.fa_at
        """, batch, page_size=BATCH_SIZE)
        total += len(batch)
        batch.clear()
        print(f'  stats: {total} inserted/updated', end='\r', flush=True)

    for row in sqlite_cur:
        (climb_uuid, angle, difficulty_average, benchmark_difficulty,
         quality_average, ascensionist_count, fa_username, fa_at) = row

        if climb_uuid not in climb_uuids:
            skipped += 1
            continue

        batch.append((
            climb_uuid, angle,
            difficulty_average or 0, benchmark_difficulty,
            quality_average or 0, ascensionist_count or 0,
            fa_username, parse_ts(fa_at)
        ))

        if len(batch) >= BATCH_SIZE:
            flush()

    if batch:
        flush()

    print(f'\n  climb_stats: {total} total ({skipped} skipped — no matching climb)')


def main():
    if len(sys.argv) < 2:
        print('Usage: python scripts/import-to-neon.py /path/to/aurora.db')
        sys.exit(1)

    db_path = sys.argv[1]
    if not os.path.exists(db_path):
        print(f'ERROR: File not found: {db_path}')
        sys.exit(1)

    database_url = load_env()
    print(f'Source: {db_path}')
    print(f'Target: {re.sub(r":([^@]+)@", ":***@", database_url)}')
    print()

    sqlite_conn = sqlite3.connect(db_path)
    sqlite_cur = sqlite_conn.cursor()

    pg_conn = connect_pg(database_url)
    pg_cur = pg_conn.cursor()

    try:
        print('Creating tables if they don\'t exist...')
        create_tables(pg_cur)
        pg_conn.commit()

        climb_uuids = import_climbs(sqlite_cur, pg_cur)
        pg_conn.commit()

        import_stats(sqlite_cur, pg_cur, climb_uuids)
        pg_conn.commit()

        print('\nDone.')
    except Exception as e:
        pg_conn.rollback()
        print(f'\nERROR: {e}')
        raise
    finally:
        sqlite_cur.close()
        sqlite_conn.close()
        pg_cur.close()
        pg_conn.close()


if __name__ == '__main__':
    main()
