export type DifficultyLevel = 'easy' | 'medium' | 'hard'

export interface DifficultyCounts {
  readonly easy: number
  readonly medium: number
  readonly hard: number
}

export interface DifficultySlice {
  readonly level: DifficultyLevel
  readonly label: string
  readonly count: number
  /** Whole-number share of the total. All slices add up to 100 (or all are 0). */
  readonly percent: number
}

const LEVELS: ReadonlyArray<{ level: DifficultyLevel; label: string }> = [
  { level: 'easy', label: 'Easy' },
  { level: 'medium', label: 'Medium' },
  { level: 'hard', label: 'Hard' },
]

const safeCount = (value: number): number => (Number.isFinite(value) && value > 0 ? value : 0)

/**
 * Split solved counts into whole percentages with the largest-remainder method,
 * so the bar segments always fill exactly 100%.
 */
export function splitDifficulty(counts: DifficultyCounts): DifficultySlice[] {
  const slices = LEVELS.map(({ level, label }) => ({ level, label, count: safeCount(counts[level]) }))
  const total = slices.reduce((sum, s) => sum + s.count, 0)
  if (total === 0) {
    return slices.map((s) => ({ ...s, percent: 0 }))
  }

  const exact = slices.map((s) => (s.count / total) * 100)
  const floors = exact.map(Math.floor)
  const missing = 100 - floors.reduce((sum, v) => sum + v, 0)

  // Give the leftover points to the largest remainders (stable for ties).
  const bonusIndexes = new Set(
    exact
      .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
      .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
      .slice(0, missing)
      .map((entry) => entry.index),
  )

  return slices.map((s, index) => ({
    ...s,
    percent: (floors[index] ?? 0) + (bonusIndexes.has(index) ? 1 : 0),
  }))
}
