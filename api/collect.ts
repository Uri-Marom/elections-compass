import { neon } from '@neondatabase/serverless'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }

  if (req.headers['x-api-secret'] !== process.env.API_SECRET) {
    res.status(401).end()
    return
  }

  const { answers, lang } = req.body ?? {}

  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    res.status(400).json({ error: 'invalid answers' })
    return
  }

  if (!['he', 'en'].includes(lang)) {
    res.status(400).json({ error: 'invalid lang' })
    return
  }

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!dbUrl) {
    // No DB configured — silently succeed so the client is unaffected
    res.status(200).json({ ok: true })
    return
  }

  try {
    const sql = neon(dbUrl)
    await sql`
      INSERT INTO answer_submissions (answers, lang)
      VALUES (${JSON.stringify(answers)}, ${lang})
    `
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('DB insert error:', err)
    // Don't surface DB errors to the client
    res.status(200).json({ ok: true })
  }
}
