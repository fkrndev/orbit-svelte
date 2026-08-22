/**
 * Subsequence fuzzy matcher.
 *
 * Adapted from tolaria's `src/utils/fuzzyMatch.ts`, with two changes: the
 * matched character indices are returned so the UI can highlight them, and
 * `/` joins ` ` and `-` as a word boundary because we match against paths.
 */

export interface FuzzyResult {
  match: boolean
  score: number
  matched: number[]
}

const WORD_BOUNDARIES = new Set([' ', '-', '_', '/', '.'])

export function fuzzyMatch(query: string, target: string): FuzzyResult {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  const matched: number[] = []
  let qi = 0
  let score = 0
  let lastMatchIndex = -1

  for (let ti = 0; ti < t.length && qi < q.length; ti += 1) {
    if (t.charAt(ti) !== q.charAt(qi)) continue

    const isConsecutive = ti === lastMatchIndex + 1
    if (isConsecutive) {
      // Consecutive matches read as a real substring, not a scatter.
      score += 4
    } else if (ti === 0 || WORD_BOUNDARIES.has(t.charAt(ti - 1))) {
      // Starting a new word is a strong signal — but only when it *starts* a
      // run. Awarding it mid-run would let `p-l-a-n.md` outscore `plan.md`,
      // since every letter there follows a separator.
      score += 3
    }
    score += 1

    matched.push(ti)
    lastMatchIndex = ti
    qi += 1
  }

  return { match: qi === q.length, score, matched }
}

/** Exactness tier: 0 exact, 1 prefix, 2 substring, 3 fuzzy. Lower sorts first. */
export function matchTier(query: string, target: string): number {
  const q = query.trim().toLowerCase()
  const t = target.trim().toLowerCase()
  if (t === q) return 0
  if (t.startsWith(q)) return 1
  if (t.includes(q)) return 2
  return 3
}
