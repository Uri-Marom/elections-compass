import { neon } from '@neondatabase/serverless'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).end()
    return
  }

  if (req.headers['x-api-secret'] !== process.env.API_SECRET) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!dbUrl) {
    res.status(200).json({
      totals: { submissions: 0, full: 0, short: 0, partial: 0, he: 0, en: 0 },
      daily: [],
      questionAverages: {},
      questionCounts: {},
      questionDistributions: {},
      referrers: [],
      rawAnswers: [],
    })
    return
  }

  const sql = neon(dbUrl)

  // Per-day counts (last 60 days)
  const dailyRows = await sql`
    SELECT
      DATE(created_at AT TIME ZONE 'UTC')::text AS date,
      COUNT(*)::int AS total
    FROM answer_submissions
    WHERE answers != '{}'::jsonb
    GROUP BY 1
    ORDER BY 1 DESC
    LIMIT 60
  `

  // Overall totals using question count to classify completion
  const totalsRow = await sql`
    WITH sized AS (
      SELECT
        lang,
        (SELECT COUNT(*)::int FROM jsonb_object_keys(a.answers)) AS q_count
      FROM answer_submissions a
      WHERE answers != '{}'::jsonb
    )
    SELECT
      COUNT(*)::int                                              AS submissions,
      COUNT(*) FILTER (WHERE q_count >= 28)::int                AS full_count,
      COUNT(*) FILTER (WHERE q_count BETWEEN 8 AND 12)::int     AS short_count,
      COUNT(*) FILTER (WHERE q_count > 12 AND q_count < 28)::int AS partial_count,
      COUNT(*) FILTER (WHERE q_count < 8)::int                  AS micro_count,
      COUNT(*) FILTER (WHERE lang = 'he')::int                  AS he_count,
      COUNT(*) FILTER (WHERE lang = 'en')::int                  AS en_count
    FROM sized
  `

  // Per-question averages and counts
  const qAvgRows = await sql`
    SELECT
      kv.key                         AS question_id,
      AVG(kv.value::numeric)         AS avg_score,
      COUNT(*)::int                  AS response_count
    FROM answer_submissions a,
         jsonb_each_text(a.answers) AS kv(key, value)
    WHERE a.answers != '{}'::jsonb
      AND kv.value ~ '^-?[0-9]+$'
      AND kv.value::int BETWEEN -2 AND 2
    GROUP BY kv.key
    ORDER BY kv.key
  `

  // Per-question score distributions
  const qDistRows = await sql`
    SELECT
      kv.key          AS question_id,
      kv.value::int   AS score,
      COUNT(*)::int   AS cnt
    FROM answer_submissions a,
         jsonb_each_text(a.answers) AS kv(key, value)
    WHERE a.answers != '{}'::jsonb
      AND kv.value ~ '^-?[0-9]+$'
      AND kv.value::int BETWEEN -2 AND 2
    GROUP BY kv.key, kv.value::int
    ORDER BY kv.key, score
  `

  // Referrer sources (only rows with non-null referrer)
  const referrerRows = await sql`
    SELECT
      COALESCE(NULLIF(TRIM(referrer), ''), 'direct') AS source,
      COUNT(*)::int                                  AS count
    FROM answer_submissions
    WHERE answers != '{}'::jsonb
    GROUP BY source
    ORDER BY count DESC
    LIMIT 30
  `

  // Raw answers for client-side party match computation (exclude very short / empty)
  const rawRows = await sql`
    SELECT
      answers,
      lang,
      (SELECT COUNT(*)::int FROM jsonb_object_keys(a.answers)) AS q_count
    FROM answer_submissions a
    WHERE answers != '{}'::jsonb
      AND (SELECT COUNT(*)::int FROM jsonb_object_keys(a.answers)) >= 5
    ORDER BY created_at
  `

  // Aggregate distributions into nested object { questionId: { score: count } }
  const distributions: Record<string, Record<string, number>> = {}
  for (const row of qDistRows) {
    if (!distributions[row.question_id]) distributions[row.question_id] = {}
    distributions[row.question_id][String(row.score)] = row.cnt
  }

  const t = totalsRow[0] ?? {}
  res.status(200).json({
    totals: {
      submissions: t.submissions ?? 0,
      full:     t.full_count    ?? 0,
      short:    t.short_count   ?? 0,
      partial:  t.partial_count ?? 0,
      micro:    t.micro_count   ?? 0,
      he:       t.he_count      ?? 0,
      en:       t.en_count      ?? 0,
    },
    daily: dailyRows.map(r => ({ date: r.date, total: r.total })).reverse(),
    questionAverages: Object.fromEntries(
      qAvgRows.map(r => [r.question_id, parseFloat(Number(r.avg_score).toFixed(2))])
    ),
    questionCounts: Object.fromEntries(
      qAvgRows.map(r => [r.question_id, r.response_count])
    ),
    questionDistributions: distributions,
    referrers: referrerRows.map(r => ({ source: r.source, count: r.count })),
    rawAnswers: rawRows.map(r => ({ answers: r.answers as Record<string, number>, lang: r.lang as string })),
  })
}
