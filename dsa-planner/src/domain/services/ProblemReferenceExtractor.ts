/** LeetCode problem numbers currently go up to ~3,700; this leaves headroom. */
const MAX_PROBLEM_NUMBER = 5000

/**
 * Explicit references only, so "90 minutes" or "2026" are never read as problems:
 *  - a number alone in parentheses: "Reverse Pairs (493)"
 *  - "LC 215", "LeetCode 215", "#215"
 */
const REFERENCE = /\((\d{1,4})\)|\b(?:LC|LeetCode)\s*#?\s*(\d{1,4})\b|#(\d{1,4})\b/gi

/** LeetCode problem numbers mentioned in the given texts, de-duplicated, in order of appearance. */
export function extractProblemNumbers(...texts: string[]): number[] {
  const seen = new Set<number>()
  for (const text of texts) {
    for (const match of text.matchAll(REFERENCE)) {
      const value = Number(match[1] ?? match[2] ?? match[3])
      if (value >= 1 && value <= MAX_PROBLEM_NUMBER) seen.add(value)
    }
  }
  return [...seen]
}
