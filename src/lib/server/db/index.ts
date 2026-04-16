/**
 * Neon PostgreSQL connection via @neondatabase/serverless.
 *
 * Uses the HTTP driver (no persistent TCP connection) which works in
 * serverless/edge environments including Netlify Functions.
 *
 * Set DATABASE_URL in .env (or Netlify environment variables) to:
 *   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
 */

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { DATABASE_URL } from '$env/static/private'
import * as schema from './schema'

const sql = neon(DATABASE_URL)

export const db = drizzle(sql, { schema })
