// Fixed question order for URL encoding — 30 questions, 6 states each.
// 0 = skipped, 1–5 = answer -2 to +2.
export const QUESTION_ORDER = [
  'q01','q02','q03','q04','q05','q06','q07','q08','q09','q10',
  'q11','q12','q16','q18','q19','q20','q21','q22','q23','q24',
  'q25','q26','q27','q28','q29','q31','q32','q33','q34','q35',
]

// URL-safe base-64 alphabet (no + or /)
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

// Encode all 30 answers as a single base-6 BigInt, then write in base-64url.
// 6^30 < 64^13, so result is always exactly 13 chars.
export function encodeAnswers(answers: Record<string, number | null>): string {
  let n = 0n
  for (const qid of QUESTION_ORDER) {
    const v = answers[qid]
    n = n * 6n + (v === null || v === undefined ? 0n : BigInt(v + 3))
  }
  const chars: string[] = []
  for (let i = 0; i < 13; i++) {
    chars.unshift(B64[Number(n % 64n)])
    n /= 64n
  }
  return chars.join('')
}

export function decodeAnswers(encoded: string): Record<string, number | null> {
  const result: Record<string, number | null> = {}

  // v3: 13-char base-64url format
  if (/^[A-Za-z0-9\-_]{13}$/.test(encoded)) {
    try {
      let n = 0n
      for (const ch of encoded) {
        const idx = B64.indexOf(ch)
        if (idx < 0) throw new Error('bad char')
        n = n * 64n + BigInt(idx)
      }
      const states: number[] = new Array(30)
      for (let i = 29; i >= 0; i--) {
        states[i] = Number(n % 6n)
        n /= 6n
      }
      for (let i = 0; i < QUESTION_ORDER.length; i++) {
        if (states[i] !== 0) result[QUESTION_ORDER[i]] = states[i] - 3
      }
    } catch { /* malformed — return empty */ }
    return result
  }

  // v2: 30-char hex format (one nibble per question)
  if (encoded && !encoded.includes(':') && !encoded.includes(',') && encoded.length >= 20) {
    for (let i = 0; i < Math.min(encoded.length, QUESTION_ORDER.length); i++) {
      const n = parseInt(encoded[i], 16)
      if (!isNaN(n) && n !== 0) result[QUESTION_ORDER[i]] = n - 3
    }
    return result
  }

  // v1: legacy "01:2,02:-1,…" format
  for (const pair of encoded.split(',')) {
    const [num, val] = pair.split(':')
    if (num && val !== undefined) {
      const score = Number(val)
      if (!isNaN(score)) result[`q${num}`] = score
    }
  }
  return result
}
