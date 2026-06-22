import { neon } from '@neondatabase/serverless'

// One-time migration endpoint. Call once via: GET /api/migrate
// DELETE this file after running.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(_req: any, res: any) {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!dbUrl) {
    res.status(500).json({ error: 'DATABASE_URL not set' })
    return
  }

  const sql = neon(dbUrl)
  await sql`
    CREATE TABLE IF NOT EXISTS answer_submissions (
      id        SERIAL PRIMARY KEY,
      answers   JSONB        NOT NULL,
      lang      TEXT         NOT NULL DEFAULT 'he',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE answer_submissions ADD COLUMN IF NOT EXISTS referrer TEXT`
  await sql`ALTER TABLE answer_submissions ADD COLUMN IF NOT EXISTS survey_mode TEXT`
  res.status(200).json({ ok: true, message: 'Migration complete. Delete this file.' })
}
